import React from 'react'
import ReactDOM from 'react-dom'
import { Router, IndexRoute, Route, Link, browserHistory } from 'react-router'
import { iOS } from './models/ios.js'
import { UiStore } from './stores/uiStore.js'

import Index from './views/index.jsx'
import Splash from './views/splash.jsx'
import Station from './views/station.jsx'
import Settings from './views/settings.jsx'
import NoMatch from './views/nomatch.jsx'
// import Lines from './views/lines.jsx'
// import Line from './views/line.jsx'
import VehicleLocationBootstrap from './views/vehicle_loc_bootstrap.jsx'

import autotrack from 'autotrack' // google analytics
import injectTapEventPlugin from 'react-tap-event-plugin'
injectTapEventPlugin()

class App extends React.Component {

  render() {
    return (
      <Router history={browserHistory}>
        <Route path="/" component={Index} onChange={UiStore.handleReactChange}>
          <Route path="s/:station" component={Station}>
            <Route path=":trip_id" component={VehicleLocationBootstrap} />
          </Route>

          <Route path="settings" component={Settings}/>
          <Route path="*" component={NoMatch}/>
        </Route>
      </Router>
    )
  }
}
// let renderGo = false
// let appStarted = false
// if ('fetch' in window) {
//   renderGo = true
// } else {
//   require.ensure([], function() {
//     window.fetch = require('whatwg-fetch').default
//     renderGo = true
//     startApp()
//   })
// }
document.addEventListener("DOMContentLoaded", function(event) {
  if (process.env.NODE_ENV === "production") {
    document.getElementById('app').className = 'production'
  }
  startApp()
})
let startApp = function() {
  // if (renderGo === true && appStarted === false) {
    // appStarted = true
  ReactDOM.render(<App />, document.getElementById('app'))
  // }
}
document.ontouchmove = iOS.touchMoveFix