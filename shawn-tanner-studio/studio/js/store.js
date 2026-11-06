// Saves the reviewer's choices in this browser (when the browser allows it).
// Nothing is uploaded anywhere. Sharing the studio link does not share notes.

import { PROTOTYPES } from './config.js';
import { makeKey, sanitizeRecord, isEmptyRecord, buildContext } from './records.js';
import { catalogItem } from './catalog.js';

const STORAGE_KEY = 'shawnReview.notes.v1';
const BACKUP_KEY = 'shawnReview.beforeImport.v1';

function storageAvailable() {
  try {
    const probe = '__shawn_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}

export class ReviewStore {
  constructor() {
    this.records = new Map();
    this.listeners = new Set();
    this.canSave = storageAvailable();
    this.lastSavedAt = null;
    this.saveError = null;
    this.loadNotice = null;
    this.hasUndo = false;
    this.load();
    this.hasUndo = this.readBackup() !== null;
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit() { this.listeners.forEach((listener) => listener()); }

  /* ---------- reading ---------- */
  get(key) { return this.records.get(key) || null; }
  all() { return Array.from(this.records.values()); }
  count() { return this.records.size; }

  /* ---------- writing ---------- */
  /**
   * Add or change a note. `identity` says what it is about, `changes` says what to set.
   * A note with no choice, no star and no text is removed.
   */
  update(identity, changes) {
    const key = makeKey(identity.kind, identity.prototypeId, identity.pageId, identity.elementId);
    const existing = this.records.get(key);
    const next = existing ? { ...existing } : {
      key, kind: identity.kind, prototypeId: identity.prototypeId,
      pageId: identity.pageId || null, elementId: identity.elementId || null,
      decision: null, favorite: false, comment: '',
      context: buildContext(identity.kind, identity.prototypeId, identity.pageId, identity.elementId)
    };
    Object.assign(next, changes);
    if (existing && this.statusOf(existing) === 'current') {
      next.context = buildContext(next.kind, next.prototypeId, next.pageId, next.elementId);
    }
    next.updatedAt = new Date().toISOString();
    if (isEmptyRecord(next)) this.records.delete(key); else this.records.set(key, next);
    this.persist();
    this.emit();
  }

  remove(key) {
    if (this.records.delete(key)) { this.persist(); this.emit(); }
  }

  /** current | changed | missing, compared with the prototypes as they are now. */
  statusOf(record) {
    const proto = PROTOTYPES.filter((p) => p.id === record.prototypeId)[0];
    if (!proto) return 'missing';
    if (record.kind === 'element') {
      const item = catalogItem(record.elementId);
      if (!item) return 'missing';
      return item.rev !== (record.context && record.context.rev) ? 'changed' : 'current';
    }
    return 'current';
  }

  /* ---------- saving ---------- */
  persist() {
    if (!this.canSave) return;
    try {
      const payload = { formatVersion: 1, savedAt: new Date().toISOString(), records: this.all() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this.lastSavedAt = payload.savedAt;
      this.saveError = null;
    } catch (error) {
      this.saveError = 'Your browser would not save the latest change. Download a backup so nothing is lost.';
    }
  }

  load() {
    if (!this.canSave) return;
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      if (!text) return;
      const data = JSON.parse(text);
      const list = data && Array.isArray(data.records) ? data.records : [];
      let skipped = 0;
      list.forEach((raw) => {
        const result = sanitizeRecord(raw);
        if (result.record) this.records.set(result.record.key, result.record); else skipped += 1;
      });
      this.lastSavedAt = data.savedAt || null;
      if (skipped) this.loadNotice = `${skipped} saved note${skipped === 1 ? ' was' : 's were'} unreadable and skipped.`;
    } catch (error) {
      this.loadNotice = 'Saved notes in this browser could not be read. Your downloaded backups are still safe.';
    }
  }

  /* ---------- importing (with a way back) ---------- */
  readBackup() {
    if (!this.canSave) return this.memoryBackup || null;
    try { return window.localStorage.getItem(BACKUP_KEY); } catch (error) { return this.memoryBackup || null; }
  }

  saveBackupOfCurrent() {
    const text = JSON.stringify({ savedAt: new Date().toISOString(), records: this.all() });
    this.memoryBackup = text;
    if (this.canSave) { try { window.localStorage.setItem(BACKUP_KEY, text); } catch (error) { /* memory copy remains */ } }
    this.hasUndo = true;
  }

  applyImport(records, mode, strategy) {
    this.saveBackupOfCurrent();
    if (mode === 'replace') {
      this.records = new Map(records.map((r) => [r.key, r]));
    } else {
      records.forEach((incoming) => {
        const mine = this.records.get(incoming.key);
        if (!mine) { this.records.set(incoming.key, incoming); return; }
        if (sameContent(mine, incoming)) return;
        this.records.set(incoming.key, mergeTwo(mine, incoming, strategy));
      });
    }
    this.persist();
    this.emit();
  }

  clearAll() {
    this.saveBackupOfCurrent();
    this.records = new Map();
    this.persist();
    this.emit();
  }

  undoImport() {
    const text = this.readBackup();
    if (!text) return false;
    try {
      const data = JSON.parse(text);
      this.records = new Map();
      (data.records || []).forEach((raw) => {
        const result = sanitizeRecord(raw);
        if (result.record) this.records.set(result.record.key, result.record);
      });
      this.memoryBackup = null;
      if (this.canSave) { try { window.localStorage.removeItem(BACKUP_KEY); } catch (error) { /* ignore */ } }
      this.hasUndo = false;
      this.persist();
      this.emit();
      return true;
    } catch (error) {
      return false;
    }
  }
}

export function sameContent(a, b) {
  return a.decision === b.decision && a.favorite === b.favorite && a.comment.trim() === b.comment.trim();
}

/** Merge two versions of the same note without throwing either comment away silently. */
export function mergeTwo(mine, incoming, strategy) {
  if (strategy === 'mine') return mine;
  const newer = Date.parse(incoming.updatedAt) > Date.parse(mine.updatedAt) ? incoming : mine;
  if (strategy === 'newer') return newer;
  // "combine": newest choice wins, but both comments are kept.
  const comments = [mine.comment.trim(), incoming.comment.trim()].filter(Boolean);
  const unique = comments.filter((text, index) => comments.indexOf(text) === index);
  return {
    ...newer,
    favorite: mine.favorite || incoming.favorite,
    comment: unique.length > 1 ? `${unique[0]}\n\n— Also noted: ${unique[1]}`.slice(0, 2000) : (unique[0] || '')
  };
}
