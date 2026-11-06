// Wires the review studio together: toolbar, preview panes, review panel, tour and dialogs.

import { el, clear, formatDateTime } from './dom.js';
import { PROTOTYPES, PAGES, findPrototype, designName, pageLabel } from './config.js';
import { catalogItem, labelMapFor } from './catalog.js';
import { describeRecord } from './records.js';
import { ReviewStore } from './store.js';
import { markFor } from './analysis.js';
import { PreviewPane } from './preview.js';
import { ReviewPanel } from './panel.js';
import { Tour } from './tour.js';
import { INFO_CARDS, TOUR_STEPS } from './help-content.js';
import { readAndCheck, previewImport, MAX_IMPORT_BYTES } from './importer.js';
import { buildJson, downloadFile, dateStamp } from './exporter.js';

/* ---------- remembered studio preferences (not review notes) ---------- */
const UI_KEY = 'shawnStudio.ui.v1';
function loadUi() {
  try { return JSON.parse(window.localStorage.getItem(UI_KEY)) || {}; } catch (error) { return {}; }
}
const ui = loadUi();
function saveUi() {
  try { window.localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (error) { /* preferences just won't be remembered */ }
}

const store = new ReviewStore();
const state = {
  mode: 'browse',
  compare: false,
  pair: ['p1', 'p2'],
  design: findPrototype(ui.design) ? ui.design : 'p1',
  together: ui.together === true,
  side: ui.side === 'left' ? 'left' : 'right',
  activeSlot: 'a',
  mobileSlot: 'a',
  holdWelcome: !ui.tourDone,
  pendingSelect: null
};

const $ = (id) => document.getElementById(id);
const panesEl = $('panes');
const panelEl = $('review-panel');

const isNarrow = () => window.matchMedia('(max-width: 820px)').matches;

/* ---------- announcements ---------- */
function announce(text) {
  const live = $('announcer');
  live.textContent = '';
  window.setTimeout(() => { live.textContent = text; }, 50);
}

/* ---------- information cards ---------- */
let infoOwner = null;
const infoCard = $('info-card');

function closeInfo(returnFocus) {
  if (!infoOwner) return;
  infoOwner.setAttribute('aria-expanded', 'false');
  const owner = infoOwner;
  infoOwner = null;
  infoCard.hidden = true;
  clear(infoCard);
  if (returnFocus) owner.focus();
}

function openInfo(button, key) {
  closeInfo(false);
  const card = INFO_CARDS[key];
  infoOwner = button;
  button.setAttribute('aria-expanded', 'true');
  clear(infoCard);
  infoCard.append(
    el('strong', { text: card.title }),
    el('p', { text: card.body }),
    el('button', { type: 'button', class: 'btn small', onClick: () => closeInfo(true) }, 'Got it'));
  infoCard.hidden = false;
  const rect = button.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 16);
  infoCard.style.width = `${width}px`;
  infoCard.style.left = `${Math.max(8, Math.min(rect.left - 8, window.innerWidth - width - 8))}px`;
  let top = rect.bottom + 8;
  if (top + infoCard.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - infoCard.offsetHeight - 8);
  infoCard.style.top = `${top}px`;
}

function makeInfoButton(key) {
  const card = INFO_CARDS[key];
  const button = el('button', { type: 'button', class: 'info-btn', 'aria-label': `About: ${card.title}`, 'aria-expanded': 'false', title: card.title });
  button.textContent = 'i';
  button.addEventListener('click', () => { if (infoOwner === button) closeInfo(true); else openInfo(button, key); });
  return button;
}

document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && infoOwner) { event.stopPropagation(); closeInfo(true); } }, true);
document.addEventListener('pointerdown', (event) => {
  if (infoOwner && !infoCard.contains(event.target) && !infoOwner.contains(event.target)) closeInfo(false);
});
$('design-info-slot').append(makeInfoButton('design'));
$('page-info-slot').append(makeInfoButton('page'));
$('mode-info-slot').append(makeInfoButton('mode'));
$('compare-info-slot').append(makeInfoButton('compare'));
$('together-info-slot').append(makeInfoButton('together'));

/* ---------- preview panes ---------- */
const paneA = new PreviewPane({ slot: 'a', onMessage: handlePaneMessage });
const paneB = new PreviewPane({ slot: 'b', onMessage: handlePaneMessage });
panesEl.append(paneA.root, paneB.root);
const panes = [paneA, paneB];

window.addEventListener('message', (event) => { panes.some((pane) => pane.handle(event)); });

function activePanes() { return state.compare ? [paneA, paneB] : [paneA]; }

function marksFor(prototypeId) {
  const marks = {};
  store.all().forEach((record) => {
    if (record.kind !== 'element' || record.prototypeId !== prototypeId) return;
    const mark = markFor(record);
    if (mark) marks[record.elementId] = mark;
  });
  return marks;
}

function sendInit(pane) {
  pane.send('studio:init', {
    mode: state.mode,
    labels: labelMapFor(pane.prototypeId),
    marks: marksFor(pane.prototypeId),
    holdWelcome: state.holdWelcome
  });
}

function otherPane(pane) { return pane === paneA ? paneB : paneA; }

function handlePaneMessage(pane, message) {
  switch (message.type) {
    case 'proto:ready':
      sendInit(pane);
      syncPageControls();
      if (state.pendingSelect && state.pendingSelect.prototypeId === pane.prototypeId) runPendingSelect(pane);
      break;
    case 'proto:page':
      state.activeSlot = pane.slot;
      if (state.compare && state.together && otherPane(pane).page !== message.page) otherPane(pane).setPage(message.page);
      syncPageControls();
      break;
    case 'ui:page':
      state.activeSlot = pane.slot;
      pane.setPage(message.page);
      if (state.compare && state.together) otherPane(pane).setPage(message.page);
      syncPageControls();
      break;
    case 'proto:select':
      state.activeSlot = pane.slot;
      if (state.compare) otherPane(pane).send('studio:clearSelection');
      panel.showElement(pane.prototypeId, message.id, message.page, message.ancestors);
      tour.notify('selected');
      break;
    case 'proto:blocked':
      panel.showBlocked(message.reason === 'excluded' ? `That part can’t be selected: ${message.note || 'it is left out on purpose.'}` : 'Nothing to select at that spot. Try the section around it.');
      break;
    default:
      break;
  }
}

/* ---------- toolbar: design, page, mode ---------- */
const toolbar = document.querySelector('.toolbar');
const toolbarToggle = $('toolbar-toggle');
function setControlsCollapsed(collapsed) {
  toolbar.classList.toggle('collapsed', collapsed);
  toolbarToggle.setAttribute('aria-expanded', String(!collapsed));
  toolbarToggle.textContent = collapsed ? 'Controls ▾' : 'Controls ▴';
}
toolbarToggle.addEventListener('click', () => setControlsCollapsed(!toolbar.classList.contains('collapsed')));
const designPicker = $('design-picker');
PROTOTYPES.forEach((proto) => {
  designPicker.append(el('button', {
    type: 'button', 'data-design': proto.id, 'aria-pressed': 'false', title: `${proto.name}: ${proto.summary}`,
    onClick: () => setDesign(proto.id)
  }, el('span', { class: 'seg-number', text: String(proto.number) }), el('span', { class: 'seg-name', text: ` ${proto.name}` })));
});

const pageSelect = $('page-select');
PAGES.forEach((page) => pageSelect.append(el('option', { value: page.id, text: page.label })));
pageSelect.addEventListener('change', () => setPage(pageSelect.value));

function setDesign(id) {
  if (state.compare) return;
  state.design = id;
  ui.design = id; saveUi();
  paneA.load(id, paneA.page);
  panel.clearTarget();
  syncControls();
  announce(`Showing ${designName(id)}.`);
}

function setPage(pageId) {
  state.activeSlot = 'a';
  if (state.compare && state.together) panes.forEach((pane) => pane.setPage(pageId));
  else paneA.setPage(pageId);
  syncPageControls();
}

function setMode(mode) {
  state.mode = mode === 'feedback' ? 'feedback' : 'browse';
  $('mode-browse').setAttribute('aria-pressed', String(state.mode === 'browse'));
  $('mode-feedback').setAttribute('aria-pressed', String(state.mode === 'feedback'));
  document.body.dataset.mode = state.mode;
  activePanes().forEach((pane) => pane.send('studio:mode', { mode: state.mode }));
  // Browsing gets the whole page; the review panel comes back when feedback mode starts.
  // On a phone the panel stays tucked away until something is selected, so the page is still reachable.
  if (state.mode === 'browse' || isNarrow()) panel.setCollapsed(true); else panel.open();
  if (panel.tab === 'selected') panel.showTab('selected');
  announce(state.mode === 'feedback' ? 'Leave feedback mode is on. Click a part of the website to select it.' : 'Browse mode is on. The website works normally.');
}
$('mode-browse').addEventListener('click', () => setMode('browse'));
$('mode-feedback').addEventListener('click', () => setMode('feedback'));

function syncPageControls() {
  const leading = state.compare && state.together ? (state.activeSlot === 'b' ? paneB : paneA) : paneA;
  pageSelect.value = leading.page;
}

function syncControls() {
  designPicker.querySelectorAll('[data-design]').forEach((button) => {
    button.setAttribute('aria-pressed', String(!state.compare && button.getAttribute('data-design') === state.design));
  });
  designPicker.hidden = state.compare;
  const summary = $('compare-summary');
  summary.hidden = !state.compare;
  clear(summary);
  if (state.compare) {
    summary.append(el('span', { text: `Comparing ${designName(state.pair[0]).split(' · ')[0]} and ${designName(state.pair[1]).split(' · ')[0]}` }));
  }
  $('page-group').hidden = state.compare && !state.together;
  paneA.setPageSelectVisible(state.compare && !state.together);
  paneB.setPageSelectVisible(state.compare && !state.together);
  paneB.root.hidden = !state.compare;
  panesEl.dataset.compare = String(state.compare);
  document.body.dataset.compare = String(state.compare);
  $('compare-button').textContent = state.compare ? 'Stop comparing' : 'Compare two designs';
  $('together').disabled = !state.compare;
  $('together').checked = state.together;
  $('together-label').classList.toggle('disabled', !state.compare);
  renderMobileTabs();
  syncPageControls();
}

/* ---------- comparison ---------- */
const chooser = $('compare-chooser');
const compareButton = $('compare-button');

function closeChooser() {
  chooser.hidden = true;
  compareButton.setAttribute('aria-expanded', 'false');
}

function openChooser() {
  clear(chooser);
  const checks = PROTOTYPES.map((proto) => {
    const input = el('input', { type: 'checkbox', value: proto.id, id: `compare-${proto.id}` });
    input.checked = state.compare ? state.pair.indexOf(proto.id) >= 0 : false;
    return { proto, input };
  });
  const status = el('p', { class: 'chooser-status', role: 'status' });
  const start = el('button', { type: 'button', class: 'btn primary', disabled: true, onClick: () => {
    const picked = checks.filter((c) => c.input.checked).map((c) => c.proto.id);
    if (picked.length === 2) startComparison(picked);
  } }, 'Start comparing');
  const refresh = () => {
    const count = checks.filter((c) => c.input.checked).length;
    start.disabled = count !== 2;
    status.textContent = count === 2 ? 'Two designs chosen.' : count < 2 ? `Choose exactly two different designs (${count} chosen).` : 'That’s too many. Choose exactly two.';
  };
  checks.forEach((c) => c.input.addEventListener('change', refresh));
  chooser.append(
    el('fieldset', {}, el('legend', { text: 'Pick exactly two designs to see together' }),
      checks.map((c) => el('label', { class: 'check-row', for: c.input.id }, c.input, el('span', {}, el('strong', { text: designName(c.proto.id) })), ))),
    status,
    el('div', { class: 'chooser-actions' }, start, el('button', { type: 'button', class: 'btn', onClick: () => { closeChooser(); compareButton.focus(); } }, 'Cancel')));
  refresh();
  chooser.hidden = false;
  compareButton.setAttribute('aria-expanded', 'true');
  chooser.querySelector('input').focus();
}

function startComparison(ids) {
  state.pair = ids.slice().sort();
  state.compare = true;
  state.activeSlot = 'a';
  closeChooser();
  const page = paneA.page;
  paneA.load(state.pair[0], page);
  paneB.load(state.pair[1], page);
  panel.clearTarget();
  syncControls();
  announce(`Comparing ${designName(state.pair[0])} and ${designName(state.pair[1])}.`);
}

function stopComparison() {
  state.compare = false;
  state.design = state.pair[0];
  paneA.load(state.design, paneA.page);
  panel.clearTarget();
  syncControls();
  announce('Comparison closed.');
}

compareButton.addEventListener('click', () => {
  if (state.compare) { stopComparison(); return; }
  if (chooser.hidden) openChooser(); else closeChooser();
});
chooser.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); closeChooser(); compareButton.focus(); } });
document.addEventListener('pointerdown', (event) => {
  if (!chooser.hidden && !chooser.contains(event.target) && !compareButton.contains(event.target)) closeChooser();
});

$('together').addEventListener('change', () => {
  state.together = $('together').checked;
  ui.together = state.together; saveUi();
  if (state.compare && state.together) {
    const leader = state.activeSlot === 'b' ? paneB : paneA;
    otherPane(leader).setPage(leader.page);
  }
  syncControls();
});

/* On phones the two designs are shown one at a time, with two clearly labelled tabs. */
const compareTabs = $('compare-tabs');
function renderMobileTabs() {
  clear(compareTabs);
  compareTabs.hidden = !state.compare;
  paneA.root.classList.toggle('mobile-hidden', state.compare && state.mobileSlot === 'b');
  paneB.root.classList.toggle('mobile-hidden', state.compare && state.mobileSlot !== 'b');
  if (!state.compare) return;
  const current = state.mobileSlot === 'b' ? 'b' : 'a';
  [['a', paneA], ['b', paneB]].forEach(([slot, pane]) => {
    compareTabs.append(el('button', { type: 'button', 'aria-pressed': String(current === slot), onClick: () => { state.mobileSlot = slot; renderMobileTabs(); } },
      `Showing: ${pane.prototypeId ? designName(pane.prototypeId).split(' · ')[0] : slot}`));
  });
}

/* ---------- review panel ---------- */
const panel = new ReviewPanel({
  root: panelEl,
  store,
  actions: {
    makeInfoButton,
    getMode: () => state.mode,
    setMode,
    announce,
    toggleSide: () => { state.side = state.side === 'right' ? 'left' : 'right'; ui.side = state.side; saveUi(); applySide(); },
    panelStateChanged: () => { document.body.dataset.panel = panelEl.classList.contains('collapsed') ? 'collapsed' : 'open'; },
    storeChanged: () => activePanes().forEach((pane) => pane.send('studio:marks', { marks: marksFor(pane.prototypeId) })),
    selectInFrame: (prototypeId, id) => {
      const pane = activePanes().filter((p) => p.prototypeId === prototypeId)[0];
      if (pane) pane.send('studio:select', { id, reveal: false });
    },
    revealRecord,
    startImport,
    confirmClearAll
  }
});

function applySide() {
  panelEl.classList.toggle('side-left', state.side === 'left');
  document.body.dataset.side = state.side;
}

function revealRecord(record) {
  const item = catalogItem(record.elementId);
  if (!item) return;
  state.pendingSelect = { prototypeId: record.prototypeId, id: record.elementId, page: item.page };
  setMode('feedback');
  const shown = activePanes().filter((p) => p.prototypeId === record.prototypeId)[0];
  if (shown) runPendingSelect(shown);
  else if (!state.compare) setDesign(record.prototypeId);
  // In a comparison where this design is not shown, the note stays open without highlighting.
  else state.pendingSelect = null;
}

function runPendingSelect(pane) {
  const pending = state.pendingSelect;
  if (!pending || !pane.ready) return;
  state.pendingSelect = null;
  if (pending.page !== 'site' && pane.page !== pending.page) pane.setPage(pending.page);
  window.setTimeout(() => pane.send('studio:select', { id: pending.id, reveal: true }), 450);
}

/* ---------- dialogs ---------- */
const dialog = $('studio-dialog');
let dialogReturn = null;
function showDialog(build) {
  dialogReturn = document.activeElement;
  clear(dialog);
  build(dialog);
  dialog.showModal();
}
dialog.addEventListener('close', () => {
  clear(dialog);
  if (dialogReturn && dialogReturn.focus && document.contains(dialogReturn)) dialogReturn.focus();
});
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
function closeButton() { return el('button', { type: 'button', class: 'dialog-x', 'aria-label': 'Close', onClick: () => dialog.close() }, '×'); }

function summarizeRecordLine(record) {
  const bits = [];
  bits.push(record.decision ? record.decision.charAt(0).toUpperCase() + record.decision.slice(1) : 'no choice');
  if (record.favorite) bits.push('favorite');
  const comment = record.comment.trim().replace(/\s+/g, ' ');
  return bits.join(', ') + (comment ? ` — “${comment.length > 90 ? comment.slice(0, 90) + '…' : comment}”` : '');
}

async function startImport(file) {
  if (file.size > MAX_IMPORT_BYTES) { showImportProblem(file.name, ['This file is larger than 1 MB, which is far bigger than a normal notes file. It was not opened.']); return; }
  let text = '';
  try { text = await file.text(); } catch (error) { showImportProblem(file.name, ['This file could not be read.']); return; }
  const result = readAndCheck(text, file.size);
  if (!result.ok) { showImportProblem(file.name, result.problems); return; }
  showImportPreview(file.name, result);
}

function showImportProblem(name, problems) {
  showDialog((d) => d.append(closeButton(), el('div', { class: 'dialog-body' },
    el('h2', { text: 'This file couldn’t be loaded' }), el('p', { class: 'muted', text: name }),
    el('ul', { class: 'bullets' }, problems.map((p) => el('li', { text: p }))),
    el('p', { text: 'Your current notes were not changed.' }),
    el('button', { type: 'button', class: 'btn primary', onClick: () => d.close() }, 'Close'))));
}

function showImportPreview(name, result) {
  const preview = previewImport(store, result.records);
  showDialog((d) => {
    const mode = { value: 'merge' };
    const strategy = el('select', { id: 'merge-strategy' },
      el('option', { value: 'newer', text: 'Keep whichever was changed most recently' }),
      el('option', { value: 'mine', text: 'Keep what is already here' }),
      el('option', { value: 'combine', text: 'Combine them (keep both comments)' }));
    const strategyRow = el('label', { class: 'field-row', for: 'merge-strategy' }, el('span', { text: `When a note differs (${preview.different.length}): ` }), strategy);
    strategyRow.hidden = preview.different.length === 0;
    const modeNote = el('p', { class: 'fine' });
    const refresh = () => {
      strategyRow.hidden = mode.value !== 'merge' || preview.different.length === 0;
      modeNote.textContent = mode.value === 'merge'
        ? 'Merge adds the new notes and keeps everything you already have.'
        : `Replace removes the ${store.count()} note${store.count() === 1 ? '' : 's'} now in this browser and uses only the file. A copy is kept so you can undo.`;
    };
    const radio = (value, label) => el('label', { class: 'radio-row' }, el('input', { type: 'radio', name: 'import-mode', value, checked: value === 'merge', onChange: () => { mode.value = value; refresh(); } }), ` ${label}`);
    const differing = el('ul', { class: 'plain-list' }, preview.different.slice(0, 8).map(({ mine, incoming }) =>
      el('li', { class: 'diff-row' }, el('strong', { text: describeRecord(incoming).title }),
        el('div', { text: `Here now: ${summarizeRecordLine(mine)}` }), el('div', { text: `In the file: ${summarizeRecordLine(incoming)}` }))));
    d.append(closeButton(), el('div', { class: 'dialog-body' },
      el('h2', { text: 'Preview before loading' }),
      el('p', { class: 'muted', text: `${name}${result.meta.exportedAt ? ' · saved ' + formatDateTime(result.meta.exportedAt) : ''}` }),
      result.problems.length ? el('ul', { class: 'bullets' }, result.problems.map((p) => el('li', { text: p }))) : null,
      el('ul', { class: 'bullets' },
        el('li', { text: `${preview.added.length} new note${preview.added.length === 1 ? '' : 's'} to add` }),
        el('li', { text: `${preview.same.length} already the same here` }),
        el('li', { text: `${preview.different.length} on the same part but different` }),
        el('li', { text: `${preview.onlyHere.length} only in this browser (kept when merging)` })),
      preview.different.length ? el('details', {}, el('summary', { text: 'See the differences' }), differing, preview.different.length > 8 ? el('p', { class: 'fine', text: `…and ${preview.different.length - 8} more.` }) : null) : null,
      el('fieldset', {}, el('legend', { text: 'How should these notes be loaded?' }), radio('merge', 'Merge with my notes (recommended)'), radio('replace', 'Replace my notes with the file')),
      strategyRow, modeNote,
      el('div', { class: 'dialog-actions' },
        store.count() ? el('button', { type: 'button', class: 'btn', onClick: () => downloadFile(`my-notes-before-loading-${dateStamp()}.json`, buildJson(store), 'application/json') }, '⬇ Download my current notes first') : null,
        el('button', { type: 'button', class: 'btn', onClick: () => d.close() }, 'Cancel'),
        el('button', { type: 'button', class: 'btn primary', onClick: () => {
          store.applyImport(result.records, mode.value, strategy.value);
          d.close();
          announce(`Notes loaded (${mode.value === 'merge' ? 'merged' : 'replaced'}). You can undo this from Save and share.`);
          panel.open('summary');
        } }, 'Load these notes'))));
    refresh();
  });
}

function confirmClearAll() {
  showDialog((d) => d.append(closeButton(), el('div', { class: 'dialog-body' },
    el('h2', { text: 'Clear all your notes?' }),
    el('p', { text: `This removes all ${store.count()} note${store.count() === 1 ? '' : 's'} from this browser. A copy is kept so you can undo it, but downloading a backup first is the safest choice.` }),
    el('div', { class: 'dialog-actions' },
      el('button', { type: 'button', class: 'btn', onClick: () => downloadFile(`my-notes-backup-${dateStamp()}.json`, buildJson(store), 'application/json') }, '⬇ Download a backup first'),
      el('button', { type: 'button', class: 'btn', onClick: () => d.close() }, 'Keep my notes'),
      el('button', { type: 'button', class: 'btn danger', onClick: () => { store.clearAll(); panel.clearTarget(); d.close(); announce('All notes cleared. You can undo this from Save and share.'); } }, 'Clear all notes')))));
}

/* ---------- help menu ---------- */
const helpButton = $('help-button');
const helpMenu = $('help-menu');
function closeHelpMenu(returnFocus) {
  helpMenu.hidden = true;
  helpButton.setAttribute('aria-expanded', 'false');
  if (returnFocus) helpButton.focus();
}
function buildHelpMenu() {
  clear(helpMenu);
  const item = (label, fn) => el('button', { type: 'button', role: 'menuitem', onClick: () => { closeHelpMenu(false); fn(); } }, label);
  helpMenu.append(
    item('Show me around again', () => tour.start(0)),
    item('What each control does', showControlsDialog),
    item('What is real and what is pretend', showSimulatedDialog));
}
helpButton.addEventListener('click', () => {
  if (helpMenu.hidden) { buildHelpMenu(); helpMenu.hidden = false; helpButton.setAttribute('aria-expanded', 'true'); helpMenu.querySelector('button').focus(); }
  else closeHelpMenu(true);
});
helpMenu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.stopPropagation(); closeHelpMenu(true); }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const items = Array.from(helpMenu.querySelectorAll('button'));
    const next = items.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1);
    items[(next + items.length) % items.length].focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!helpMenu.hidden && !helpMenu.contains(event.target) && !helpButton.contains(event.target)) closeHelpMenu(false);
});

function showControlsDialog() {
  showDialog((d) => d.append(closeButton(), el('div', { class: 'dialog-body' },
    el('h2', { text: 'What each control does' }),
    Object.keys(INFO_CARDS).map((key) => el('section', { class: 'info-entry' }, el('h3', { text: INFO_CARDS[key].title }), el('p', { text: INFO_CARDS[key].body }))),
    el('button', { type: 'button', class: 'btn primary', onClick: () => d.close() }, 'Close'))));
}

function showSimulatedDialog() {
  showDialog((d) => d.append(closeButton(), el('div', { class: 'dialog-body' },
    el('h2', { text: 'What is real and what is pretend' }),
    el('h3', { text: 'Really works' }),
    el('p', { text: 'Moving between pages, the service carousel, the starting-point guide, the form checks and the email or phone choice, Browse and Leave feedback, selecting and highlighting parts, your notes, comparing, the summary, saving in this browser, downloading, and loading a notes file.' }),
    el('h3', { text: 'Pretend (a demonstration only)' }),
    el('p', { text: 'Sending a consultation request, the sample times, the confirmation message and anything that would normally need a server. Nothing is sent, booked, reserved or purchased. Please keep tax and banking details out of the sample forms.' }),
    el('h3', { text: 'Not included yet' }),
    el('p', { text: 'A live database, customer tracking, analytics, real leads, email campaigns, payments, document uploads and a secure client portal.' }),
    el('button', { type: 'button', class: 'btn primary', onClick: () => d.close() }, 'Close'))));
}

/* ---------- guided walkthrough ---------- */
const tourActions = {
  nextDesign() {
    if (state.compare) stopComparison();
    const index = PROTOTYPES.findIndex((p) => p.id === state.design);
    const next = PROTOTYPES[(index + 1) % PROTOTYPES.length];
    setDesign(next.id);
    return `Now showing ${designName(next.id)}.`;
  },
  nextPage() {
    const index = PAGES.findIndex((p) => p.id === paneA.page);
    const next = PAGES[(index + 1) % PAGES.length];
    setPage(next.id);
    return `Opened: ${next.label}.`;
  },
  browseMode() { setMode('browse'); return 'Browse mode is on. Try a button on the website.'; },
  feedbackMode() { setMode('feedback'); return 'Feedback mode is on. Now click something on the website.'; },
  openCompare() { if (!state.compare && chooser.hidden) openChooser(); return 'Pick two designs, then press Start comparing (or just continue).'; },
  tabFavorites() { panel.open('favorites'); return null; },
  tabSummary() { panel.open('summary'); return null; },
  tabSave() { panel.open('save'); return null; }
};

let tourReturn = null;
const tour = new Tour({
  root: $('tour-root'),
  steps: TOUR_STEPS,
  api: {
    act: (name) => (tourActions[name] ? tourActions[name]() : null),
    prepare: (stepId) => {
      closeInfo(false);
      if (['design', 'pages', 'browse', 'point', 'compare'].indexOf(stepId) >= 0) setControlsCollapsed(false);
      if (stepId !== 'compare') closeChooser();
      if (['preference', 'favorites', 'summary'].indexOf(stepId) >= 0) panel.open(stepId === 'preference' ? 'selected' : undefined);
      if (stepId === 'send') panel.open('save');
    },
    begin: () => {
      // Remember where the reviewer was, so the tour can put everything back afterwards.
      tourReturn = { compare: state.compare, design: state.compare ? state.pair[0] : state.design, page: paneA.page, mode: state.mode };
    },
    cleanup: () => {
      closeChooser();
      state.holdWelcome = false;
      if (!tourReturn) return;
      const back = tourReturn;
      tourReturn = null;
      if (state.compare && !back.compare) stopComparison();
      if (!state.compare && state.design !== back.design) { state.design = back.design; ui.design = back.design; saveUi(); paneA.load(back.design, back.page); syncControls(); }
      else if (!state.compare && paneA.page !== back.page) paneA.setPage(back.page);
      if (state.mode !== back.mode) setMode(back.mode);
      panel.clearTarget();
      panel.showTab('selected');
    },
    panelSide: () => state.side
  },
  onClose: (completed) => {
    ui.tourDone = true; saveUi();
    state.holdWelcome = false;
    panes.forEach((pane) => pane.send('studio:holdWelcome', { hold: false }));
    announce(completed ? 'Tour finished. The Help button can show you around again.' : 'Tour closed. The Help button can show you around again.');
  }
});

/* ---------- start ---------- */
const keepToolbarHeight = () => document.documentElement.style.setProperty('--toolbar-h', `${toolbar.offsetHeight}px`);
if (window.ResizeObserver) new ResizeObserver(keepToolbarHeight).observe(toolbar);
keepToolbarHeight();
applySide();
panel.setCollapsed(true);
syncControls();
paneA.load(state.design, 'home');
if (!ui.tourDone) tour.start(0);
