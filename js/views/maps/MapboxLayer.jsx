import { getIconName } from './util.jsx'
import UiStore from '../../stores/UiStore.js'
import { vars } from '../../styles.js'

const { desktopThreshold } = vars

class MapboxLayer {

  id = Math.random().toString()

  visible = false

  mounted = false

  constructor(id) {
    if (id) {
      this.id = id
    }
  }

  add(type, data, props = {}) {
    const map = UiStore.state.basemap
    if (type === 'geojson') {
      map.addSource(this.id, {
        'type': 'geojson',
        'data': data
      })
      const layer = {
        'id': this.id,
        'type': 'symbol',
        'source': this.id,
        'layout': {
          'visibility': 'none',
        }
      }
      if (data.type === 'LineString') {
        layer.type = 'line'
        layer.layout['line-join'] = 'round'
        layer.layout['line-cap'] = 'round'
        layer.paint = {
          'line-color': props.color,
          'line-width': 4
        }
      } else if (props.typeExtension === 'CircleMarker') {
        layer.type = 'circle'
        layer.paint = {
          "circle-color": "#fff",
          "circle-stroke-width": 2,
          "circle-radius": props.typeExtensionOptions.radius,
          "circle-stroke-color": props.typeExtensionOptions.color,
        }
      } else if (props.typeExtension === 'VehicleMarker') {
        layer.layout = {
          'icon-image': getIconName(props.typeExtensionOptions.region, props.typeExtensionOptions.route_type, 'VehicleMarker'),
          'icon-allow-overlap': true,
        }
      } else {
        console.log('add', type, data, props)
      }

      if (props.orderBefore && map.getLayer(props.orderBefore) != null) {
        map.addLayer(layer, props.orderBefore)
      } else {
        map.addLayer(layer)
      }
      
      this.mounted = true
    }
  }

  show(bounds = null, dispose = true, hideStops = true) {
    const map = UiStore.state.basemap
    if (bounds !== null) {
      const options = {
        padding: {
          top: 20,
          bottom: 50,
          left: 20,
          right: 20,
        }
      }
      if (document.documentElement.clientWidth <= desktopThreshold) {
        options.padding.bottom = 350
      }
      map.fitBounds(
        [[bounds.lon_max, bounds.lat_max], [bounds.lon_min, bounds.lat_min]],
        options
      )
    }

    if (this.visible === true) return
    map.setLayoutProperty(this.id, 'visibility', 'visible')

    if (hideStops) {
      UiStore.stopVisibility(hideStops)
    }
  }

  hide(dispose = true, hideStops = false) {
    if (!this.mounted) return
    
    const map = UiStore.state.basemap
    if (dispose === true) {
      map.removeLayer(this.id)
      map.removeSource(this.id)
    } else {
      map.setLayoutProperty(this.id, 'visibility', 'none')
    }

    this.visible = false
    if (!hideStops) {
      UiStore.stopVisibility(hideStops)
    }
  }

}
export default MapboxLayer