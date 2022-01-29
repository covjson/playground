import L from 'leaflet'
import jsonCompactStringify from 'json-stringify-pretty-compact'

import 'font-awesome/css/font-awesome.css'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/eclipse.css'
import 'codemirror/addon/lint/lint.js'
import 'codemirror/addon/lint/lint.css'

import jsonlint from 'jsonlint-mod'
import Ajv from 'ajv'
import jsonSourceMap from 'json-source-map'

let TEMPLATES = {
  MENU: `
  <button class="collapse-button" title="Collapse"><span class="fa fa-caret-up"></span></button>
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

    if (options.schemaUrl) {
      this.loadJsonSchema(options.schemaUrl)
    }
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
    
    let collapseButton = el.querySelector('.collapse-button')
    collapseButton.addEventListener('click', () => {
      const isCollapsed = document.body.className === 'fullscreen'
      document.body.className = isCollapsed ? '' : 'fullscreen'
      const icon = collapseButton.querySelector('span')
      if (isCollapsed) {
        icon.classList.replace('fa-caret-down', 'fa-caret-up')
      } else {
        icon.classList.replace('fa-caret-up', 'fa-caret-down')
      }
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
      lint: {
        getAnnotations: this._getAnnotations.bind(this)
      }
    })
    this.cm = cm
    
    cm.on('change', () => {
      let text = cm.getValue()
      let obj
      try {
        obj = JSON.parse(text)
      } catch (e) {}
      if (obj) {
        this.fire('change', {text})
      }
    })
  }

  _getAnnotations(text) {
    const found = []

    // adapted from codemirror/addon/lint/json-lint.js
    const jsonlint_ = jsonlint.parser
    const oldParseError = jsonlint_.parseError
    jsonlint_.parseError = (str, hash) => {
      var loc = hash.loc
      found.push({from: CodeMirror.Pos(loc.first_line - 1, loc.first_column),
                  to: CodeMirror.Pos(loc.last_line - 1, loc.last_column),
                  message: str})
    }
    try {
      jsonlint_.parse(text)
    }
    catch(e) {}
    jsonlint_.parseError = oldParseError

    if (found.length) {
      return found
    }

    if (this.ajvValidate) {
      const obj = JSON.parse(text)
      const valid = this.ajvValidate(obj)
      if (!valid) {
        // ajv returns JSON Pointer
        // json-source-map converts to line/column
        // https://github.com/ajv-validator/ajv/issues/763
        const sourceMap = jsonSourceMap.parse(text)
        for (const error of this.ajvValidate.errors) {
          let fromLine = 0
          let toLine = 0
          let fromCol = 0
          let toCol = 1
          if (error.instancePath !== '') {
            const pointer = sourceMap.pointers[error.instancePath]
            fromLine = pointer.value.line
            toLine = pointer.valueEnd.line
            fromCol = pointer.value.column
            toCol = pointer.valueEnd.column
          }
          const msg = this.ajv.errorsText([error], {dataVar: ''})
          found.push({
            message: msg,
            from: CodeMirror.Pos(fromLine, fromCol),
            to: CodeMirror.Pos(toLine, toCol),
          })
        }
      }
    }

    if (this._globalErrors.length) {
      let err = this._globalErrors[0]
      this.clearError()
      found.push({
        message: err,
        from: CodeMirror.Pos(0, 0),
        to: CodeMirror.Pos(0, 0)
      })
    }

    return found;
  }
  
  set json (val) {
    this.cm.setValue(val)
  }

  // TODO expose in UI
  async loadFromUrl(url) {
    let text
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(response.statusText)
      }
      text = await response.text()
    } catch (e) {
      window.alert('Download error: ' + e.message + '\n\n' + url)
      return
    }
    text = maybePrettifySingleLineJSON(text)
    this.json = text
  }

  setError(msg) {
    this._globalErrors = [msg]
  }

  clearError() {
    this._globalErrors = []
  }

  loadJsonSchema(url) {
    fetch(url).then(response => {
      if (!response.ok) {
        const reason = `${response.status} ${response.statusText}`
        throw new Error(reason)
      }
      return response.json()
    }).then(schema => {
      this.setJsonSchema(schema)
    }).catch(err => {
      const msg = `Error loading JSON schema: ${err.message}\nURL: ${url}`
      console.error(err)
      window.alert(msg)
    })
  }

  setJsonSchema(schema) {
    this.ajv = new Ajv({
      allErrors: false,
    })
    this.ajvValidate = this.ajv.compile(schema)
  }
}

Editor.include(L.Mixin.Events)

/**
 * Indents the JSON if it is all in a single line.
 */
 function maybePrettifySingleLineJSON(json) {
  let maxLength = 100*1024 // 100 KiB
  if (json.length > maxLength) {
    // too big
    return json
  }
  let lineCount = (json.match(/\n/g) || '').length
  if (lineCount > 2) {
    // already prettyprinted
    return json
  }
  let obj
  try {
    obj = JSON.parse(json)
  } catch (e) {
    // syntax error, don't prettyprint
    return json
  }
  return compactStringify(obj)
}

function compactStringify(obj) {
  return jsonCompactStringify(obj, {
    indent: 2,
    maxLength: 60
  })
}
