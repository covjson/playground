import L from 'leaflet'
import * as monaco from 'monaco-editor'
import jsonCompactStringify from 'json-stringify-pretty-compact'

import 'font-awesome/css/font-awesome.css'

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

    monaco.languages.json.jsonDefaults.setModeConfiguration({
      documentFormattingEdits: false,
      documentRangeFormattingEdits: false,
      completionItems: true,
      hovers: true,
      documentSymbols: false,
      tokens: true,
      colors: true,
      foldingRanges: true,
      diagnostics: true,
      selectionRanges: true
    })

    // a made up unique URI for our model
    const modelUri = monaco.Uri.parse('a://b/sample.covjson')

    const model = monaco.editor.createModel('{}', 'json', modelUri)

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

    monaco.languages.registerDocumentFormattingEditProvider('json', {
      provideDocumentFormattingEdits(model, options, token) {
        return [
          {
            range: model.getFullModelRange(),
            text: compactStringify(JSON.parse(model.getValue())),
          },
        ]
      }
    })
  
    const loadFromUrlCommandId = this.monacoEditor.addCommand(
      0,
      () => {
        const url = window.prompt('URL:')
        if (url !== null) {
          this.loadFromUrl(url)
        }
      },
      ''
    );

    monaco.languages.registerCodeLensProvider('json', {
      provideCodeLenses: (model, token) => ({
        lenses: [
          {
            range: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 2,
              endColumn: 1
            },
            command: {
              id: loadFromUrlCommandId,
              title: 'Load from URL...'
            }
          }
        ],
        dispose: () => {}
      }),
      resolveCodeLens: (model, codeLens, token) => codeLens
    })

    this.monacoEditor.addAction({
      id: 'change-json-schema',
      label: 'Change JSON Schema...',
      contextMenuGroupId: 'covjson',
    
      run: () => {
        const url = window.prompt('JSON Schema URL:')
        if (url !== null) {
          this.loadJsonSchema(url)
        }
      }
    })

    window.monacoEditor = this.monacoEditor
  }
  
  set json (val) {
    this.monacoEditor.setValue(val)
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
    this._setMonacoMarkers([msg])
  }

  clearError() {
    this._setMonacoMarkers([])
  }

  _setMonacoMarkers(msgs) {
    monaco.editor.setModelMarkers(
      this.monacoEditor.getModel(), 'custom', msgs.map(msg => ({
        severity: monaco.MarkerSeverity.Error,
        message: msg,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1
      })))
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
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemaValidation: 'error',
      schemas: [
        {
          uri: 'https://dummy/schema.json',
          fileMatch: ['*'],
          schema: schema
        },
      ]
    });
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
