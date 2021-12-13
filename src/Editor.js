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

    const model = monaco.editor.createModel('{}', 'json', modelUri)

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
      this.fire('change', {text})
    })

    window.monacoEditor = this.monacoEditor
  }
  
  set json (val) {
    this.monacoEditor.setValue(val)
  }
}

Editor.include(L.Mixin.Events)
