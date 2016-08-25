var azure = require('azure-storage');
var request = require('request')
var moment = require('moment-timezone')
var fs = require('fs')

var tableSvc = azure.createTableService();

var options = {
  headers: {
    'Ocp-Apim-Subscription-Key': process.env.atApiKey
  }
};

var cache = {
  get: function() {
    var promises = []

    // calendar
    options.url = 'https://api.at.govt.nz/v2/gtfs/calendar'
    var calendar = request(options).pipe(fs.createWriteStream('cache/calendar.json'))
    promises[0] = new Promise(function(resolve, reject) {
      calendar.on('finish', function() {
        resolve()
      })
    })
    
    // routes
    options.url = 'https://api.at.govt.nz/v2/gtfs/routes'
    var routes = request(options).pipe(fs.createWriteStream('cache/routes.json'))
    promises[1] = new Promise(function(resolve, reject) {
      routes.on('finish', function() {
        resolve()
      })
    })

    // trips
    options.url = 'https://api.at.govt.nz/v2/gtfs/trips'
    var trips = request(options).pipe(fs.createWriteStream('cache/trips.json'))
    promises[2] = new Promise(function(resolve, reject) {
      trips.on('finish', function() {
        resolve()
      })
    })

    // stops
    options.url = 'https://api.at.govt.nz/v2/gtfs/stops'
    var stops = request(options).pipe(fs.createWriteStream('cache/stops.json'))
    promises[3] = new Promise(function(resolve, reject) {
      stops.on('finish', function() {
        resolve()
      })
    })

    // now we build the hashtable things
    Promise.all(promises).then(cache.build)
  },
  build: function() {
    var promises = []

    // build a calendar hashtable
    var services = {}
    promises[0] = new Promise(function(resolve, reject) {
      fs.readFile('cache/calendar.json', function(err, data) {
        if (err) throw err;
        JSON.parse(data).response.forEach(function(s) {
          services[s.service_id] = {
            frequency: s.monday.toString() + s.tuesday.toString() + s.wednesday.toString() + s.thursday.toString() + s.friday.toString() + s.saturday.toString() + s.sunday.toString(),
            start_date: s.start_date,
            end_date: s.end_date
          }
        })
        resolve()
      })
    })

    // build a routes hash table
    var routes = {}
    promises[1] = new Promise(function(resolve, reject) {
      fs.readFile('cache/routes.json', function(err, data) {
        if (err) throw err;
        JSON.parse(data).response.forEach(function(s) {
          routes[s.route_id] = {
            agency_id: s.agency_id,
            route_short_name: s.route_short_name,
            route_long_name: s.route_long_name,
            route_type: s.route_type
          }
        })
        resolve()
      })
    })

    // build the awesome joined trips lookup table
    Promise.all(promises).then(function() {
      var trips = {}
      fs.readFile('cache/trips.json', function(err, data) {
        if (err) throw err;
        JSON.parse(data).response.forEach(function(s) {
          trips[s.trip_id] = {
            route_id: s.route_id,
            service_id: s.service_id,
            trip_headsign: s.trip_headsign,
            direction_id: s.direction_id,
            block_id: s.block_id,
            shape_id: s.shape_id,
            agency_id: routes[s.route_id].agency_id,
            route_short_name: routes[s.route_id].route_short_name,
            route_long_name: routes[s.route_id].route_long_name,
            route_type: routes[s.route_id].route_type,
            frequency: services[s.service_id].frequency,
            start_date: services[s.service_id].start_date,
            end_date: services[s.service_id].end_date
          }
        })
        fs.writeFile('cache/tripsLookup.json', JSON.stringify(trips))
      })
    })
  },
  upload: function() {
    var promises = []

    promises[0] = new Promise(function(resolve, reject) {
      tableSvc.createTableIfNotExists('stops', function(error, result, response){
        if(!error){
          resolve()
        }
      });
    })

    promises[1] = new Promise(function(resolve, reject) {
      tableSvc.createTableIfNotExists('trips', function(error, result, response){
        if(!error){
          resolve()
        }
      });
    })

    Promise.all(promises).then(function(){
      fs.readFile('cache/stops.json', function(err, data){
        if (err) throw err;
        var stopsData = JSON.parse(data)
        var batch = new azure.TableBatch()
        var arrayOfEntityArrays = []
        var count = 0
        stopsData.response.forEach(function(stop){
          arrayOfEntityArrays[count] = arrayOfEntityArrays[count] || new azure.TableBatch()
          if (arrayOfEntityArrays[count].operations.length > 99){
            count++
            arrayOfEntityArrays[count] = arrayOfEntityArrays[count] || new azure.TableBatch()
          }
          arrayOfEntityArrays[count].insertOrReplaceEntity({
            PartitionKey: {'_': 'allstops'},
            RowKey: {'_': stop.stop_id.toString()},
            stop_name: {'_': stop.stop_name},
            stop_desc: {'_': stop.stop_desc},
            stop_lat: {'_': stop.stop_lat},
            stop_lon: {'_': stop.stop_lon},
            zone_id: {'_': stop.zone_id},
            stop_url: {'_': stop.stop_url},
            stop_code: {'_': stop.stop_code},
            stop_street: {'_': stop.stop_street},
            stop_city: {'_': stop.stop_city},
            stop_region: {'_': stop.stop_region},
            stop_postcode: {'_': stop.stop_postcode},
            stop_country: {'_': stop.stop_country},
            location_type : {'_': stop.location_type },
            parent_station: {'_': stop.parent_station},
            stop_timezone: {'_': stop.stop_timezone},
            wheelchair_boarding: {'_': stop.wheelchair_boarding},
            direction: {'_': stop.direction},
            position: {'_': stop.position},
            the_geom: {'_': stop.the_geom}
          })
        })
        console.log(arrayOfEntityArrays[0])
        console.log(arrayOfEntityArrays.length)
        var batchUpload = function(n){
          if (n < arrayOfEntityArrays.length) {
            console.log(`uploading batch ${n+1}`)
            tableSvc.executeBatch('stops', arrayOfEntityArrays[n], function(error, result, response){
              if(!error){
                batchUpload(n+1)
              } else {
                console.log(error)
              }
              });
          } else {
            console.log('finished uploading stops')
          }
        }
        batchUpload(0)
      })
    })

    Promise.all(promises).then(function() {
      fs.readFile('cache/tripsLookup.json', function(err, data) {
        if (err) throw err;
        var tripsData = JSON.parse(data)
        var batch = new azure.TableBatch();
        var arrayOfEntityArrays = []
        var count = 0
        for (var key in tripsData) {
          arrayOfEntityArrays[count] = arrayOfEntityArrays[count] || new azure.TableBatch()
          if (arrayOfEntityArrays[count].operations.length > 99) {
            count++
            arrayOfEntityArrays[count] = arrayOfEntityArrays[count] || new azure.TableBatch();
          } 
          arrayOfEntityArrays[count].insertOrReplaceEntity({
            PartitionKey: {'_': 'alltrips'},
            RowKey: {'_': key},
            route_id: {'_': tripsData[key].route_id},
            service_id: {'_': tripsData[key].service_id},
            trip_headsign: {'_': tripsData[key].trip_headsign},
            direction_id: {'_': tripsData[key].direction_id},
            block_id: {'_': tripsData[key].block_id},
            shape_id: {'_': tripsData[key].shape_id},
            agency_id: {'_': tripsData[key].agency_id},
            route_short_name: {'_': tripsData[key].route_short_name},
            route_long_name: {'_': tripsData[key].route_long_name},
            route_type: {'_': tripsData[key].route_type},
            frequency: {'_': tripsData[key].frequency},
            start_date: {'_': tripsData[key].start_date},
            end_date: {'_': tripsData[key].end_date}
          })
        }
        var batchUpload = function(n) {
          if (n < arrayOfEntityArrays.length) {
            console.log(`uploading trips batch ${n+1}`)
            tableSvc.executeBatch('trips', arrayOfEntityArrays[n], function (error, result, response) {
              if(!error) {
                batchUpload(n+1)
              } else {
                console.log(error)
              }
            });
          } else {
            console.log('finished uploading trips')
          }
        }
        batchUpload(0)
      })

    })



  }
}
module.exports = cache