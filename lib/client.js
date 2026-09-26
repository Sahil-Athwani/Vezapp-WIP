'use client';
import { FIELDS } from './voiceParser';

export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/api/auth')) {
    window.location.href = '/login';
  }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- text to speech (prefers Google voices built into Chrome) ----
let ttsEnabled = true;
export function setTtsEnabled(v) { ttsEnabled = v; }

export function speak(text, lang = 'en-IN') {
  if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => /google/i.test(v.name) && v.lang === lang)
    || voices.find(v => /google/i.test(v.name) && v.lang.startsWith('en'))
    || voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.startsWith('en'));
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  speechSynthesis.speak(u);
}

export function spokenValue(id, val) {
  if (FIELDS[id]?.type === 'date' && val) {
    return new Date(val + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return val;
}

// `corrections` (from parseDetailed) lists misheard field names that were matched anyway.
export function filledSummary(values, corrections = []) {
  const ids = Object.keys(values);
  const heard = corrections.length
    ? '. Heard ' + corrections.map(c => `"${c.heard}" as ${FIELDS[c.field].label}`).join(', ')
    : '';
  return `Filled ${ids.length} field${ids.length === 1 ? '' : 's'}. `
    + ids.map(id => `${FIELDS[id].label}, ${spokenValue(id, values[id])}`).join('. ') + heard;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s.replace(' ', 'T'));
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function downloadCsv(filename, columns, rows) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [columns.map(c => q(c.label)).join(','), ...rows.map(r => columns.map(c => q(r[c.key])).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
