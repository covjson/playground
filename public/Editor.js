import 'fetch'
import L from 'leaflet'

import 'font-awesome/css/font-awesome.css!'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'
import 'codemirror/lib/codemirror.css!'
import 'codemirror/theme/eclipse.css!'

import 'codemirror/addon/lint/lint.js'
import 'codemirror/addon/lint/lint.css!'
import jsonlint from 'jsonlint'
import 'codemirror/addon/lint/json-lint.js'
window.jsonlint = jsonlint.parser

let TEMPLATES = {
  MENU: `
  <button class="collapse-button" title="Collapse"><class class="fa fa-caret-up"></class></button>
  <div class="buttons">
    <button title="JSON Source" id="json-pane-button" class="active"><span class="fa fa-code"></span><span> JSON</span></button> 
    <button title="Help" id="help-pane-button"><span class="fa fa-question"></span><span> Help</span></button>
  </div>`,
  HELP: `Help text...`
}

class Editor extends L.Class {
  
  constructor (options) {
    super()
    this.container = options.container
    
    this._globalErrors = []
    this._wrapLinter()
    
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
      this.cmPane.style.display = 'block'
      jsonButton.className = 'active'
      helpButton.className = ''
      this.cm.refresh()
    })
    
    let helpButton = document.getElementById('help-pane-button')
    helpButton.addEventListener('click', () => {
      this.helpPane.style.display = 'block'
      this.cmPane.style.display = 'none'
      jsonButton.className = ''
      helpButton.className = 'active'
    })
    
    let collapseButton = el.getElementsByClassName('collapse-button')[0]
    collapseButton.addEventListener('click', () => {
      document.body.className = document.body.className === 'fullscreen' ? '' : 'fullscreen'
      this.fire('resize')
      this.cm.refresh()
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
    this.cmPane = el
        
    let cm = CodeMirror(el,{
      lineNumbers: true,
      matchBrackets: true,
      theme: 'eclipse',
      
      mode: 'application/json',
      gutters: ['CodeMirror-lint-markers'],
      lint: true
    })
    this.cm = cm
    
    cm.on('change', () => {
      let text = cm.getValue()
      try {
        let obj = JSON.parse(text)
        this.fire('change', {json: text, obj: obj})
      } catch (e) {
        console.log(e.message)
      }
    })    
  }
  
  load (url) {
    fetch(url)
      .then(checkStatus)
      .then(response => response.text())
      .then(json => {
        this.json = json
      }).catch(e => {
        console.log(e)
      })
  }
  
  set json (val) {
    this.cm.setValue(val)
  }
  
  addError (msg) {
    this._globalErrors.push(msg)
  }
  
  clearErrors () {
    this._globalErrors = []
  }
  
  _wrapLinter () {
    let jsonlinter = CodeMirror.helpers.lint.json
    
    let wrapped = text => {
      let jsonlintResult = jsonlinter(text)
      if (jsonlintResult.length > 0) {
        return jsonlintResult
      } else {
        if (this._globalErrors.length > 0) {
          let err = this._globalErrors[0]
          this.clearErrors()
          return [{
            message: err,
            from: CodeMirror.Pos(0, 0),
            to: CodeMirror.Pos(0, 0)
          }]
        }
      }
    }
    CodeMirror.helpers.lint.json = wrapped
  }
}

function checkStatus(response) {
  if (response.status >= 200 && response.status < 300) {
    return response
  } else {
    var error = new Error(response.statusText)
    error.response = response
    throw error
  }
}

Editor.include(L.Mixin.Events)

//work-around for transpiler bug, otherwise class cannot be referenced above
export { Editor as default }
