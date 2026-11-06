// One preview pane = one framed prototype plus the safe messaging channel to it.
// Messages are accepted only from this pane's own frame, from this same site,
// carrying this pane's private token and a well-formed payload.

import { el, randomToken } from './dom.js';
import { PAGES, findPrototype, designName } from './config.js';
import { catalogItem } from './catalog.js';

const CHANNEL = 'shawn-review';
const PAGE_IDS = PAGES.map((p) => p.id);

export class PreviewPane {
  constructor({ slot, onMessage }) {
    this.slot = slot;                 // 'a' or 'b'
    this.onMessage = onMessage;
    this.prototypeId = null;
    this.token = '';
    this.page = 'home';
    this.ready = false;

    this.chip = el('span', { class: 'pane-chip' });
    this.pageSelect = el('select', { class: 'pane-page', 'aria-label': 'Page in this design', onChange: () => this.onMessage(this, { type: 'ui:page', page: this.pageSelect.value }) },
      PAGES.map((p) => el('option', { value: p.id, text: p.label })));
    this.pageLabelText = el('label', { class: 'pane-page-label' }, el('span', { text: 'Page' }), this.pageSelect);
    this.windowSelect = el('select', { class: 'pane-windows', 'aria-label': 'Open a pop-up window in this design', onChange: () => {
      const choice = this.windowSelect.value;
      this.windowSelect.value = '';
      if (choice) this.send('studio:openWindow', { name: choice });
    } }, [
      el('option', { value: '', text: 'Pop-up windows…' }),
      el('option', { value: 'welcome', text: 'Show the welcome window' }),
      el('option', { value: 'consult', text: 'Show the consultation form' }),
      el('option', { value: 'privacy', text: 'Show the privacy note' }),
      el('option', { value: 'none', text: 'Close pop-up windows' })
    ]);
    this.frame = el('iframe', { class: 'pane-frame', title: 'Website preview' });
    this.root = el('section', { class: 'pane', 'data-slot': slot },
      el('div', { class: 'pane-head' }, this.chip, this.pageLabelText, this.windowSelect),
      el('div', { class: 'frame-wrap' }, this.frame));
  }

  setPageSelectVisible(visible) { this.pageLabelText.hidden = !visible; }

  load(prototypeId, page) {
    const proto = findPrototype(prototypeId);
    if (!proto) return;
    this.prototypeId = prototypeId;
    this.page = PAGE_IDS.indexOf(page) >= 0 ? page : 'home';
    this.token = randomToken();
    this.ready = false;
    this.chip.textContent = designName(prototypeId);
    this.frame.title = `${designName(prototypeId)} website preview`;
    this.pageSelect.value = this.page;
    this.root.setAttribute('data-prototype', prototypeId);
    this.frame.src = `${proto.path}?studio=1&token=${this.token}#${this.page}`;
  }

  setPage(page) {
    if (PAGE_IDS.indexOf(page) < 0) return;
    this.page = page;
    this.pageSelect.value = page;
    this.send('studio:navigate', { page });
  }

  send(type, payload = {}) {
    if (!this.frame.contentWindow || !this.token) return;
    this.frame.contentWindow.postMessage({ channel: CHANNEL, token: this.token, type, ...payload }, window.location.origin);
  }

  /** Called with every window message; returns true when it belonged to this pane. */
  handle(event) {
    if (event.origin !== window.location.origin) return false;
    if (!this.frame.contentWindow || event.source !== this.frame.contentWindow) return false;
    const data = event.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return true;
    if (data.channel !== CHANNEL || data.token !== this.token || data.prototypeId !== this.prototypeId) return true;

    const message = this.validate(data);
    if (!message) return true;
    if (message.type === 'proto:ready') this.ready = true;
    if (message.type === 'proto:page' || message.type === 'proto:ready') {
      this.page = message.page;
      this.pageSelect.value = message.page;
    }
    this.onMessage(this, message);
    return true;
  }

  validate(data) {
    const idOk = (value) => typeof value === 'string' && catalogItem(value) && value.startsWith(`${this.prototypeId}.`);
    switch (data.type) {
      case 'proto:ready':
      case 'proto:page':
        if (PAGE_IDS.indexOf(data.page) < 0) return null;
        return { type: data.type, page: data.page };
      case 'proto:select':
        if (!idOk(data.id) || PAGE_IDS.indexOf(data.page) < 0) return null;
        return {
          type: 'proto:select', id: data.id, page: data.page,
          ancestors: Array.isArray(data.ancestors) ? data.ancestors.filter(idOk).slice(0, 12) : []
        };
      case 'proto:blocked':
        if (data.reason !== 'excluded' && data.reason !== 'none') return null;
        return { type: 'proto:blocked', reason: data.reason, note: typeof data.note === 'string' ? data.note.slice(0, 200) : '' };
      default:
        return null;
    }
  }
}
