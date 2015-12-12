import L from 'leaflet'
import {$} from 'minified' 

import {inject} from 'leaflet-coverage/controls/utils.js'

const DEFAULT_TEMPLATE_ID = 'template-url-input'
const DEFAULT_TEMPLATE = `
<template id="${DEFAULT_TEMPLATE_ID}">
  <div class="info">
    <form>
      <input type="text" name="url" placeholder="http://..." />
      <button>Load</button>
    </form>
  </div>
</template>
`

/**
 * A simple URL input field with submit button.
 */
class UrlInput extends L.Control {
  
  constructor (options) {
    super(options.position ? {position: options.position} : {})
    this.callback = options.callback
    this.id = options.id || DEFAULT_TEMPLATE_ID
    
    if (!options.id && document.getElementById(DEFAULT_TEMPLATE_ID) === null) {
      inject(DEFAULT_TEMPLATE, null)
    }
  }
  
  onAdd (map) {
    let el = document.importNode($('#' + this.id)[0].content, true).children[0]
    L.DomEvent.disableClickPropagation(el)
    $('form', el).on('submit', () => {
      let url = $('input', el).get('value')
      this.fire('submit', {url: url})
    })    
    return el
  }
    
}

UrlInput.include(L.Mixin.Events)

//work-around for transpiler bug, otherwise class cannot be referenced above
export { UrlInput as default }
