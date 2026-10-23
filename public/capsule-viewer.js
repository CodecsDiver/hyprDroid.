/* Time Capsule viewer.
 *
 * Runs inside <iframe sandbox="allow-scripts"> (opaque origin). It receives the
 * archived document from the parent app via postMessage, and renders it in a
 * nested sandboxed iframe. The archived bytes are never modified or stored here.
 *
 * Compatibility shim: the legacy apps call localStorage at start-up, which
 * throws in an opaque origin. A small in-memory Storage stand-in is injected
 * just after <head> at RENDER time only, so the originals run and their state
 * stays inside the capsule instead of leaking into the real app.
 */
;(function () {
  'use strict'
  var SHIM =
    '<script>(function(){function m(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}' +
    "['localStorage','sessionStorage'].forEach(function(n){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(e){}})})();</script>"

  function withShim(html) {
    var head = /<head(\s[^>]*)?>/i.exec(html)
    if (head) return html.slice(0, head.index + head[0].length) + SHIM + html.slice(head.index + head[0].length)
    var root = /<html(\s[^>]*)?>/i.exec(html)
    if (root) return html.slice(0, root.index + root[0].length) + SHIM + html.slice(root.index + root[0].length)
    var doctype = /^\s*<!doctype[^>]*>/i.exec(html)
    return doctype ? doctype[0] + SHIM + html.slice(doctype[0].length) : SHIM + html
  }

  var frame = null
  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return
    var data = event.data
    if (!data || data.type !== 'load' || typeof data.html !== 'string') return
    if (frame) frame.remove()
    frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    frame.setAttribute('allow', 'autoplay')
    frame.setAttribute('title', typeof data.title === 'string' ? data.title.slice(0, 120) : 'Archived page')
    frame.srcdoc = withShim(data.html)
    document.body.appendChild(frame)
  })

  window.parent.postMessage({ type: 'ready' }, '*')
})()
