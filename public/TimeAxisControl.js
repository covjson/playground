import L from 'leaflet'
import {$,HTML} from 'minified'

let TEMPLATE = 
`<div class="info" style="clear:none">
  <strong class="title">Time</strong><br>
  <select name="date" class="date"></select>
  <select name="time" class="time"></select>
</div>`

export default class TimeAxisControl extends L.Control {
  constructor (covLayer, options) {
    options = options || {}
    super(options.position ? {position: options.position} : {position: 'topleft'})
    this._title = options.title
    this.covLayer = covLayer

    this._remove = () => this.removeFrom(this._map)
    covLayer.on('remove', this._remove)
    
    this._axisListener = e => {
      if (e.axis === 'time') this.updateAxis()
    }
    
    let timeSlices = this.covLayer.timeSlices
    let dateMap = new Map() // UTC timestamp (representing the date only) -> array of Date objects
    for (let t of timeSlices) {
      let dateTimestamp = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())).getTime()
      if (!dateMap.has(dateTimestamp)) {
        dateMap.set(dateTimestamp, [])
      }
      dateMap.get(dateTimestamp).push(t)
    }
    this._dateMap = dateMap
  }
    
  onRemove (map) {
    this.covLayer.off('remove', this._remove)
    this.covLayer.off('axisChange', this._axisListener)
  }
  
  onAdd (map) {
    this.covLayer.on('axisChange', this._axisListener)
    
    let el = HTML(TEMPLATE)[0]
    this._el = el
    L.DomEvent.disableClickPropagation(el)
    
    if (this._title) {
      $('.title', el).fill(this._title)
    }
    
    for (let dateTimestamp of this._dateMap.keys()) {
      let dateStr = getUTCDateString(dateTimestamp)
      $('.date', el).add(HTML(`<option value="${dateStr}">${dateStr}</option>`))
    }
    
    $('.date', el).on('change', event => {
      let dateTimestamp = getUTCTimestampDateOnly(event.target.value)
      let timeSlice = this._dateMap.get(dateTimestamp)[0]
      this.covLayer.time = timeSlice
      this.initTimeSelect()
    })
    $('.time', el).on('change', event => {
      let dateStr = $('.date', el)[0].value
      let timeStr = event.target.value
      let time = new Date(dateStr + 'T' + timeStr)
      this.covLayer.time = time
    })
    
    this.updateAxis()
    
    return el
  }
  
  updateAxis () {
    let el = this._el
    // selects the date set in the cov layer, populates the time select, and selects the time
    let covTime = this.covLayer.time
    let dateStr = getUTCDateString(getUTCTimestampDateOnly(covTime.toISOString()))
    $('.date', el)[0].value = dateStr 
    
    this.initTimeSelect()
    
    let timeStr = covTime.toISOString().substr(11)
    $('.time', el)[0].value = timeStr
  }
  
  initTimeSelect () {
    let el = this._el
    $('.time', el).fill()
    let dateTimestamp = getUTCTimestampDateOnly($('.date', el)[0].value)
    let times = this._dateMap.get(dateTimestamp)
    let disabled = times.length === 1 ? ' disabled' : ''
    for (let timeSlice of times) {
      let timeStr = timeSlice.toISOString().substr(11)
      $('.time', el).add(HTML(`<option value="${timeStr}"${disabled}>${timeStr}</option>`))
    }
  }
    
}

function getUTCTimestampDateOnly (dateStr) {
  return Date.UTC(parseInt(dateStr.substr(0, 4)), parseInt(dateStr.substr(5, 2)), 
      parseInt(dateStr.substr(8, 2)))
}

function getUTCDateString (timestamp) {
  return new Date(timestamp).toISOString().substr(0, 10)
}

TimeAxisControl.include(L.Mixin.Events)

//work-around for Babel bug, otherwise SelectControl cannot be referenced here
export { TimeAxisControl as default }
