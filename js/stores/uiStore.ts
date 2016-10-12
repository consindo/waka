import { browserHistory } from 'react-router'
import { iOS } from '../models/ios.ts'

export namespace UiStore {
  let state = {
    triggeredBack: false,
    noAnimate: false,
    goingBack: false,
    lastUrl: '',
    currentUrl: '/ss'
  }
  // restores history if it's an iphone web clip :/
  if ((window as any).navigator.standalone) {
    if (localStorage.getItem('CurrentUrl')) {
      state.currentUrl = localStorage.getItem('CurrentUrl')
    }
  }
  if (window.matchMedia('(display-mode: standalone)').matches || (window as any).navigator.standalone) {
    browserHistory.push(state.currentUrl)
  }

  export function getState() {
    return state
  }
  export function navigateSavedStations(path: string, noAnimate?: boolean) {
    if (window.location.pathname === path) {
      return
    } else if (state.lastUrl === path) {
      state.triggeredBack = true
      state.noAnimate = noAnimate
      browserHistory.goBack()
      setTimeout(function() {
        state.noAnimate = false
        state.triggeredBack = false
      }, 300)
    } else {
      // first run maybe?
      state.triggeredBack = true
      state.noAnimate = noAnimate
      browserHistory.push(path)
      setTimeout(function() {
        state.noAnimate = false
        state.triggeredBack = false
      }, 300)
    }
  }
  export function handleState(e) { 
    state.lastUrl = window.location.pathname
  }
  export function currentState(e) { 
    state.currentUrl = window.location.pathname
    localStorage.setItem('CurrentUrl', state.currentUrl)
  }
  export function handleReactChange(prevState, nextState, replace, callback) {
    // don't run the back animation if it's just in normal ios
    if (iOS.detect() && !(window as any).navigator.standalone && !state.triggeredBack) {
      return callback()
    }
    var p = nextState.location.pathname
    var sp = p.split('/')
    if ((nextState.location.action == 'POP' && ((sp[1] == 'cf' && sp.length === 3) || sp.length === 2)) || state.triggeredBack) {
      if (state.noAnimate === true) {
        // runs cb with delay for animation to finish
        setTimeout(function() {
          callback()
        }, 500)
        return
      }
      state.goingBack = true
      UiStore.trigger('goingBack')

      setTimeout(function() {
        requestAnimationFrame(function() {
          callback()
          state.goingBack = false
          UiStore.trigger('goingBack')
        })
      }, 550)
    } else {
      callback()
    }
  }
  /* THIS IS NOT VERY TYPESCRIPT */
  // But it's so simple I'll fix it later :)
  export function bind(event, fct){
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
  }
  export function unbind(event, fct){
    this._events = this._events || {};
    if( event in this._events === false  )  return;
    this._events[event].splice(this._events[event].indexOf(fct), 1);
  }
  export function trigger(event /* , args... */){
    this._events = this._events || {};
    if( event in this._events === false  )  return;
    for(var i = 0; i < this._events[event].length; i++){
      this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
  }
}
browserHistory.listenBefore(UiStore.handleState)
browserHistory.listen(UiStore.currentState)