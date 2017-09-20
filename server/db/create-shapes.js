const fs = require('fs')
const path = require('path')
const csvparse = require('csv-parse')
const transform = require('stream-transform')
const colors = require('colors')

const azure = require('azure-storage')
const blobSvc = azure.createBlobService()

class createShapes {
  create(inputFile, outputDirectory) {
    return new Promise((resolve, reject) => {
      const input = fs.createReadStream(inputFile)
      const parser = csvparse({delimiter: ','})

      let output = {}
      let headers = null
      let total = 0
      const transformer = transform((row, callback) => {
        // builds the csv headers for easy access later
        if (headers === null) {
          headers = {}
          row.forEach(function(item, index) {
            headers[item] = index
          })
          return callback(null)
        }

        if (!(row[headers['shape_id']] in output)) {
          // geojson
          output[row[headers['shape_id']]] = {
            'type': 'LineString', 
            'coordinates': []
          }
        }
        output[row[headers['shape_id']]].coordinates.push([
          parseFloat(row[headers['shape_pt_lon']]),
          parseFloat(row[headers['shape_pt_lat']]),
        ])
        total++
        if (total % 50000 === 0) {
          console.log('Parsed', total, 'Points')
        }

        return callback(null)
      }).on('finish', () => {
        console.log('Created Shapes. Writing to disk...')
        Object.keys(output).forEach((key) => {
          fs.writeFileSync(path.resolve(outputDirectory, `${key}.json`), JSON.stringify(output[key]))
        })
        console.log('Written to disk!')
        resolve()
      }).on('error', () => {
        reject()
      })

      console.log('Building Shapes')
      input.pipe(parser).pipe(transformer)
    })
  }
  upload(container, directory) {
    return new Promise((resolve, reject) => {
      let total = 0
      const uploadSingle = function(files, index, callback) {
        if (index === files.length) {
          console.log(container.green +':', 'Upload Complete!', total, 'Shapes.')
          return resolve()
        }

        const fileName = files[index]
        const fileLocation = path.resolve(directory, fileName)
        blobSvc.createBlockBlobFromLocalFile(container, encodeURIComponent(fileName), fileLocation, function(error) {
          if (error) {
            console.error(container.green+':', 'Could not upload shape.', error)
          }
          total++
          if (total % 100 === 0) {
            console.log(container.green+':', 'Uploaded', total, 'Shapes.')
          }
          callback(files, index+1, callback)
        })
      }

      blobSvc.createContainerIfNotExists(container, function(error) {
        if (error) {
          throw error
        }
        console.log(container.green +':', 'Blob Container Created.')
        fs.readdir(directory, function(err, files) {
          uploadSingle(files, 0, uploadSingle)
        })    
      })
    })
  }
}
module.exports = createShapes