import L from 'leaflet'

export default class FileMenu extends L.Class {
  constructor (options) {
    super()
    this.container = options.container
    
    let actions = [{
      title: 'Examples',
      children: options.examples.map(({title, url}) => ({
        title,
        action: () => {
          this.fire('requestload', {url})
        }
      }))
    }]
    this._createMenu(actions)
  }
  
  _createMenu (actions) {
    let el = document.createElement('div')
    el.className = 'inline'
    this.container.appendChild(el)
    
    let tabindex = 0
    for (let {title, action, children} of actions) {
      let item = document.createElement('div')
      item.className = 'item'
      item.setAttribute('tabindex', tabindex) // necessary for :focus to work
      el.appendChild(item)
      
      let a = document.createElement('a')
      item.appendChild(a)
      a.className = 'parent'
      a.innerHTML = ' ' + title
      
      if (action) {
        a.addEventListener('click', action)        
      }
      if (children) {
        let childrenEl = document.createElement('div')
        item.appendChild(childrenEl)
        childrenEl.className = 'children'
        
        for (let child of children) {
          let a = document.createElement('a')
          childrenEl.appendChild(a)
          a.innerHTML = child.title
          a.addEventListener('click', child.action)
        }
      }
      ++tabindex
    }
  }
}

FileMenu.include(L.Mixin.Events)
