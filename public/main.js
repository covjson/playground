import L from 'leaflet'
import 'leaflet/dist/leaflet.css!'
import 'leaflet-loading'
import 'leaflet-loading/src/Control.Loading.css!'
import 'leaflet-groupedlayercontrol'
import 'leaflet-groupedlayercontrol/dist/leaflet.groupedlayercontrol.min.css!'

import * as CovJSON from 'covjson-reader'
import * as RestAPI from 'coverage-rest-client'
import LayerFactory from 'leaflet-coverage'
import {getLayerClass} from 'leaflet-coverage'

import Legend from 'leaflet-coverage/controls/Legend.js'
import TimeAxis from 'leaflet-coverage/controls/TimeAxis.js'
import ProfilePlot from 'leaflet-coverage/popups/VerticalProfilePlot.js'
import TimeSeriesPlot from 'leaflet-coverage/popups/TimeSeriesPlot.js'
import ParameterSync from 'leaflet-coverage/layers/ParameterSync.js'

import {isDomain, isCoverage} from 'covutils/lib/validate.js'
import {fromDomain} from 'covutils/lib/coverage/create.js'

import CodeMirror from 'codemirror'

import FileMenu from './FileMenu.js'
import Editor from './Editor.js'

import './style.css!'

let mapEl = document.getElementsByClassName('map')[0]
let map = L.map(mapEl, {
  loadingControl: true,
  // initial center and zoom has to be set before layers can be added
  center: [10, 0],
  zoom: 2
})

let baseLayers = {
  'OSM':
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
       attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
    })
}
baseLayers['OSM'].addTo(map)

let layerControl = L.control.groupedLayers([], [], {collapsed: false}).addTo(map)

let layerFactory = LayerFactory()

// We use ParameterSync here so that multiple coverage layers that display the same
// parameter get synchronized in terms of their palette and extent.
// It also allows us to display a single legend only.
// Layers that don't have a single parameter get ignored automatically.
let paramSync = new ParameterSync({
  syncProperties: {
    palette: (p1, p2) => p1,
    paletteExtent: (e1, e2) => e1 && e2 ? [Math.min(e1[0], e2[0]), Math.max(e1[1], e2[1])] : null
  }
}).on('parameterAdd', e => {
    // The virtual sync layer proxies the synced palette, paletteExtent, and parameter.
    // The sync layer will fire a 'remove' event if all real layers for that parameter were removed.
    let layer = e.syncLayer
    if (layer.palette) {
      Legend(layer, {
        position: 'bottomright'
      }).addTo(map)
    }
  })

let layersOnMap = new Set()

function removeLayers () {
  for (let layer of layersOnMap) {
    layerControl.removeLayer(layer)
    if (map.hasLayer(layer)) {
      // FIXME leaflet's internal state breaks if layers or controls throw exceptions in onAdd()
      // -> could be prevented by linting CovJSON before-hand
      try {
        map.removeLayer(layer)
      } catch (e) {}
    }
  }
  layersOnMap = new Set()
}

function loadCov (url, options = {}) {
  removeLayers()
  
  let group = options.group || 'Parameters'
  
  map.fire('dataloading')
  CovJSON.read(url)
    .then(cov => RestAPI.wrap(cov, {loader: CovJSON.read}))
    .then(cov => {
      
    if (isDomain(cov)) {
      cov = fromDomain(cov)
    }
      
    map.fire('dataload')
    console.log('Coverage loaded: ', cov)
    
    // add each parameter as a layer
    let firstLayer
    
    let layerClazz = getLayerClass(cov)
    
    if (cov.coverages && !layerClazz) {
      // generic collection
      if (!cov.parameters) {
        throw new Error('Only coverage collections with a "parameters" property are supported')
      }
            
      for (let key of cov.parameters.keys()) {        
        let layers = cov.coverages
          .filter(coverage => coverage.parameters.has(key))
          .map(coverage => createLayer(coverage, {keys: [key]}))
        let layer = L.layerGroup(layers)
        layersOnMap.add(layer)
        
        layerControl.addOverlay(layer, key, group)
        if (!firstLayer) {
          firstLayer = layer

          // the following piece of code should be easier
          // TODO extend layer group class in leaflet-coverage (like PointCollection) to provide single 'add' event
          let addCount = 0
          for (let l of layers) {
            l.on('add', () => {
              ++addCount
              if (addCount === layers.length) {
                zoomToLayers(layers)
              }
            })  
          }
        }
      }
    } else if (layerClazz) {
      // single coverage or a coverage collection of a specific domain type
      
      // TODO use jsonld to properly query graph (together with using cov.id as reference point)
      if (cov.ld && cov.ld.inCollection) {
        group += '<br />(part of <a href="' + cov.ld.inCollection.id + '">linked collection</a>)'
      }
      for (let key of cov.parameters.keys()) {
        let opts = {keys: [key]}
        let layer = createLayer(cov, opts)
        layersOnMap.add(layer)
        
        layerControl.addOverlay(layer, key, group)
        if (!firstLayer) {
          firstLayer = layer
          layer.on('add', () => {
            zoomToLayers([layer])
            if (!cov.coverages) {
              if (isVerticalProfile(cov) || isTimeSeries(cov)) {
                layer.openPopup()
              } 
            }
          })
        }
      }
    } else {
      throw new Error('unsupported type')
    }
    if (options.display && firstLayer) {
      map.addLayer(firstLayer)
    }
    editor.clearErrors()
  }).catch(e => {
    map.fire('dataload')
    console.log(e)
    editor.addError(e.message)
  })
}

function zoomToLayers (layers) {
  let bounds = L.latLngBounds(layers.map(l => l.getBounds()))
  let opts
  if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
    opts = { maxZoom: 5 }
  } 
  map.fitBounds(bounds, opts)
}

function isVerticalProfile (cov) {
  // TODO use full URI
  return cov.domainType && cov.domainType.endsWith('VerticalProfile')
}

function isTimeSeries (cov) {
  // TODO use full URI
  return cov.domainType && (cov.domainType.endsWith('PointSeries') || cov.domainType.endsWith('PolygonSeries'))
}

function createLayer(cov, opts) {
  let layer = layerFactory(cov, opts).on('add', e => {
    let covLayer = e.target
    console.log('layer added:', covLayer)
            
    // This registers the layer with the sync manager.
    // By doing that, the palette and extent get unified (if existing)
    // and an event gets fired if a new parameter was added.
    // See the code above where ParameterSync gets instantiated.
    paramSync.addLayer(covLayer)
    
    if (!cov.coverages) {
      if (covLayer.time) {
        new TimeAxis(covLayer).addTo(map)
      } 
    }
  }).on('dataLoading', () => map.fire('dataloading'))
    .on('dataLoad', () => map.fire('dataload'))
  
  if (cov.coverages) {
    if (isVerticalProfile(cov)) {
      layer.bindPopupEach(coverage => new ProfilePlot(coverage))
    } else if (isTimeSeries(cov)) {
      layer.bindPopupEach(coverage => new TimeSeriesPlot(coverage))
    }
  } else {
    if (isVerticalProfile(cov)) {
      layer.bindPopup(new ProfilePlot(cov))
    } else if (isTimeSeries(cov)) {
      layer.bindPopup(new TimeSeriesPlot(cov))
    }
  }
    
  return layer
}

let examples = [{
  title: 'Grid',
  url: 'coverages/grid.covjson'
}, {
  title: 'Grid (Categorical)',
  url: 'coverages/grid-categorical.covjson'
}, {
  title: 'Trajectory',
  url: 'coverages/trajectory.covjson'
}, {
  title: 'Profile',
  url: 'coverages/profile.covjson'
}, {
  title: 'PointSeries',
  url: 'coverages/pointseries.covjson'
}, {
  title: 'Point',
  url: 'coverages/point.covjson'
}, {
  title: 'Point Collection',
  url: 'coverages/point-collection.covjson'
}, {
  title: 'Profile Collection',
  url: 'coverages/profile-collection.covjson'
}, {
  title: 'MultiPolygon',
  url: 'coverages/multipolygon.covjson'
}, {
  title: 'PolygonSeries',
  url: 'coverages/polygonseries.covjson'
}, {
  title: 'Grid (Domain)',
  url: 'coverages/grid-domain.covjson'
}]

let editor = new Editor({
  container: document.getElementsByClassName('right')[0]
}).on('change', e => {
  loadCov(e.obj, {display: true})
}).on('resize', () => {
  map.invalidateSize()
})

function loadFromHash () {
  let url = window.location.hash.substr(1)
  editor.load(url)
}

if (window.location.hash) {
  loadFromHash()
} else {
  editor.json = 
`{
  "type": "CoverageCollection",
  "coverages": []
}`  
}

window.addEventListener("hashchange", loadFromHash, false)

new FileMenu({
  container: document.getElementsByClassName('file-bar')[0],
  examples
}).on('requestload', ({url}) => editor.load(url))

window.api = {
    map,
    cm: editor.cm,
    CodeMirror
}
