'use client';
import { api } from './client';
import { FIELDS, normalize, parseDetailed } from './voiceParser';

let claudeEnabled; // Promise<boolean>, checked once per page load

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Did the speaker say one of the field's names word for word? If not, the match was a correction worth showing.
function saidExactly(id, heard) {
  const h = ` ${normalize(heard)} `;
  return FIELDS[id].aliases.some(a => h.includes(` ${a} `));
}

// Works out which field each spoken value belongs to. Uses Claude when it is set up on the server,
// otherwise (or if Claude fails) the built-in rule-based parser.
// Returns { values, corrections: [{ heard, field }], unclear, by: 'claude' | 'rules', warning? }
export async function understand(text, ids) {
  claudeEnabled ??= api('/api/interpret').then(d => d.enabled).catch(() => false);
  if (await claudeEnabled) {
    try {
      const r = await api('/api/interpret', { method: 'POST', body: { text, fields: ids, today: localDate() } });
      return {
        values: r.values,
        corrections: r.heard.filter(h => h.heard && !saidExactly(h.field, h.heard)),
        unclear: r.unclear,
        by: 'claude',
      };
    } catch (e) {
      return { ...parseDetailed(text, ids), unclear: '', by: 'rules', warning: e.message };
    }
  }
  return { ...parseDetailed(text, ids), unclear: '', by: 'rules' };
}
