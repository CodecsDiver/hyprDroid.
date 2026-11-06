// The review panel: the card for the selected part, favorites, the summary and saving.

import { el, clear, uniqueId, formatDateTime } from './dom.js';
import { PROTOTYPES, PAGES, SITE_WIDE, designName, pageLabel } from './config.js';
import { catalogItem } from './catalog.js';
import { describeRecord } from './records.js';
import { findConflicts, findMixNotes, findNeedsDecision, findUnreviewed, groupFavoritesBySlot } from './analysis.js';
import { buildJson, buildReport, downloadFile, dateStamp } from './exporter.js';
import { INFO_CARDS } from './help-content.js';

const DECISION_INFO = {
  keep: { label: 'Keep', symbol: '✓' },
  change: { label: 'Change', symbol: '✎' },
  remove: { label: 'Remove', symbol: '✕' }
};
const NOTE_LABELS = {
  none: 'Add a note (optional)',
  keep: 'What do you like about it? (optional)',
  change: 'What would you like different? A short description is plenty.',
  remove: 'Why should it go? (optional)'
};
const TABS = [
  { id: 'selected', label: 'Selected' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'summary', label: 'Summary' },
  { id: 'save', label: 'Save & share' }
];

export function savingStatus(store) {
  if (!store.canSave) return { ok: false, text: 'Not saved: this browser isn’t allowing saving right now. Download a backup to keep your notes.' };
  if (store.saveError) return { ok: false, text: store.saveError };
  return { ok: true, text: store.lastSavedAt ? `Saved in this browser · ${formatDateTime(store.lastSavedAt)}` : 'Saved in this browser as you go' };
}

export class ReviewPanel {
  constructor({ root, store, actions }) {
    this.root = root;
    this.store = store;
    this.actions = actions;       // callbacks into the studio
    this.tab = 'selected';
    this.target = null;           // what the card is about
    this.ancestors = [];
    this.blockedMessage = '';
    this.collapsed = false;
    this.selfUpdate = false;
    this.saveTimer = null;
    this.build();
    this.store.onChange(() => this.handleStoreChange());
  }

  /* ---------- frame ---------- */
  build() {
    this.countChip = el('span', { class: 'count-chip', text: '0 notes' });
    this.statusLine = el('p', { class: 'save-status', role: 'status' });
    this.collapseButton = el('button', { type: 'button', class: 'panel-collapse', id: 'panel-collapse', onClick: () => this.setCollapsed(!this.collapsed) });
    this.sideButton = el('button', { type: 'button', class: 'panel-side', text: '⇆', 'aria-label': 'Move the review panel to the other side', title: 'Move the review panel to the other side', onClick: () => this.actions.toggleSide() });
    this.infoButton = this.actions.makeInfoButton('panel');

    this.tabList = el('div', { class: 'tab-list', role: 'tablist', 'aria-label': 'Review panel sections' },
      TABS.map((tab) => el('button', {
        type: 'button', role: 'tab', id: `tab-${tab.id}`, 'data-tab': tab.id, 'aria-controls': `tabpanel-${tab.id}`,
        onClick: () => this.showTab(tab.id), onKeydown: (event) => this.tabKeys(event)
      }, tab.label)));
    this.body = el('div', { class: 'panel-body', role: 'tabpanel', id: 'tabpanel-selected', tabindex: '0' });

    this.root.append(
      el('div', { class: 'panel-head' },
        el('h2', { class: 'panel-title', id: 'panel-title', text: 'Review panel' }), this.countChip, this.infoButton, this.sideButton, this.collapseButton),
      el('div', { class: 'panel-main' }, this.statusLine, this.tabList, this.body)
    );
    this.root.setAttribute('aria-labelledby', 'panel-title');
    this.setCollapsed(false);
    this.updateChrome();
    this.showTab('selected');
  }

  tabKeys(event) {
    const ids = TABS.map((t) => t.id);
    let index = ids.indexOf(this.tab);
    if (event.key === 'ArrowRight') index = (index + 1) % ids.length;
    else if (event.key === 'ArrowLeft') index = (index - 1 + ids.length) % ids.length;
    else return;
    event.preventDefault();
    this.showTab(ids[index]);
    this.tabList.querySelector(`[data-tab="${ids[index]}"]`).focus();
  }

  setCollapsed(collapsed) {
    this.collapsed = collapsed;
    this.root.classList.toggle('collapsed', collapsed);
    this.collapseButton.textContent = collapsed ? 'Open ▴' : 'Collapse ▾';
    this.collapseButton.setAttribute('aria-expanded', String(!collapsed));
    this.collapseButton.setAttribute('aria-label', collapsed ? 'Open the review panel' : 'Collapse the review panel');
    this.actions.panelStateChanged();
  }

  open(tab) {
    if (this.collapsed) this.setCollapsed(false);
    if (tab) this.showTab(tab);
  }

  updateChrome() {
    const count = this.store.count();
    this.countChip.textContent = `${count} note${count === 1 ? '' : 's'}`;
    const status = savingStatus(this.store);
    this.statusLine.textContent = (status.ok ? '✓ ' : '⚠ ') + status.text;
    this.statusLine.classList.toggle('warn', !status.ok);
  }

  handleStoreChange() {
    this.updateChrome();
    this.actions.storeChanged();
    if (this.selfUpdate) return;
    this.showTab(this.tab, { keepScroll: true });
  }

  showTab(tab, options = {}) {
    this.tab = tab;
    const scroll = options.keepScroll ? this.body.scrollTop : 0;
    this.tabList.querySelectorAll('[role="tab"]').forEach((button) => {
      const active = button.getAttribute('data-tab') === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      button.classList.toggle('active', active);
    });
    this.body.setAttribute('aria-labelledby', `tab-${tab}`);
    clear(this.body);
    if (tab === 'selected') this.renderSelected();
    if (tab === 'favorites') this.renderFavorites();
    if (tab === 'summary') this.renderSummary();
    if (tab === 'save') this.renderSave();
    this.body.scrollTop = scroll;
  }

  /* ---------- Selected tab (the feedback card) ---------- */
  showElement(prototypeId, elementId, pageSeen, ancestors) {
    const item = catalogItem(elementId);
    this.target = { kind: 'element', prototypeId, pageId: item ? item.page : pageSeen, elementId, pageSeen };
    this.ancestors = ancestors || [];
    this.blockedMessage = '';
    this.open('selected');
  }

  showScope(kind, prototypeId, pageId) {
    this.target = { kind, prototypeId, pageId: kind === 'page' ? pageId : null, elementId: null, pageSeen: pageId };
    this.ancestors = [];
    this.blockedMessage = '';
    this.open('selected');
  }

  showBlocked(message) {
    this.blockedMessage = message;
    if (this.tab === 'selected') this.showTab('selected');
    else if (this.blockedMessage) this.statusLine.textContent = message;
  }

  clearTarget() {
    this.target = null;
    if (this.tab === 'selected') this.showTab('selected');
  }

  currentRecord() {
    if (!this.target) return null;
    const { kind, prototypeId, pageId, elementId } = this.target;
    const key = kind === 'element' ? elementId : kind === 'page' ? `page:${prototypeId}.${pageId}` : `design:${prototypeId}`;
    return this.store.get(key);
  }

  titleParts() {
    const t = this.target;
    if (t.kind === 'design') return { design: designName(t.prototypeId), page: 'Whole design', element: 'Overall look and feel' };
    if (t.kind === 'page') return { design: designName(t.prototypeId), page: `${pageLabel(t.pageId)} page`, element: 'Whole page' };
    const item = catalogItem(t.elementId);
    const pageText = t.pageId === SITE_WIDE.id ? `All pages (picked on the ${pageLabel(t.pageSeen)} page)` : `${pageLabel(t.pageId)} page`;
    return { design: designName(t.prototypeId), page: pageText, element: item ? item.label : t.elementId };
  }

  renderSelected() {
    const body = this.body;
    if (this.blockedMessage) body.append(el('p', { class: 'notice', role: 'status' }, this.blockedMessage));
    if (!this.target) {
      const mode = this.actions.getMode();
      body.append(
        el('h3', { text: 'Nothing selected yet' }),
        el('p', { text: mode === 'feedback'
          ? 'Click any part of the website to tell Dan what you think of it. You can also use Tab and Enter.'
          : 'To comment on a part of the website, turn on “Leave feedback” and click it. Or open the Favorites tab to give an opinion on a whole page or design.' })
      );
      if (mode !== 'feedback') body.append(el('button', { type: 'button', class: 'btn primary', onClick: () => this.actions.setMode('feedback') }, 'Turn on Leave feedback'));
      body.append(this.excludedNote());
      return;
    }

    const parts = this.titleParts();
    this.card = {};
    body.append(
      el('p', { class: 'crumbs', 'aria-label': 'What this note is about' },
        el('span', { class: 'crumb', text: parts.design }), ' › ', el('span', { class: 'crumb', text: parts.page }), ' › ',
        el('strong', { class: 'crumb', text: parts.element }))
    );

    if (this.target.kind === 'element' && this.ancestors.length) {
      const wrap = el('div', { class: 'section-picker' }, el('span', { class: 'small-label', text: 'Mean the whole section instead?' }));
      this.ancestors.forEach((id) => {
        const item = catalogItem(id);
        if (!item) return;
        wrap.append(el('button', { type: 'button', class: 'btn small', onClick: () => this.actions.selectInFrame(this.target.prototypeId, id) }, `Select the whole section: ${item.label}`));
      });
      body.append(wrap);
    }

    const decisionRow = el('div', { class: 'decision-row', role: 'group', 'aria-label': 'Your choice' });
    Object.keys(DECISION_INFO).forEach((name) => {
      const button = el('button', { type: 'button', class: `btn decision ${name}`, 'data-decision': name, onClick: () => this.chooseDecision(name) },
        el('span', { 'aria-hidden': 'true', text: DECISION_INFO[name].symbol }), ` ${DECISION_INFO[name].label}`);
      decisionRow.append(button);
    });
    this.card.decisionRow = decisionRow;

    this.card.noteLabelText = el('span', { text: NOTE_LABELS.none });
    this.card.note = el('textarea', { rows: '4', maxlength: '2000', id: uniqueId('note'), onInput: () => this.noteTyped() });
    const noteLabel = el('label', { class: 'note-label', for: this.card.note.id }, this.card.noteLabelText);
    this.card.saved = el('span', { class: 'saved-chip', role: 'status' });
    this.card.favorite = el('button', { type: 'button', class: 'btn favorite', onClick: () => this.toggleFavorite() });
    this.card.favoriteInfo = this.actions.makeInfoButton('favorite');
    this.card.clearChoice = el('button', { type: 'button', class: 'btn small', onClick: () => this.clearChoice() }, 'Clear my choice');
    this.card.clearAll = el('button', { type: 'button', class: 'btn small danger', onClick: () => this.clearAll() }, 'Clear everything for this item');
    this.card.flag = el('div', { class: 'flag-area' });

    body.append(
      el('div', { class: 'label-with-info' }, el('span', { class: 'small-label', text: 'Your choice' }), this.actions.makeInfoButton('choices')),
      decisionRow, noteLabel, this.card.note,
      el('div', { class: 'card-foot' }, this.card.saved),
      el('div', { class: 'favorite-row' }, this.card.favorite, this.card.favoriteInfo),
      this.card.flag,
      el('div', { class: 'clear-row' }, this.card.clearChoice, this.card.clearAll)
    );

    const scope = el('div', { class: 'scope-row' });
    if (this.target.kind === 'element') {
      scope.append(
        el('button', { type: 'button', class: 'btn small', onClick: () => this.showScope('page', this.target.prototypeId, this.target.pageSeen) }, 'Give feedback on this whole page'),
        el('button', { type: 'button', class: 'btn small', onClick: () => this.showScope('design', this.target.prototypeId) }, 'Give feedback on this whole design'));
    } else {
      scope.append(el('button', { type: 'button', class: 'btn small', onClick: () => this.clearTarget() }, 'Back to picking parts of the website'));
    }
    body.append(scope, this.excludedNote());

    const record = this.currentRecord();
    this.card.note.value = record ? record.comment : '';
    this.syncCard();
  }

  excludedNote() {
    return el('p', { class: 'fine' }, 'Not selectable on purpose: the grey “design preview” banner, the × buttons on pop-up windows and the dimmed area behind them. ', this.actions.makeInfoButton('excluded'));
  }

  identity() {
    const t = this.target;
    return { kind: t.kind, prototypeId: t.prototypeId, pageId: t.kind === 'design' ? null : t.pageId, elementId: t.elementId };
  }

  writeSelf(changes) {
    this.selfUpdate = true;
    try { this.store.update(this.identity(), changes); } finally { this.selfUpdate = false; }
    this.syncCard();
  }

  chooseDecision(name) {
    const record = this.currentRecord();
    const next = record && record.decision === name ? null : name; // choosing the same button again clears it
    this.writeSelf({ decision: next });
    if (next === 'change') this.card.note.focus();
  }

  noteTyped() {
    window.clearTimeout(this.saveTimer);
    this.card.saved.textContent = 'Typing…';
    this.saveTimer = window.setTimeout(() => this.writeSelf({ comment: this.card.note.value }), 350);
  }

  toggleFavorite() {
    const record = this.currentRecord();
    this.writeSelf({ favorite: !(record && record.favorite) });
  }

  clearChoice() { this.writeSelf({ decision: null }); }

  clearAll() {
    window.clearTimeout(this.saveTimer);
    const record = this.currentRecord();
    if (record) {
      this.selfUpdate = true;
      try { this.store.remove(record.key); } finally { this.selfUpdate = false; }
    }
    this.card.note.value = '';
    this.syncCard();
  }

  syncCard() {
    if (!this.card || !this.target || this.tab !== 'selected') return;
    const record = this.currentRecord();
    const decision = record ? record.decision : null;
    this.card.decisionRow.querySelectorAll('[data-decision]').forEach((button) => {
      const active = button.getAttribute('data-decision') === decision;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    this.card.noteLabelText.textContent = NOTE_LABELS[decision || 'none'];
    this.card.note.placeholder = decision === 'change' ? 'For example: make this simpler, or use a different picture.' : '';
    const favorite = !!(record && record.favorite);
    this.card.favorite.setAttribute('aria-pressed', String(favorite));
    this.card.favorite.textContent = favorite ? '★ Favorite — I’d like this in the final website' : '☆ Mark as a favorite for the final website';
    this.card.clearChoice.hidden = !decision;
    this.card.clearAll.hidden = !record;
    this.card.saved.textContent = record ? 'Saved in this browser' : '';
    if (!this.store.canSave && record) this.card.saved.textContent = 'Not saved in this browser — download a backup';

    clear(this.card.flag);
    if (record) {
      const conflicts = findConflicts(this.store.all()).filter((c) => c.records.some((r) => r.key === record.key));
      conflicts.forEach((c) => this.card.flag.append(el('p', { class: 'flag conflict' }, '⚠ Needs a conversation: ', c.message)));
      const status = this.store.statusOf(record);
      if (status === 'missing') this.card.flag.append(el('p', { class: 'flag' }, 'This part is no longer in the current website. Your note is kept as it was.'));
      if (status === 'changed') this.card.flag.append(el('p', { class: 'flag' }, 'This part changed after your note. Please look again.'));
      if (decision === 'change' && !record.comment.trim()) this.card.flag.append(el('p', { class: 'flag' }, 'A short description of what to change will help.'));
    }
  }

  /* ---------- Favorites tab ---------- */
  renderFavorites() {
    const body = this.body;
    body.append(
      el('div', { class: 'label-with-info' }, el('h3', { text: 'Mix your favorites' }), this.actions.makeInfoButton('favorite')),
      el('p', { text: 'Star what you would like in the real website. Favorites can come from different designs. If two choices compete for the same job, both are kept and flagged for a conversation.' })
    );

    body.append(el('h4', { text: 'Whole designs' }));
    const designList = el('ul', { class: 'plain-list' });
    PROTOTYPES.forEach((proto) => {
      const record = this.store.get(`design:${proto.id}`);
      designList.append(el('li', { class: 'row' },
        el('span', { class: 'row-name', text: designName(proto.id) }),
        this.starButton(`Favorite ${designName(proto.id)} overall`, record, () => this.toggleKindFavorite('design', proto.id, null)),
        el('button', { type: 'button', class: 'btn small', onClick: () => this.showScope('design', proto.id) }, record && (record.decision || record.comment) ? 'Edit note' : 'Add a note')));
    });
    body.append(designList);

    body.append(el('h4', { text: 'Whole pages' }));
    const grid = el('table', { class: 'fav-grid' }, el('caption', { class: 'sr-only', text: 'Favorite pages by design' }));
    grid.append(el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Page' }), PROTOTYPES.map((p) => el('th', { scope: 'col', text: `Version ${p.number}` })))));
    const tbody = el('tbody');
    PAGES.forEach((page) => {
      const row = el('tr', {}, el('th', { scope: 'row', text: page.label }));
      PROTOTYPES.forEach((proto) => {
        const record = this.store.get(`page:${proto.id}.${page.id}`);
        row.append(el('td', {},
          this.starButton(`Favorite ${designName(proto.id)} ${page.label} page`, record, () => this.toggleKindFavorite('page', proto.id, page.id)),
          el('button', { type: 'button', class: 'btn tiny', 'aria-label': `Note on ${designName(proto.id)} ${page.label} page`, onClick: () => this.showScope('page', proto.id, page.id) }, record && (record.decision || record.comment) ? '✎ Edit' : '＋ Note')));
      });
      tbody.append(row);
    });
    grid.append(tbody);
    body.append(grid);

    body.append(el('h4', { text: 'Your mix so far' }));
    const records = this.store.all();
    const groups = groupFavoritesBySlot(records);
    if (!groups.length) body.append(el('p', { class: 'muted', text: 'No favorites yet. Star a part of the website, a page or a whole design.' }));
    const mix = el('ul', { class: 'plain-list' });
    groups.forEach((group) => {
      const conflicted = new Set(group.records.map((r) => r.prototypeId)).size > 1;
      const item = el('li', { class: `mix-item${conflicted ? ' conflicted' : ''}` },
        el('strong', { text: group.title }), conflicted ? el('span', { class: 'badge warn', text: '⚠ Needs a conversation' }) : null);
      group.records.forEach((record) => {
        item.append(el('div', { class: 'row' },
          el('span', { class: 'row-name', text: `★ ${designName(record.prototypeId)}` }),
          el('button', { type: 'button', class: 'btn small', onClick: () => this.openRecord(record) }, 'Open')));
      });
      mix.append(item);
    });
    body.append(mix);
    findMixNotes(records).forEach((note) => body.append(el('p', { class: 'fine', text: `Design work ahead: ${note.message}` })));
  }

  starButton(label, record, onClick) {
    const on = !!(record && record.favorite);
    return el('button', { type: 'button', class: `btn star${on ? ' active' : ''}`, 'aria-pressed': String(on), 'aria-label': label, onClick }, on ? '★ Favorite' : '☆ Favorite');
  }

  toggleKindFavorite(kind, prototypeId, pageId) {
    const key = kind === 'design' ? `design:${prototypeId}` : `page:${prototypeId}.${pageId}`;
    const record = this.store.get(key);
    this.store.update({ kind, prototypeId, pageId, elementId: null }, { favorite: !(record && record.favorite) });
  }

  openRecord(record) {
    if (record.kind === 'element') {
      const item = catalogItem(record.elementId);
      this.target = { kind: 'element', prototypeId: record.prototypeId, pageId: record.pageId, elementId: record.elementId, pageSeen: item && item.page !== SITE_WIDE.id ? item.page : 'home' };
      this.ancestors = [];
      this.actions.revealRecord(record);
    } else {
      this.target = { kind: record.kind, prototypeId: record.prototypeId, pageId: record.pageId, elementId: null, pageSeen: record.pageId || 'home' };
      this.ancestors = [];
    }
    this.blockedMessage = '';
    this.open('selected');
  }

  /* ---------- Summary tab ---------- */
  renderSummary() {
    const body = this.body;
    const records = this.store.all();
    const count = (fn) => records.filter(fn).length;
    body.append(
      el('div', { class: 'label-with-info' }, el('h3', { text: 'Summary of your choices' }), this.actions.makeInfoButton('summary')),
      el('p', { class: 'totals' },
        `${records.length} note${records.length === 1 ? '' : 's'} · ✓ Keep ${count((r) => r.decision === 'keep')} · ✎ Change ${count((r) => r.decision === 'change')} · ✕ Remove ${count((r) => r.decision === 'remove')} · ★ Favorites ${count((r) => r.favorite)}`)
    );
    if (this.store.loadNotice) body.append(el('p', { class: 'notice', text: this.store.loadNotice }));

    const needs = findNeedsDecision(records, this.store);
    body.append(el('h4', {}, 'Still needs a decision ', el('span', { class: 'badge', text: String(needs.length) })));
    if (!needs.length) body.append(el('p', { class: 'muted', text: 'Nothing is waiting right now.' }));
    const needsList = el('ul', { class: 'plain-list' });
    needs.forEach((item) => {
      needsList.append(el('li', { class: 'need-item' },
        el('strong', { text: item.title }), el('span', { class: 'reason', text: item.reason }),
        el('div', { class: 'need-actions' }, item.records.slice(0, 3).map((record) =>
          el('button', { type: 'button', class: 'btn small', onClick: () => this.openRecord(record) }, `Open ${designName(record.prototypeId).split(' · ')[0]}`)))));
    });
    body.append(needsList);

    body.append(el('h4', { text: 'Your choices' }));
    if (!records.length) body.append(el('p', { class: 'muted', text: 'No choices yet. Select a part of the website in feedback mode to begin.' }));
    PROTOTYPES.forEach((proto) => {
      const own = records.filter((r) => r.prototypeId === proto.id).sort((a, b) => a.key.localeCompare(b.key));
      if (!own.length) return;
      const details = el('details', { class: 'design-group', open: true }, el('summary', {}, `${designName(proto.id)} (${own.length})`));
      const list = el('ul', { class: 'plain-list' });
      own.forEach((record) => list.append(this.summaryRow(record)));
      details.append(list);
      body.append(details);
    });
    // Notes for designs that no longer exist stay visible too.
    const knownIds = PROTOTYPES.map((p) => p.id);
    const orphans = records.filter((r) => knownIds.indexOf(r.prototypeId) < 0);
    if (orphans.length) {
      const details = el('details', { class: 'design-group', open: true }, el('summary', {}, `Other designs (${orphans.length})`));
      const list = el('ul', { class: 'plain-list' });
      orphans.forEach((record) => list.append(this.summaryRow(record)));
      details.append(list);
      body.append(details);
    }

    body.append(el('h4', { text: 'Not looked at yet' }));
    findUnreviewed(records).forEach((design) => {
      const details = el('details', { class: 'design-group' }, el('summary', {}, `${designName(design.prototype.id)} — ${design.open} of ${design.total} parts have no note`));
      design.pages.forEach((page) => {
        if (!page.unreviewed.length) return;
        details.append(el('p', { class: 'small-label', text: page.pageLabel }));
        details.append(el('ul', { class: 'bullets' }, page.unreviewed.map((item) => el('li', { text: item.label }))));
      });
      body.append(details);
    });
  }

  summaryRow(record) {
    const info = describeRecord(record);
    const status = this.store.statusOf(record);
    const chips = [];
    if (record.decision) chips.push(el('span', { class: `chip ${record.decision}`, text: `${DECISION_INFO[record.decision].symbol} ${DECISION_INFO[record.decision].label}` }));
    if (record.favorite) chips.push(el('span', { class: 'chip fav', text: '★ Favorite' }));
    if (status === 'missing') chips.push(el('span', { class: 'chip warn', text: 'No longer in site' }));
    if (status === 'changed') chips.push(el('span', { class: 'chip warn', text: 'Updated since note' }));
    return el('li', { class: 'summary-row' },
      el('div', { class: 'summary-line' }, el('strong', { text: record.kind === 'element' ? `${info.page} · ${info.element}` : `${info.page}${record.kind === 'page' ? ' · ' + pageLabel(record.pageId) : ''}` }), chips),
      record.comment.trim() ? el('p', { class: 'comment', text: record.comment }) : null,
      el('button', { type: 'button', class: 'btn tiny', onClick: () => this.openRecord(record) }, 'Open'));
  }

  /* ---------- Save & share tab ---------- */
  renderSave() {
    const body = this.body;
    const status = savingStatus(this.store);
    body.append(
      el('div', { class: 'label-with-info' }, el('h3', { text: 'Save and send your notes' }), this.actions.makeInfoButton('save')),
      el('p', { class: `notice${status.ok ? '' : ' warn'}`, text: (status.ok ? '✓ ' : '⚠ ') + status.text }),
      el('p', { class: 'fine', text: 'Your notes stay in this browser on this device. Sharing the studio link does not share your notes, and they do not move to other devices on their own. Download a backup before changing devices or clearing browser data.' })
    );

    body.append(el('div', { id: 'download-buttons', class: 'download-buttons' },
      el('button', { type: 'button', class: 'btn primary', onClick: () => downloadFile(`website-review-${dateStamp()}.md`, buildReport(this.store), 'text/markdown') }, '⬇ Download the readable report'),
      el('button', { type: 'button', class: 'btn primary', onClick: () => downloadFile(`website-review-${dateStamp()}.json`, buildJson(this.store), 'application/json') }, '⬇ Download the notes file (to send to Dan)')));
    body.append(el('p', { class: 'fine', text: 'Both files are made on this device. Nothing is uploaded.' }));

    const fileInput = el('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'sr-only', onChange: () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) this.actions.startImport(file);
      fileInput.value = '';
    } });
    body.append(el('h4', { text: 'Load a notes file' }),
      el('p', { text: 'Got a notes file from Dan or from another device? You will see a preview before anything changes.' }),
      fileInput,
      el('label', { for: 'import-file', class: 'btn', tabindex: '0', onKeydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } } }, '⬆ Choose a notes file…'));

    if (this.store.hasUndo) {
      body.append(el('div', { class: 'undo-box' },
        el('p', { text: 'A copy of your notes from just before the last import or clear-out is kept in this browser.' }),
        el('button', { type: 'button', class: 'btn', onClick: () => { if (this.store.undoImport()) this.actions.announce('Your earlier notes were restored.'); } }, '↶ Undo the last import or clear-out')));
    }

    body.append(el('h4', { text: 'Start over' }),
      el('button', { type: 'button', class: 'btn danger', disabled: this.store.count() === 0, onClick: () => this.actions.confirmClearAll() }, 'Clear all my notes…'));
  }
}
