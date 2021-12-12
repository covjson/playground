import L from 'leaflet'
import * as monaco from 'monaco-editor'

import 'font-awesome/css/font-awesome.css'

import CovJSONSchema from './covjson.schema.json'

let TEMPLATES = {
  MENU: `
  <button class="collapse-button" title="Collapse"><class class="fa fa-caret-up"></class></button>
  <div class="buttons">
    <button title="JSON Source" id="json-pane-button" class="active"><span class="fa fa-code"></span><span> JSON</span></button> 
    <button title="Help" id="help-pane-button"><span class="fa fa-question"></span><span> Help</span></button>
  </div>`,
  HELP: `Help text...`
}

export default class Editor extends L.Class {
  
  constructor (options) {
    super()
    this.container = options.container
    
    this._globalErrors = []
    
    this._createMenu()
    this._createJSONEditor()
    this._createHelpPane()
  }
  
  _createMenu () {
    let el = document.createElement('div')
    el.className = 'top'
    this.container.appendChild(el)
    
    el.innerHTML = TEMPLATES.MENU
      
    let jsonButton = document.getElementById('json-pane-button')
    jsonButton.addEventListener('click', () => {
      this.helpPane.style.display = 'none'
      this.monacoPane.style.display = 'block'
      jsonButton.className = 'active'
      helpButton.className = ''
    })
    
    let helpButton = document.getElementById('help-pane-button')
    helpButton.addEventListener('click', () => {
      this.helpPane.style.display = 'block'
      this.monacoPane.style.display = 'none'
      jsonButton.className = ''
      helpButton.className = 'active'
    })
    
    let collapseButton = el.getElementsByClassName('collapse-button')[0]
    collapseButton.addEventListener('click', () => {
      document.body.className = document.body.className === 'fullscreen' ? '' : 'fullscreen'
      this.fire('resize')
    })
  }
  
  _createHelpPane () {
    let el = document.createElement('div')
    el.className = 'pane'
    el.style.display = 'none'
    this.container.appendChild(el)
    this.helpPane = el
    
    el.innerHTML = TEMPLATES.HELP
  }
  
  _createJSONEditor () {
    let el = document.createElement('div')
    el.className = 'pane'
    this.container.appendChild(el)
    this.monacoPane = el

    // a made up unique URI for our model
    const modelUri = monaco.Uri.parse('a://b/foo.json')

    const model = monaco.editor.createModel('', 'json', modelUri)

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemaValidation: 'error',
      schemas: [
        {
          uri: 'https://covjson.org/schema.json',
          fileMatch: [modelUri.toString()],
          schema: JSON.parse(CovJSONSchema)
        },
      ]
    });

    this.monacoEditor = monaco.editor.create(el, {
      model: model,
      automaticLayout: true,
      hover: { above: false },
      minimap: { enabled: false },
      hideCursorInOverviewRuler: true,
      guides: { indentation: false },
      //fixedOverflowWidgets: true
    })

    this.monacoEditor.onDidChangeModelContent(e => {
      const text = this.monacoEditor.getValue()
      let obj
      try {
        obj = JSON.parse(text)
      } catch (e) {}
      if (obj) {
        this.fire('change', {json: text, obj: obj})
      }
    })
  }
  
  load (url) {
    fetch(url)
      .then(checkStatus)
      .then(response => response.text())
      .then(prettifyJSON)
      .then(json => {
        this.json = json
      }).catch(e => {
        console.log(e)
      })
  }
  
  set json (val) {
    this.monacoEditor.setValue(val)
  }
  
  addError (msg) {
    // TODO: add error to monaco editor
    this._globalErrors.push(msg)
  }
  
  clearErrors () {
    this._globalErrors = []
  }
}

function checkStatus (response) {
  if (response.status >= 200 && response.status < 300) {
    return response
  } else {
    var error = new Error(response.statusText)
    error.response = response
    throw error
  }
}

/**
 * Indents the JSON if it is all in a single line.
 */
function prettifyJSON (json) {
  let maxLength = 100*1024 // 100 KiB
  let lineCount = json.split(/\r\n|\r|\n/).length
  if (lineCount > 2 || json.length > maxLength) {
    // either already prettyprinted or too big
    return json
  }
  let obj
  try {
    obj = JSON.parse(json)
  } catch (e) {
    // syntax error, don't prettyprint
    return json
  }
  return JSON.stringify(obj, null, 2)
}

Editor.include(L.Mixin.Events)
