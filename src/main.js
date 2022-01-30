import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-loading'
import 'leaflet-loading/src/Control.Loading.css'

import './leaflet-singleclick.js'

import * as CovJSON from 'covjson-reader'
import * as C from 'leaflet-coverage'
import 'leaflet-coverage/leaflet-coverage.css'
import * as CovUtils from 'covutils'

import 'c3/c3.css'

import FileMenu from './FileMenu.js'
import Editor from './Editor.js'
import * as config from './config.js'

import './style.css'

const playgroundEl = document.querySelector('.playground')
playgroundEl.innerHTML = `
  <div class="map"></div>
  <div class="right"></div>
  <div class="file-bar"></div>
  `

let mapEl = playgroundEl.querySelector('.map')
let map = L.map(mapEl, {
  loadingControl: true,
  // initial center and zoom has to be set before layers can be added
  center: config.initialMapCenter,
  zoom: config.initialMapZoom
})

L.control.scale().addTo(map)

const baseLayer = L.tileLayer(config.baseMap.url, {
    attribution: config.baseMap.attribution
})
baseLayer.addTo(map)

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

let editor

function displayCovJSON(obj, options = {}) {
  editor.clearError()
  removeLayers()
    
  map.fire('dataloading')
  CovJSON.read(obj)
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
        throw new Error('Playground: only coverage collections with a "parameters" property are supported')
      }
            
      for (let key of cov.parameters.keys()) {        
        let layers = cov.coverages
          .filter(coverage => coverage.parameters.has(key))
          .map(coverage => createLayer(coverage, {keys: [key]}))
        layers.forEach(layer => map.fire('covlayercreate', {layer}))
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
      throw new Error('Playground: unsupported or missing domain type')
    }
    if (options.display && firstLayer) {
      map.addLayer(firstLayer)
    }
  }).catch(e => {
    map.fire('dataload')
    console.log(e)
    editor.setError(e.message)
  })
}

function zoomToLayers (layers) {
  let bnds = layers.map(l => l.getBounds())
  let bounds = L.latLngBounds(bnds)
  let opts = {
    padding: L.point(10, 10)
  }
  if (bounds.getWest() === bounds.getEast() && bounds.getSouth() === bounds.getNorth()) {
    opts.maxZoom = 5
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
    .on('error', e => map.fire('error', { error: e.error }))
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

function parseLocationHash() {
  let hash = window.location.hash.substring(1)
  
  // handle old style
  if (hash.startsWith('http')) {
    return {url: hash}
  }

  let params = new URLSearchParams(hash)
  let url = params.get('url')
  let schema = params.get('schema')
  return {url, schema}  
}

const initialHash = parseLocationHash()
const schemaUrl = initialHash.schema || config.schemaUrl
const covjsonUrl = initialHash.url || config.examples[0].url

editor = new Editor({
  container: playgroundEl.querySelector('.right'),
  schemaUrl: schemaUrl,
  url: covjsonUrl
}).on('change', e => {
  let obj
  try {
    obj = JSON.parse(e.text)
  } catch (e) {
    // ignore invalid JSON, user will see error message in editor
    return;
  }
  displayCovJSON(obj, {display: true})
}).on('resize', () => {
  map.invalidateSize()
})

let oldHash = {}
async function handleLocationHashChange () {
  const hash = parseLocationHash()
  if (hash.schema && oldHash.schema != hash.schema) {
    await editor.loadJsonSchema(hash.schema)
  }
  if (hash.url && oldHash.url != hash.url) {
    await editor.loadFromUrl(hash.url)
  }
  oldHash = hash
}

window.addEventListener("hashchange", handleLocationHashChange, false)

new FileMenu({
  container: playgroundEl.querySelector('.file-bar'),
  examples: config.examples
}).on('requestload', ({url}) => {
  closeValuePopup()
  editor.loadFromUrl(url)
})

window.api = {
    map,
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

map.on('error', e => {
  if (e.error?.message) {
    editor.setError(e.error.message)
  }
})
