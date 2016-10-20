import 'core-js/fn/string/starts-with.js'
import 'core-js/fn/string/ends-with.js'
import 'core-js/fn/array/find.js'
import 'core-js/es6/promise.js'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css!'
import 'leaflet-loading'
import 'leaflet-loading/src/Control.Loading.css!'

import './leaflet-singleclick.js'

import * as CovJSON from 'covjson-reader'
import * as RestAPI from 'coverage-rest-client'
import * as C from 'leaflet-coverage'
import 'leaflet-coverage/leaflet-coverage.css!'
import * as CovUtils from 'covutils'

import 'c3/c3.css!'

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

L.control.scale().addTo(map)

let baseLayers = {
  'OSM':
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
       attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
    })
}
baseLayers['OSM'].addTo(map)

let layerControl = L.control.layers([], [], {collapsed: false}).addTo(map)

// We use ParameterSync here so that multiple coverage layers that display the same
// parameter get synchronized in terms of their palette and extent.
// It also allows us to display a single legend only.
// Layers that don't have a single parameter get ignored automatically.
let paramSync = new C.ParameterSync({
  syncProperties: {
    palette: (p1, p2) => p1,
    paletteExtent: (e1, e2) => e1 && e2 ? [Math.min(e1[0], e2[0]), Math.max(e1[1], e2[1])] : null
  }
}).on('parameterAdd', e => {
    // The virtual sync layer proxies the synced palette, paletteExtent, and parameter.
    // The sync layer will fire a 'remove' event if all real layers for that parameter were removed.
    let layer = e.syncLayer
    if (layer.palette) {
      C.legend(layer, {
        position: 'bottomright'
      }).addTo(map)
    }
  })

let layersInControl = new Set()
let coverageLayersOnMap = new Set()

function removeLayers () {
  for (let layer of layersInControl) {
    layerControl.removeLayer(layer)
    if (map.hasLayer(layer)) {
      // FIXME leaflet's internal state breaks if layers or controls throw exceptions in onAdd()
      // -> could be prevented by linting CovJSON before-hand
      try {
        map.removeLayer(layer)
      } catch (e) {}
    }
  }
  layersInControl = new Set()
}

function loadCov (url, options = {}) {
  removeLayers()
    
  map.fire('dataloading')
  CovJSON.read(url)
    .then(cov => RestAPI.wrap(cov, {loader: CovJSON.read}))
    .then(cov => {
      
    if (CovUtils.isDomain(cov)) {
      cov = CovUtils.fromDomain(cov)
    }
      
    map.fire('dataload')
    console.log('Coverage loaded: ', cov)
    
    // add each parameter as a layer
    let firstLayer
    
    let layerClazz = C.dataLayerClass(cov)
    
    if (cov.coverages && !layerClazz) {
      // generic collection
      if (!cov.parameters) {
        throw new Error('Only coverage collections with a "parameters" property are supported')
      }
            
      for (let key of cov.parameters.keys()) {        
        let layers = cov.coverages
          .filter(coverage => coverage.parameters.has(key))
          .map(coverage => createLayer(coverage, {keys: [key]}))
        layers.forEach(covlayer => map.fire('covlayercreate', {layer: covlayer}))
        let layer = L.layerGroup(layers)
        layersInControl.add(layer)
        
        layerControl.addOverlay(layer, key)
        if (!firstLayer) {
          firstLayer = layer

          // the following piece of code should be easier
          // TODO extend layer group class in leaflet-coverage (like PointCollection) to provide single 'add' event
          let addCount = 0
          for (let l of layers) {
            l.on('afterAdd', () => {
              coverageLayersOnMap.add(l)
              ++addCount
              if (addCount === layers.length) {
                zoomToLayers(layers)
                // FIXME is this the right place?? define event semantics!
                map.fire('covlayeradd', {layer: l})
              }
            })  
          }
        }
      }
    } else if (layerClazz) {
      // single coverage or a coverage collection of a specific domain type

      for (let key of cov.parameters.keys()) {
        let opts = {keys: [key]}
        let layer = createLayer(cov, opts)
        map.fire('covlayercreate', {layer})
        layersInControl.add(layer)
        
        layerControl.addOverlay(layer, key)
        if (!firstLayer) {
          firstLayer = layer
          layer.on('afterAdd', () => {
            zoomToLayers([layer])
            if (!cov.coverages) {
              if (isVerticalProfile(cov) || isTimeSeries(cov)) {
                layer.openPopup()
              } 
            }
          })
        }
        layer.on('afterAdd', () => {
          coverageLayersOnMap.add(layer)
          map.fire('covlayeradd', {layer})
        }).on('remove', () => {
          coverageLayersOnMap.delete(layer)
          map.fire('covlayerremove', {layer})
        })
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
  let bnds = layers.map(l => l.getBounds())
  let bounds = L.latLngBounds(bnds)
  let opts
  if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
    opts = { maxZoom: 5 }
  } 
  map.fitBounds(bounds, opts)
}

function isVerticalProfile (cov) {
  return cov.domainType === C.COVJSON_VERTICALPROFILE
}

function isTimeSeries (cov) {
  return cov.domainType === C.COVJSON_POINTSERIES || cov.domainType === C.COVJSON_POLYGONSERIES
}

function createLayer(cov, opts) {
  let layer = C.dataLayer(cov, opts).on('afterAdd', e => {
    let covLayer = e.target
    console.log('layer added:', covLayer)
            
    // This registers the layer with the sync manager.
    // By doing that, the palette and extent get unified (if existing)
    // and an event gets fired if a new parameter was added.
    // See the code above where ParameterSync gets instantiated.
    paramSync.addLayer(covLayer)
    
    if (!cov.coverages) {
      if (covLayer.time) {
        new C.TimeAxis(covLayer).addTo(map)
      }
      if (covLayer.vertical) {
        new C.VerticalAxis(covLayer).addTo(map)
      }
    }
  }).on('dataLoad', () => map.fire('dataload'))
    .on('dataLoading', () => map.fire('dataloading'))
  layer.on('axisChange', () => {
    layer.paletteExtent = 'subset'
  })
  
  if (cov.coverages) {
    if (isVerticalProfile(cov)) {
      layer.bindPopupEach(coverage => new C.VerticalProfilePlot(coverage))
    } else if (isTimeSeries(cov)) {
      layer.bindPopupEach(coverage => new C.TimeSeriesPlot(coverage))
    }
  } else {
    if (isVerticalProfile(cov)) {
      layer.bindPopup(new C.VerticalProfilePlot(cov))
    } else if (isTimeSeries(cov)) {
      layer.bindPopup(new C.TimeSeriesPlot(cov))
    }
  }
    
  return layer
}

let relUrl = basename => `coverages/${basename}.covjson`
let examples = [{
  title: 'Grid',
  url: relUrl('grid')
}, {
  title: 'Grid (Categorical)',
  url: relUrl('grid-categorical')
}, {
  title: 'Grid (Tiled)',
  url: relUrl('grid-tiled')
}, {
  title: 'Trajectory',
  url: relUrl('trajectory')
}, {
  title: 'Profile',
  url: relUrl('profile')
}, {
  title: 'PointSeries',
  url: relUrl('pointseries')
}, {
  title: 'Point',
  url: relUrl('point')
}, {
  title: 'Point Collection',
  url: relUrl('point-collection')
}, {
  title: 'Profile Collection',
  url: relUrl('profile-collection')
}, {
  title: 'MultiPolygon',
  url: relUrl('multipolygon')
}, {
  title: 'PolygonSeries',
  url: relUrl('polygonseries')
}, {
  title: 'Grid (Domain)',
  url: relUrl('grid-domain')
}, {
  title: 'Grid BNG (Domain)',
  url: relUrl('grid-domain-bng')
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
  editor.json = '{}'  
}

window.addEventListener("hashchange", loadFromHash, false)

new FileMenu({
  container: document.getElementsByClassName('file-bar')[0],
  examples
}).on('requestload', ({url}) => {
  closeValuePopup()
  editor.load(url)
})

window.api = {
    map,
    cm: editor.cm,
    CodeMirror,
    layers: coverageLayersOnMap
}

// Wire up coverage value popup
let valuePopup = new C.DraggableValuePopup({
  className: 'leaflet-popup-draggable',
  layers: [...coverageLayersOnMap]
})

function closeValuePopup () {
  if (map.hasLayer(valuePopup)) {
    map.closePopup(valuePopup)
  }
}

// click event needed for Grid layer (can't use bindPopup there)
map.on('singleclick', e => {
  valuePopup.setLatLng(e.latlng).openOn(map)
})
map.on('covlayercreate', e => {
  // some layers already have a plot popup bound to it, ignore those
  if (!e.layer.getPopup()) {
    e.layer.bindPopup(valuePopup)
  }
})
map.on('covlayeradd', e => {
  valuePopup.addCoverageLayer(e.layer)
})
map.on('covlayerremove', e => {
  valuePopup.removeCoverageLayer(e.layer)
})

