import * as React from 'react'
import { browserHistory } from 'react-router'

declare function require(name: string): any;
let request = require('reqwest')
let webp = require('../models/webp')

interface RealTimeItem {
  delay: number,
  stop_sequence: number,
  timestamp: number 
}
interface RealTimeMap {
  [name: string]: RealTimeItem;
}

interface ITripItemProps extends React.Props<TripItem> {
  code: string,
  name: string,
  time: string,
  trip_id: string,
  stop_sequence: number,
  color: string,
  realtime: RealTimeItem
}

class TripItem extends React.Component<ITripItemProps, {}> {
  constructor(props: ITripItemProps) {
    super(props)
    this.triggerClick = this.triggerClick.bind(this)
  }
  public triggerClick() {
    console.log('navigating to', this.props.trip_id)
    // browserHistory.push(this.props.trip_id)
  }
  public render() {
    var arrival = new Date()
    arrival.setHours(0)
    arrival.setMinutes(0)
    arrival.setSeconds(parseInt(this.props.time))

    // makes times like 4:9 -> 4:09
    var minutes = arrival.getMinutes().toString()
    if (arrival.getMinutes() < 10) {
      minutes = '0' + minutes.toString()
    }
    var timestring = arrival.getHours() + ':' + minutes

    // works out how many stops away the bus is
    var stops_away = ''
    var stops_away_no
    if (this.props.realtime) {
      stops_away_no = this.props.stop_sequence - this.props.realtime.stop_sequence
      if (stops_away_no === -1) {
        stops_away = 'Departed' // let the rider down :(
      } else if (stops_away_no === 0) {
        stops_away = 'Arrived'
      } else if (stops_away_no === 1) {
        stops_away = stops_away_no + ' stop away'
      } else {
        stops_away = stops_away_no + ' stops away'
      }
    } else {
      stops_away = <span>Scheduled <time>{timestring}</time></span>
    }

    // logic for visibility
    var visibility = true
    // date check
    if (new Date().getTime() > arrival.getTime()) {
      visibility = false
    }
    // but if there's a stops away
    var active
    if (stops_away_no > -2) {
      visibility = true
      active = 'active'
    }
    // not sure if we need to do other checks?
    var className = ''
    if (!visibility) {
      className = 'hidden'
    }

    return (
      <li className={className} onClick={this.triggerClick}><ul className={active}>
        <li>
          <div style={{backgroundColor: this.props.color}}>
            {this.props.code}
          </div>
        </li>
        <li>{this.props.name}</li>
        <li>{stops_away}</li>
        <li>›</li>
      </ul></li>
    )
  }
}

interface ServerTripItem {
  arrival_time_seconds: string,
  stop_sequence: string,
  trip_id: string,
  route_long_name: string,
  agency_id: string,
  direction_id: string,
  end_date: string,
  frequency: string,
  route_short_name: string,
  route_type: string,
  start_date: string,
  trip_headsign: string
}

interface IAppProps extends React.Props<Station> {
  routeParams: {
    station: string
  }
}
interface IAppState {
  name: string,
  stop: string,
  trips: Array<ServerTripItem>,
  realtime: RealTimeMap
}

class Station extends React.Component<IAppProps, IAppState> {
  public state : IAppState

  constructor(props: IAppProps) {
    super(props)
    this.state = {
      name: '',
      stop: '',
      trips: [],
      realtime: {}
    }
  }
  private getData(newProps) {
    var tripsSort = function(a,b) {
      return a.arrival_time_seconds - b.arrival_time_seconds
    }
    request(`/a/station/${newProps.routeParams.station}`).then((data) => {
      this.setState({
        // because typescript is dumb and no partial typing
        name: data.stop_name,
        stop: this.props.routeParams.station,
        trips: this.state.trips,
        realtime: this.state.realtime
      })
    })
    request(`/a/station/${newProps.routeParams.station}/times`).then((data) => {
      data.trips.sort(tripsSort)
      console.log(data)
      this.setState({
        // because typescript is dumb, you have to repass
        name: this.state.name,
        stop: this.state.stop,
        trips: data.trips,
        realtime: this.state.realtime
      })

      var queryString = []
      data.trips.forEach(function(trip) {
        var arrival = new Date()
        arrival.setHours(0)
        arrival.setMinutes(0)
        arrival.setSeconds(parseInt(trip.arrival_time_seconds))

        // only gets realtime info for things +30mins away
        if (arrival.getTime() < (new Date().getTime() + 1800000)) {
          queryString.push(trip.trip_id)
        }
      })

      // now we do a request to the realtime API
      request({
        method: 'post',
        type: 'json',
        contentType: 'application/json',
        url: `/a/realtime`,
        data: JSON.stringify({trips: queryString})
      }).then((rtData) => {
        this.setState({
          // because typescript is dumb, you have to repass
          name: this.state.name,
          stop: this.state.stop,
          trips: this.state.trips,
          realtime: rtData
        })        
      })
    })
  }
  public componentDidMount() {
    this.getData(this.props)
  }
  public componentWillReceiveProps(newProps) {
    this.getData(newProps)
    this.setState({
      name: '',
      stop: '',
      trips: [],
      realtime: {}
    })
  }
  public render() {
    var bgImage = {}
    if (webp.support === false) {
      bgImage = {'backgroundImage': 'url(/a/map/' + this.props.routeParams.station + '.png)'}
    } else if (webp.support === true) {
      bgImage = {'backgroundImage': 'url(/a/map/' + this.props.routeParams.station + '.webp)'}
    }
    var slug
    if (this.state.stop != '') {
      slug = 'Stop ' + this.state.stop + ' / ' + this.state.name
    }

    var time = new Date()

    // makes times like 4:9 -> 4:09
    var minutes = time.getMinutes().toString()
    if (time.getMinutes() < 10) {
      minutes = '0' + minutes.toString()
    }
    var timestring = <time><span>{time.getHours()}</span><span className="blink">:</span><span>{minutes}</span></time>

    var icon = ''
    if (this.state.trips.length > 0) {
      var rt = parseInt(this.state.trips[0].route_type)
      // tram / LRT
      // wow auckland maybe you should build LRT hint hint
      if (rt === 0) {
        icon ='🚉'
      // subway / metro
      // no this is not the same as AT metro
      } else if (rt === 1) {
        icon = '🚇'
      // commuter rail
      } else if (rt === 2) {
        icon = '🚆'
      // bus
      } else if (rt === 3) {
        icon = '🚍'
      // ferry
      } else if (rt === 4) {
        icon = '🛳'
      }
      console.log(this.state.trips[0])
    }

    return (
      <div>
        <header style={bgImage}>
          <div>
            <span className="icon">{icon}</span>
            {timestring}
            <h1>{this.state.name}</h1>
            <h2>{slug}</h2>
          </div>
        </header>
        <ul>
          <li className="header">
            <ul>
              <li>Route</li>
              <li>Destination</li>
              <li>Status</li>
            </ul>
          </li>
          {this.state.trips.map((trip) => {
            return <TripItem 
              color="#27ae60"
              code={trip.route_short_name}
              time={trip.arrival_time_seconds}
              name={trip.trip_headsign}
              key={trip.trip_id}
              trip_id={trip.trip_id}
              stop_sequence={trip.stop_sequence}
              realtime={this.state.realtime[trip.trip_id]}
             />
          })}
        </ul>
      </div>
    )
  }
}
export default Station