import L from 'leaflet'
import jsonCompactStringify from 'json-stringify-pretty-compact'

import 'font-awesome/css/font-awesome.css'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/eclipse.css'
import 'codemirror/addon/lint/lint.js'
import 'codemirror/addon/lint/lint.css'
import 'codemirror/addon/scroll/scrollpastend.js'
import 'codemirror/addon/edit/matchbrackets.js'

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
    if (options.url) {
      this.loadFromUrl(options.url)
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
      scrollPastEnd: true,
      theme: 'eclipse',
      mode: 'application/json',
      gutters: ['CodeMirror-lint-markers'],
      lint: this._getAnnotations.bind(this),
    })
    this.cm = cm
    
    cm.on('change', () => {
      let text = cm.getValue()
      if (this._getAnnotations(text).length == 0) {
        this.fire('change', {text})
      }
    })

    cm.on('beforeChange', (cm, change) => {
      if (change.origin !== 'paste')
        return
      if (change.from.line !== 0 || change.from.ch !== 0) 
        return
      if (change.to.line !== cm.lastLine()) 
        return
      let text = change.text.join('\n')
      text = maybePrettifySingleLineJSON(text)
      change.text = text.split('\n')
    })
  }

  _getAnnotations(text) {
    let found = []

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
          const pointer = sourceMap.pointers[error.instancePath]
          let fromLine = pointer.value.line
          let toLine = pointer.valueEnd.line
          let fromCol = pointer.value.column
          let toCol = pointer.valueEnd.column
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

    found = pruneAnnotations(found)

    return found;
  }
  
  set json (val) {
    this.cm.setValue(val)
  }

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

  async loadJsonSchema(url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        const reason = `${response.status} ${response.statusText}`
        throw new Error(reason)
      }
      const schema = await response.json()
      this.setJsonSchema(schema)
    } catch (err) {
      const msg = `Error loading JSON schema: ${err.message}\nURL: ${url}`
      console.error(err)
      window.alert(msg)
    }
  }

  setJsonSchema(schema) {
    this.ajv = new Ajv({
      allErrors: true,
    })
    this.ajvValidate = this.ajv.compile(schema)
  }
}

Editor.include(L.Mixin.Events)

function pruneAnnotations(annotations){
  const pruned = []

  // Skip JSON schema errors that are too technical to be useful,
  // since they are typically accompanied by other more useful errors.
  for (const annotation of annotations) {
    const msg = annotation.message
    if (/must match ".+" schema/.test(msg))
      continue
    if (/must match exactly one schema in/.test(msg))
      continue
    pruned.push(annotation)
  }

  // Remove annotations that "contain" other annotations.
  // The inner annotations are usually more useful.
  for (let i = 0; i < pruned.length; i++) {
    const annotation = pruned[i]
    for (let j = 0; j < pruned.length; j++) {
      if (i == j)
        continue
      const other = pruned[j]
      if (annotation.from.line < other.from.line &&
          annotation.to.line > other.to.line) {
        pruned.splice(i, 1)
        i--
        break
      }
    }
  }

  // Fall-back to input in case too much was pruned.
  if (pruned.length == 0)
    return annotations
  
  return pruned
}

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
