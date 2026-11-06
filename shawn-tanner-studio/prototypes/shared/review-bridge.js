/*
 * Review bridge: lets the review studio (the outer window) talk to a
 * prototype that is shown inside a frame. It does nothing unless the page was
 * opened by the studio (?studio=1 plus a private token), so the prototypes
 * also work as ordinary web pages.
 *
 * Security: messages are accepted only from the parent window, from this
 * same origin, with the right token, and with a validated shape. Text coming
 * from the studio is only ever used as text.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (params.get('studio') !== '1') return;
  var token = params.get('token') || '';
  if (!/^[a-z0-9]{16,64}$/i.test(token)) return;
  if (window.parent === window) return;

  var CHANNEL = 'shawn-review';
  var prototypeId = document.documentElement.getAttribute('data-prototype-id') || '';
  var knownPages = ['home', 'services', 'guide'];
  var allowedMarks = ['keep', 'change', 'remove', 'favorite', 'keep-favorite', 'change-favorite', 'remove-favorite'];
  var markText = {
    'keep': '✓ Keep', 'change': '✎ Change', 'remove': '✕ Remove', 'favorite': '★ Favorite',
    'keep-favorite': '★ ✓ Keep', 'change-favorite': '★ ✎ Change', 'remove-favorite': '★ ✕ Remove'
  };

  var mode = 'browse';
  var labels = {};
  var marks = {};
  var selectedId = null;
  var hoverId = null;
  var initReceived = false;
  var layer = null;
  var drawQueued = false;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Keep the welcome window back until the studio says it is the right moment.
  if (window.ShawnDialogs) window.ShawnDialogs.setWelcomeHold(true);

  function send(type, payload) {
    var message = { channel: CHANNEL, token: token, type: type, prototypeId: prototypeId };
    Object.keys(payload || {}).forEach(function (k) { message[k] = payload[k]; });
    window.parent.postMessage(message, window.location.origin);
  }

  function currentPage() {
    var head = (window.location.hash.slice(1) || 'home').split('/')[0];
    return knownPages.indexOf(head) >= 0 ? head : 'home';
  }

  /* ---------- finding reviewable things ---------- */
  function cssEscape(value) { return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&'); }
  function elementFor(id) { return document.querySelector('[data-review-id="' + cssEscape(id) + '"]'); }

  function resolve(target) {
    if (!target || !target.closest) return { kind: 'none' };
    var hit = target.closest('[data-review-id],[data-review-excluded]');
    if (!hit) return { kind: 'none' };
    if (hit.hasAttribute('data-review-excluded')) return { kind: 'excluded', note: hit.getAttribute('data-review-excluded') };
    return { kind: 'item', element: hit, id: hit.getAttribute('data-review-id') };
  }

  function ancestorsOf(element) {
    var ids = [];
    var node = element.parentElement;
    while (node) {
      if (node.hasAttribute && node.hasAttribute('data-review-id')) ids.push(node.getAttribute('data-review-id'));
      node = node.parentElement;
    }
    return ids;
  }

  /* ---------- drawing ---------- */
  function ensureLayer() {
    if (layer && document.body.contains(layer)) return layer;
    layer = document.createElement('div');
    layer.id = 'review-layer';
    layer.setAttribute('popover', 'manual');
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    var style = document.createElement('style');
    style.textContent = [
      '#review-layer{position:fixed;inset:0;margin:0;padding:0;border:0;background:none;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:2147483647;color:inherit}',
      '#review-layer .rv-box{position:fixed;box-sizing:border-box;pointer-events:none;border-radius:3px}',
      '#review-layer .rv-hover{border:2px dashed #2f5bd3;background:rgba(47,91,211,.08)}',
      '#review-layer .rv-selected{border:3px solid #2f5bd3;background:rgba(47,91,211,.14);box-shadow:0 0 0 2px #fff}',
      '#review-layer .rv-chip{position:fixed;font:600 12px/1.2 system-ui,sans-serif;background:#2f5bd3;color:#fff;padding:4px 8px;border-radius:3px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}',
      '#review-layer .rv-mark{position:fixed;font:700 11px/1 system-ui,sans-serif;background:#fff;color:#1d2433;padding:4px 7px;border-radius:999px;border:2px solid #1d2433;box-shadow:0 1px 4px rgba(0,0,0,.3);pointer-events:none;white-space:nowrap}',
      '#review-layer .rv-mark.keep{border-color:#1c7c4d;color:#14583a}',
      '#review-layer .rv-mark.change{border-color:#a15c00;color:#7a4500}',
      '#review-layer .rv-mark.remove{border-color:#b3261e;color:#8c1d17}',
      'html.review-mode [data-review-id]:focus-visible{outline:3px solid #2f5bd3!important;outline-offset:2px}',
      'html.review-mode{cursor:crosshair}'
    ].join('');
    document.head.appendChild(style);
    return layer;
  }

  function showLayerOnTop() {
    if (!layer) return;
    if (layer.showPopover) {
      try { if (layer.matches(':popover-open')) layer.hidePopover(); layer.showPopover(); } catch (e) { /* popover unsupported: fixed layer still works */ }
    }
  }

  function visibleRect(element) {
    if (!element || !element.isConnected) return null;
    var rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    return rect;
  }

  function addBox(cls, rect, chipText) {
    var box = document.createElement('div');
    box.className = 'rv-box ' + cls;
    box.style.left = rect.left + 'px'; box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px'; box.style.height = rect.height + 'px';
    layer.appendChild(box);
    if (chipText) {
      var chip = document.createElement('div');
      chip.className = 'rv-chip';
      chip.textContent = chipText;
      var top = rect.top - 26;
      chip.style.top = (top < 2 ? rect.top + 4 : top) + 'px';
      chip.style.left = Math.max(2, Math.min(rect.left, window.innerWidth - 120)) + 'px';
      layer.appendChild(chip);
    }
  }

  function draw() {
    drawQueued = false;
    if (!layer) return;
    layer.textContent = '';
    if (mode !== 'feedback') return;

    var taken = [];
    Object.keys(marks).forEach(function (id) {
      var rect = visibleRect(elementFor(id));
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return;
      var badge = document.createElement('div');
      var kind = marks[id].split('-')[0];
      badge.className = 'rv-mark ' + (kind === 'favorite' ? '' : kind);
      badge.textContent = markText[marks[id]];
      var left = Math.max(4, rect.left + 4), top = Math.max(4, rect.top + 4);
      taken.forEach(function (t) { if (Math.abs(t.top - top) < 18 && Math.abs(t.left - left) < t.width) left = t.left + t.width + 4; });
      badge.style.left = left + 'px'; badge.style.top = top + 'px';
      layer.appendChild(badge);
      taken.push({ left: left, top: top, width: badge.offsetWidth || 80 });
    });

    if (hoverId && hoverId !== selectedId) {
      var hoverRect = visibleRect(elementFor(hoverId));
      if (hoverRect) addBox('rv-hover', hoverRect, labels[hoverId] || 'Selectable section');
    }
    if (selectedId) {
      var selectedRect = visibleRect(elementFor(selectedId));
      if (selectedRect) addBox('rv-selected', selectedRect, 'Selected: ' + (labels[selectedId] || 'section'));
    }
  }

  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    window.requestAnimationFrame(draw);
  }

  /* ---------- feedback mode behaviour ---------- */
  function makeKeyboardReachable(on) {
    document.querySelectorAll('[data-review-id]').forEach(function (element) {
      if (on) {
        if (!element.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|TEXTAREA|SELECT|DIALOG)$/.test(element.tagName)) {
          element.setAttribute('tabindex', '0');
          element.setAttribute('data-review-tab', '1');
        }
      } else if (element.getAttribute('data-review-tab') === '1') {
        element.removeAttribute('tabindex');
        element.removeAttribute('data-review-tab');
      }
    });
  }

  function setMode(next) {
    mode = next === 'feedback' ? 'feedback' : 'browse';
    document.documentElement.classList.toggle('review-mode', mode === 'feedback');
    ensureLayer();
    makeKeyboardReachable(mode === 'feedback');
    if (mode !== 'feedback') hoverId = null;
    showLayerOnTop();
    scheduleDraw();
  }

  function select(id, element) {
    selectedId = id;
    send('proto:select', { id: id, page: currentPage(), ancestors: ancestorsOf(element) });
    scheduleDraw();
  }

  function handleActivation(event) {
    if (mode !== 'feedback') return;
    var found = resolve(event.target);
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (found.kind === 'item') select(found.id, found.element);
    else if (found.kind === 'excluded') send('proto:blocked', { reason: 'excluded', note: found.note.slice(0, 200) });
    else send('proto:blocked', { reason: 'none', note: '' });
  }

  document.addEventListener('click', handleActivation, true);
  document.addEventListener('submit', function (event) { if (mode === 'feedback') { event.preventDefault(); event.stopPropagation(); } }, true);
  document.addEventListener('mousedown', function (event) {
    if (mode !== 'feedback') return;
    var found = resolve(event.target);
    if (found.kind !== 'none') event.preventDefault(); // stops fields taking focus while reviewing
  }, true);
  document.addEventListener('keydown', function (event) {
    if (mode !== 'feedback') return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    var element = event.target;
    if (!element || !element.hasAttribute || element.getAttribute('data-review-tab') !== '1') return; // native controls fire click themselves
    event.preventDefault();
    var found = resolve(element);
    if (found.kind === 'item') select(found.id, found.element);
  }, true);
  document.addEventListener('mouseover', function (event) {
    if (mode !== 'feedback') return;
    var found = resolve(event.target);
    var next = found.kind === 'item' ? found.id : null;
    if (next !== hoverId) { hoverId = next; scheduleDraw(); }
  }, true);
  document.addEventListener('mouseleave', function () { hoverId = null; scheduleDraw(); });
  window.addEventListener('scroll', scheduleDraw, true);
  window.addEventListener('resize', scheduleDraw);
  new MutationObserver(function (allRecords) {
    // Ignore our own drawing so the observer cannot trigger itself forever.
    var records = allRecords.filter(function (r) { return !(layer && layer.contains(r.target)) && r.target !== layer; });
    if (!records.length) return;
    if (mode === 'feedback') makeKeyboardReachable(true);
    scheduleDraw();
    var dialogChanged = records.some(function (r) { return r.type === 'attributes' && r.attributeName === 'open'; });
    if (dialogChanged) showLayerOnTop();
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });

  window.addEventListener('hashchange', function () {
    send('proto:page', { page: currentPage() });
    selectedId = null; hoverId = null; scheduleDraw();
  });

  /* ---------- messages from the studio ---------- */
  function isPlainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }

  function cleanLabels(source) {
    var out = {};
    if (!isPlainObject(source)) return out;
    Object.keys(source).slice(0, 600).forEach(function (key) {
      if (/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(key) && typeof source[key] === 'string') out[key] = source[key].slice(0, 120);
    });
    return out;
  }

  function cleanMarks(source) {
    var out = {};
    if (!isPlainObject(source)) return out;
    Object.keys(source).slice(0, 600).forEach(function (key) {
      if (/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(key) && allowedMarks.indexOf(source[key]) >= 0) out[key] = source[key];
    });
    return out;
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    var data = event.data;
    if (!isPlainObject(data) || data.channel !== CHANNEL || data.token !== token || typeof data.type !== 'string') return;

    switch (data.type) {
      case 'studio:init':
        initReceived = true;
        labels = cleanLabels(data.labels);
        marks = cleanMarks(data.marks);
        selectedId = null;
        setMode(data.mode);
        if (window.ShawnDialogs) window.ShawnDialogs.setWelcomeHold(!!data.holdWelcome);
        break;
      case 'studio:mode':
        setMode(data.mode);
        break;
      case 'studio:marks':
        marks = cleanMarks(data.marks);
        scheduleDraw();
        break;
      case 'studio:navigate':
        if (typeof data.page === 'string' && knownPages.indexOf(data.page) >= 0 && currentPage() !== data.page) {
          window.location.hash = '#' + data.page;
        }
        break;
      case 'studio:select':
        if (typeof data.id === 'string') {
          var element = elementFor(data.id);
          if (element) {
            if (data.reveal !== false) element.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
            select(data.id, element);
          }
        }
        break;
      case 'studio:clearSelection':
        selectedId = null; scheduleDraw();
        break;
      case 'studio:openWindow':
        if (window.ShawnDialogs && ['welcome', 'consult', 'privacy', 'none'].indexOf(data.name) >= 0) window.ShawnDialogs.open(data.name);
        break;
      case 'studio:holdWelcome':
        if (window.ShawnDialogs) window.ShawnDialogs.setWelcomeHold(!!data.hold);
        break;
      default:
        break;
    }
  });

  /* ---------- announce readiness (retry until the studio answers) ---------- */
  var tries = 0;
  function announce() {
    send('proto:ready', { page: currentPage() });
    tries += 1;
    if (!initReceived && tries < 25) window.setTimeout(announce, 300);
    else if (!initReceived && window.ShawnDialogs) window.ShawnDialogs.setWelcomeHold(false);
  }
  window.StudioBridge = { active: true };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce); else announce();
})();
