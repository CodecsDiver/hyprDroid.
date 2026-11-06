// The guided walkthrough: one small window per control, highlighting that control.
// It never writes to the real review notes. Practice choices stay inside the tour window.

import { el, clear } from './dom.js';

export class Tour {
  constructor({ root, steps, api, onClose }) {
    this.root = root;
    this.steps = steps;
    this.api = api;
    this.onClose = onClose;
    this.index = 0;
    this.highlighted = [];
    this.isOpen = false;
    this.returnFocus = null;
    this.practice = { decision: null, note: '' };
    this.keyHandler = (event) => { if (event.key === 'Escape' && this.isOpen) { event.stopPropagation(); this.close(false); } };
  }

  start(index = 0) {
    this.returnFocus = document.activeElement;
    this.isOpen = true;
    this.practice = { decision: null, note: '' };
    this.api.begin();
    document.addEventListener('keydown', this.keyHandler, true);
    this.show(index);
  }

  close(completed) {
    this.isOpen = false;
    document.removeEventListener('keydown', this.keyHandler, true);
    this.removeHighlight();
    clear(this.root);
    this.root.hidden = true;
    this.api.cleanup();
    if (this.returnFocus && this.returnFocus.focus && document.contains(this.returnFocus)) this.returnFocus.focus();
    this.onClose(completed);
  }

  removeHighlight() {
    this.highlighted.forEach((node) => node.classList.remove('tour-highlight'));
    this.highlighted = [];
  }

  /** Called by the studio when something the tour is waiting for happens (for example, a part was selected). */
  notify(eventName) {
    if (!this.isOpen) return;
    const step = this.steps[this.index];
    if (step.id === 'point' && eventName === 'selected' && this.noteEl) {
      this.noteEl.textContent = step.doneNote;
    }
  }

  show(index) {
    this.index = Math.max(0, Math.min(index, this.steps.length - 1));
    const step = this.steps[this.index];
    this.removeHighlight();
    this.api.prepare(step.id);

    const last = this.index === this.steps.length - 1;
    const first = this.index === 0;
    clear(this.root);
    this.root.hidden = false;

    const titleId = 'tour-title';
    this.titleEl = el('h2', { id: titleId, tabindex: '-1', text: step.title });
    this.noteEl = el('p', { class: 'tour-note', role: 'status' });
    const card = el('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': titleId },
      el('p', { class: 'tour-count', text: `Step ${this.index + 1} of ${this.steps.length}` }),
      this.titleEl,
      el('p', { class: 'tour-body', text: step.body }),
      step.practice ? this.practiceBox() : null,
      step.actionLabel ? el('button', { type: 'button', class: 'btn tour-action', onClick: () => { const message = this.api.act(step.action); if (message) this.noteEl.textContent = message; } }, step.actionLabel) : null,
      this.noteEl,
      el('div', { class: 'tour-nav' },
        el('button', { type: 'button', class: 'btn', disabled: first, onClick: () => this.show(this.index - 1) }, '← Back'),
        el('button', { type: 'button', class: 'btn quiet', onClick: () => this.close(false) }, 'Skip for now'),
        el('button', { type: 'button', class: 'btn primary', onClick: () => (last ? this.close(true) : this.show(this.index + 1)) }, step.nextLabel || 'Next →')));
    this.root.append(card);
    this.card = card;

    // Highlight the control without hiding it, and keep the window out of its way.
    const target = step.target ? document.querySelector(step.target) : null;
    if (target && target.getClientRects().length) {
      target.classList.add('tour-highlight');
      this.highlighted.push(target);
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    this.place(target);
    this.titleEl.focus({ preventScroll: true });
  }

  place(target) {
    const card = this.card;
    card.dataset.place = 'bottom';
    card.dataset.side = this.api.panelSide() === 'right' ? 'left' : 'right';
    if (!target || !target.getClientRects().length) return;
    const rect = target.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    card.dataset.place = center > window.innerHeight * 0.5 ? 'top' : 'bottom';
  }

  practiceBox() {
    const note = el('textarea', { rows: '2', maxlength: '200', 'aria-label': 'Practice note (not saved)', placeholder: 'Practice here. Nothing you type is saved.' });
    const status = el('p', { class: 'fine', text: 'Practice only — this is not saved to your review.' });
    const buttons = ['Keep', 'Change', 'Remove'].map((name) => el('button', { type: 'button', class: 'btn small', 'aria-pressed': 'false', onClick: (event) => {
      this.practice.decision = this.practice.decision === name ? null : name;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === this.practice.decision)));
      status.textContent = this.practice.decision ? `Practice choice: ${this.practice.decision}. Not saved.` : 'Practice only — this is not saved to your review.';
      if (this.practice.decision === 'Change') note.focus();
      event.preventDefault();
    } }, name));
    return el('div', { class: 'practice' }, el('div', { class: 'practice-buttons', role: 'group', 'aria-label': 'Practice choices' }, buttons), note, status);
  }
}
