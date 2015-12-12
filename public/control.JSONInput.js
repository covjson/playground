import L from 'leaflet'
import {$} from 'minified'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'
import 'codemirror/lib/codemirror.css!'
// lint not working for some reason
/*
import 'codemirror/addon/lint/lint.js'
import 'codemirror/addon/lint/lint.css!'
import jsonlint from 'github:josdejong/jsonlint@master'
import 'codemirror/addon/lint/json-lint.js'
window.jsonlint = jsonlint
*/

import {inject} from 'leaflet-coverage/controls/utils.js'


const DEFAULT_TEMPLATE_ID = 'template-textarea-input'
const DEFAULT_TEMPLATE = `
<template id="${DEFAULT_TEMPLATE_ID}">
  <div class="info">
    <form class="hidden">
      <textarea type="text" name="text"></textarea><br>
      <button>Load</button><br><br>
    </form>
    <button name="expand" data-collapse="Hide" data-expand="Direct Input">Direct Input</button>
  </div>
</template>
`

const DEFAULT_TEMPLATE_CSS = `
.hidden {
  display: none;
}
`

/**
 * A text area input with submit button.
 */
class JSONInput extends L.Control {
  
  constructor (options) {
    super(options.position ? {position: options.position} : {})
    this.callback = options.callback
    this.id = options.id || DEFAULT_TEMPLATE_ID
    this.initialJSON = options.json || ''
    this.width = options.width || '400px'
    this.height = options.height || '300px'
    
    if (!options.id && document.getElementById(DEFAULT_TEMPLATE_ID) === null) {
      inject(DEFAULT_TEMPLATE)
    }
    // always inject the .hidden class
    inject(null, DEFAULT_TEMPLATE_CSS)
  }
  
  onAdd (map) {
    let el = document.importNode($('#' + this.id)[0].content, true).children[0]
    L.DomEvent.disableClickPropagation(el)
    L.DomEvent.disableScrollPropagation(el)
    
    let textarea = $('textarea', el)
    textarea.set({
      'value': this.initialJSON,
      '$width': this.width,
      '$height': this.height
    })
    
    let cm = CodeMirror.fromTextArea(textarea[0]
    // lint not working for some reason
    /*,{
      mode: 'application/json',
      gutters: ['CodeMirror-lint-markers'],
      lint: true
    }*/)
    this.cm = cm
    
    $('form', el).on('submit', () => {
      cm.save()
      let text = textarea.get('value')
      $('form', el).set('-hidden')
      try {
        let obj = JSON.parse(text)
        this.fire('submit', {json: text, obj: obj})
      } catch (e) {
        window.alert(e.message)
      }
    })
    
    let expandBtn = $('button', el).filter(b => b.name === 'expand')
    expandBtn.on('click', () => {
      $('form', el).set('hidden')
      if ($('form', el).get('$$show')) {
        expandBtn.fill(expandBtn.get('@data-collapse'))
        cm.refresh()
      } else {
        expandBtn.fill(expandBtn.get('@data-expand'))
      }
    })
    
    return el
  }
  
  set json (val) {
    this.cm.setValue(val)
  }
}

JSONInput.include(L.Mixin.Events)

//work-around for transpiler bug, otherwise class cannot be referenced above
export { JSONInput as default }
