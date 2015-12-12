import L from 'leaflet'
import 'leaflet/dist/leaflet.css!'
import 'leaflet-loading'
import 'leaflet-loading/src/Control.Loading.css!'
import 'leaflet-groupedlayercontrol'
import 'leaflet-groupedlayercontrol/dist/leaflet.groupedlayercontrol.min.css!'
import {$} from 'minified'

import * as CovJSON from 'covjson-reader'
import LayerFactory from 'leaflet-coverage'

import Legend from 'leaflet-coverage/controls/Legend.js'
import ProfilePlot from 'leaflet-coverage/popups/VerticalProfilePlot.js'
import ParameterSync from 'leaflet-coverage/renderers/ParameterSync.js'
import * as palettes from 'leaflet-coverage/renderers/palettes.js'
import * as transform from 'leaflet-coverage/util/transform.js'
import {inject} from 'leaflet-coverage/controls/utils.js'

import UrlInput from './control.UrlInput.js'
import JSONInput from './control.JSONInput.js'

import './style.css!'

let map = L.map('map', {
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

let layerControl = L.control.groupedLayers(baseLayers, [], {collapsed: false}).addTo(map)

let layerFactory = LayerFactory()

// some initial test data to play with
let covs = ['coverages/trajectory.covjson',
            'coverages/grid.covjson',
            'coverages/grid-categorical.covjson',
            'coverages/profile.covjson'
           ]

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
  
function loadCov (url, group=undefined) {
  map.fire('dataloading')
  CovJSON.read(url).then(cov => {
    map.fire('dataload')
    console.log('Coverage loaded: ', cov)
    // add each parameter as a layer
    // TODO add support for coverage collections
    
    /*
    if (cov.parameters.has('LC')) {
      cov = transform.withCategories(cov, 'LC', [{
        "id": "http://.../landcover1/categories/grass",
        "value": 1,
        "label": new Map([["en", "Grass"]]),
        "description": new Map([["en", "Very green grass."]])
      }])
    }
    */
    
    for (let key of cov.parameters.keys()) {
      let opts = {keys: [key]}
      let layer = layerFactory(cov, opts).on('add', e => {
        let covLayer = e.target
        console.log('layer added:', covLayer)
                
        // This registers the layer with the sync manager.
        // By doing that, the palette and extent get unified (if existing)
        // and an event gets fired if a new parameter was added.
        // See the code above where ParameterSync gets instantiated.
        paramSync.addLayer(covLayer)
        
        layersOnMap.add(covLayer)
        map.fitBounds(L.latLngBounds([...layersOnMap.values()].map(l => l.getBounds())))
      }).on('remove', e => {
        let covLayer = e.target
        layersOnMap.delete(covLayer)
      }).on('dataLoading', () => map.fire('dataloading'))
        .on('dataLoad', () => map.fire('dataload'))
      

      // TODO is this a good way to do that?
      if (cov.domainType.endsWith('Profile')) {
        // we do that outside of the above 'add' handler since we want to register only once,
        // not every time the layer is added to the map
        layer.on('click', () => {
          new ProfilePlot(cov, opts).addTo(map)
        })
      }
      
      if (!group) {
        group = url
      }
      // TODO use jsonld to properly query graph (together with using cov.id as reference point)
      if (cov.ld.inCollection) {
        group += '<br />(part of <a href="' + cov.ld.inCollection.id + '">collection</a>)'
      }
      layerControl.addOverlay(layer, key, group)
    }
  }).catch(e => {
    map.fire('dataload')
    console.log(e)
    window.alert(e)
  })
}

if (window.location.hash) {
  loadCov(window.location.hash.substr(1))
} else {
  for (let url of covs) {
    loadCov(url)
  }
}

new UrlInput({
  position: 'bottomleft'
}).on('submit', e => {
  loadCov(e.url)
}).addTo(map)


const JSONInput_TEMPLATE = `
<template id="template-json-input">
  <div class="info">
    <form class="hidden">
      <textarea type="text" name="text"></textarea><br>
      <button style="margin-right: 30px">Load</button>
      <button name="example-grid">Grid</button>
      <button name="example-grid-categories">Grid (categories)</button>
      <button name="example-profile">Profile</button>
      <button name="example-trajectory">Trajectory</button>
      <br><br>
    </form>
    <button name="expand" data-collapse="Hide" data-expand="Direct Input">Direct Input</button>
  </div>
</template>
`
inject(JSONInput_TEMPLATE)

let examples = {
  'grid': 'coverages/grid.covjson',
  'grid-categories': 'coverages/grid-categorical.covjson',
  'trajectory': 'coverages/trajectory.covjson',
  'profile': 'coverages/profile.covjson'
}

let jsonInput = new JSONInput({
  id: 'template-json-input',
  position: 'bottomleft'
}).on('submit', e => {
  loadCov(e.obj, 'Direct Input')
}).addTo(map)


$.request('get', examples['grid']).then(covjson => {
  jsonInput.json = covjson
})

// add our custom button click handlers
let el = jsonInput.getContainer()

for (let name in examples){
  // we don't use CovJSON.load() here as we want to retain the original formatting 
  $.request('get', examples[name]).then(covjson => {
    let btn = $('button', el).filter(b => b.name === 'example-' + name)
    btn.on('click', () => {
      jsonInput.json = covjson
    })
  })
}

