// Turns a spoken sentence into { fieldId: value } for only the fields that were mentioned.
// All field names are recognised as boundaries, but parse() returns only the fields the caller asks for.

// Aliases are in normalized form (see normalize()): "mold" -> "mould",
// "rejection/reject" -> "rej", "knock out" -> "knockout", "number of" -> "no of".
export const FIELDS = {
  patternName: { label: 'Pattern Name', type: 'text', aliases: ['pattern name', 'pattern number', 'pattern no'] },
  mouldingLine: { label: 'Moulding Line', type: 'text', aliases: ['moulding line', 'mould line'] },
  mouldingProcess: { label: 'Moulding Process', type: 'text', aliases: ['moulding process', 'mould process'] },
  customerPartName: { label: 'Customer Part Name', type: 'text',
    aliases: ['customer part name', 'customer part number', 'customer part no', 'customer part'] },
  grade: { label: 'Grade', type: 'text', aliases: ['grade'] },
  subGrade: { label: 'Sub Grade', type: 'text', aliases: ['sub grade'] },
  noOfCavities: { label: 'No. Of Cavities', type: 'number', aliases: ['no of cavities', 'total cavities', 'cavities'] },

  mouldingDate: { label: 'Moulding Date', type: 'date', aliases: ['moulding date', 'mould date', 'date'] },
  plannedMouldNo: { label: 'Planned Mould No', type: 'number',
    aliases: ['planned mould no', 'planned mould number', 'planned moulds', 'planned mould', 'plan mould'] },
  goodMould: { label: 'Good Mould', type: 'number', aliases: ['good moulds', 'good mould', 'ok moulds', 'ok mould'] },
  rejectMould: { label: 'Reject Mould', type: 'number', aliases: ['rej moulds', 'rej mould', 'mould rej'] },
  cavitiesBlocked: { label: 'Cavities Blocked', type: 'number', aliases: ['cavities blocked', 'blocked cavities'] },

  partName: { label: 'Part Name', type: 'text', aliases: ['part name', 'part number', 'part no'] },
  knockoutStock: { label: 'Knockout Stock', type: 'number', aliases: ['knockout stock', 'ko stock'] },
  shotBlastStock: { label: 'Shot Blast Stock', type: 'number',
    aliases: ['shot blast stock', 'shot blasting stock', 'sb stock'] },
  knockoutRej: { label: 'Knockout Rej', type: 'number', aliases: ['knockout rej', 'ko rej'] },
  shotBlastRej: { label: 'Shot Blasting Rej', type: 'number', aliases: ['shot blasting rej', 'shot blast rej', 'sb rej'] },
};

export function normalize(s) {
  let t = ' ' + String(s).toLowerCase() + ' ';
  t = t.replace(/(\d),(\d)/g, '$1$2');
  t = t.replace(/[,;!?"“”()]/g, ' ');
  t = t.replace(/\.(?!\d)/g, ' ');
  t = t.replace(/[:=]/g, ' ');
  t = t.replace(/\bmold/g, 'mould');
  t = t.replace(/\bknock[\s-]*out/g, 'knockout');
  t = t.replace(/\bk o\b/g, 'ko');
  t = t.replace(/\bs b\b/g, 'sb');
  t = t.replace(/\bshot[\s-]*blast/g, 'shot blast');
  t = t.replace(/\bsub[\s-]*grade/g, 'sub grade');
  t = t.replace(/\b(rejections?|rejected|rejects?|rejn|rej)\b/g, 'rej');
  t = t.replace(/\b(number of|nos of|no of)\b/g, 'no of');
  t = t.replace(/\bcavity\b/g, 'cavities');
  return t.replace(/\s+/g, ' ').trim();
}

// ---- spoken numbers -> digits ----
const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = { hundred: 100, thousand: 1000, lakh: 100000, lakhs: 100000, lac: 100000, million: 1000000 };
const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8,
  ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };

function wordValue(w, ordinals) {
  if (w in UNITS) return UNITS[w];
  if (w in TENS) return TENS[w];
  if (ordinals && w in ORDINALS) return ORDINALS[w];
  return undefined;
}

function runValue(run, ordinals) {
  // "one zero two" -> 102 (digit by digit)
  if (run.length > 1 && run.every(w => w in UNITS && UNITS[w] <= 9)) return run.map(w => UNITS[w]).join('');
  let total = 0, current = 0;
  for (const w of run) {
    if (w in SCALES) {
      if (SCALES[w] === 100) current = (current || 1) * 100;
      else { total += (current || 1) * SCALES[w]; current = 0; }
    } else {
      current += wordValue(w, ordinals);
    }
  }
  return String(total + current);
}

export function numberize(text, ordinals = false) {
  const toks = text.split(' ').filter(Boolean);
  const isNum = w => w in SCALES || wordValue(w, ordinals) !== undefined;
  const out = [];
  let run = [];
  const flush = () => { if (run.length) { out.push(runValue(run, ordinals)); run = []; } };
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i], next = toks[i + 1];
    if (isNum(w)) run.push(w);
    else if (w === 'and' && run.some(r => r in SCALES) && next && isNum(next)) continue;
    else if (w === 'a' && next in SCALES) run.push('one');
    else { flush(); out.push(w); }
  }
  flush();
  return out.join(' ');
}

// ---- value cleanup ----
const LEAD = /^(is|are|was|equals|equal to|equal|as|of|number|no|value|colon|dash|hyphen|-)\s+/;
const TRAIL = /\s+(and|then|next|comma|full stop|please)$/;

function stripFillers(v) {
  let prev;
  v = v.trim();
  do { prev = v; v = v.replace(LEAD, '').replace(TRAIL, '').trim(); } while (v !== prev);
  return /^(and|then|is|-)$/.test(v) ? '' : v;
}

function parseNumber(v) {
  let t = numberize(v);
  let m = t.match(/\d+(\.\d+)?/);
  if (!m) {
    // common mis-hearings of single digits
    t = t.replace(/\b(for|fore)\b/g, '4').replace(/\b(to|too)\b/g, '2')
      .replace(/\bwon\b/g, '1').replace(/\bate\b/g, '8');
    m = t.match(/\d+(\.\d+)?/);
  }
  if (m) return m[0];
  return /\b(nil|none|nothing|null)\b/.test(t) ? '0' : '';
}

function parseText(v) {
  const out = [];
  let prevWasLetter = false;
  for (const tok of numberize(v).split(' ').filter(Boolean)) {
    const isLetter = /^[a-z]$/.test(tok);
    // spelled-out letters "p t" -> "PT"
    if (isLetter && prevWasLetter) out[out.length - 1] += tok;
    else out.push(tok);
    prevWasLetter = isLetter;
  }
  return out.join(' ').toUpperCase();
}

const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };

function iso(y, m, d) {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toISODate(d) {
  return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function parseDate(v, now = new Date()) {
  const t = numberize(v, true).replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
  const rel = { today: 0, yesterday: -1, tomorrow: 1 };
  for (const k in rel) {
    if (new RegExp('\\b' + k + '\\b').test(t)) {
      const d = new Date(now);
      d.setDate(d.getDate() + rel[k]);
      return toISODate(d);
    }
  }
  const fixYear = y => (y ? (y < 100 ? 2000 + y : y) : now.getFullYear());
  let m = t.match(/\b(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})\b/);
  if (m) return iso(fixYear(+m[3]), +m[2], +m[1]);
  const mon = Object.keys(MONTHS).join('|');
  m = t.match(new RegExp(`\\b(\\d{1,2}) (?:of )?(${mon})\\b(?: (\\d{2,4}))?`));
  if (m) return iso(fixYear(m[3] && +m[3]), MONTHS[m[2]], +m[1]);
  m = t.match(new RegExp(`\\b(${mon}) (\\d{1,2})\\b(?: (\\d{2,4}))?`));
  if (m) return iso(fixYear(m[3] && +m[3]), MONTHS[m[1]], +m[2]);
  return '';
}

// ---- fuzzy field-name matching ----
// Speech-to-text often mishears field names ("short blood stock" for "shot blast stock").
// Field names are matched word by word using spelling similarity plus a rough sound-alike key,
// and whole phrases are aligned so a missing or extra word is tolerated.

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const similarity = (a, b) => (a === b ? 1 : 1 - editDistance(a, b) / Math.max(a.length, b.length, 1));

// Rough sound-alike key: similar-sounding consonants merged, vowels after the first letter dropped.
function soundKey(w) {
  const k = w.replace(/ph/g, 'f').replace(/ck|q|c(?=[aou])/g, 'k').replace(/c/g, 's').replace(/z/g, 's')
    .replace(/d/g, 't').replace(/v/g, 'f').replace(/[wyh]/g, '');
  return (k[0] || '') + k.slice(1).replace(/[aeiou]/g, '').replace(/(.)\1+/g, '$1');
}

function wordSimilarity(a, b) {
  if (a === b) return 1;
  if (/\d/.test(b)) return 0; // numbers are values, never field names
  const spelled = similarity(a, b);
  const ka = soundKey(a), kb = soundKey(b);
  // very short sound keys ("date" -> "t", "today" -> "t") are too coarse to trust
  return ka.length >= 3 && kb.length >= 3 ? Math.max(spelled, 0.9 * similarity(ka, kb)) : spelled;
}

// Token-level alignment: substitutions cost (1 - similarity), a missing or extra word costs 1.
function phraseScore(alias, words) {
  const n = alias.length, m = words.length;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + 1 - wordSimilarity(alias[i - 1], words[j - 1]));
    }
  }
  return 1 - d[n][m] / Math.max(n, m);
}

const MIN_PHRASE_SCORE = 0.65; // multi-word field names
const MIN_WORD_SCORE = 0.8;    // single-word field names ("grade", "cavities") need a closer match

function tokenize(norm) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(norm))) tokens.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  return tokens;
}

// Returns { values, corrections }. `corrections` lists field names that were heard differently.
export function parseDetailed(text, fieldIds, now) {
  const norm = normalize(text);
  const tokens = tokenize(norm);
  const inScope = id => !fieldIds || fieldIds.includes(id);

  const chosen = [];
  const taken = new Array(tokens.length).fill(false);
  const free = (from, to) => !taken.slice(from, to).some(Boolean);
  const claim = h => { chosen.push(h); for (let k = h.from; k < h.to; k++) taken[k] = true; };

  const exact = [];
  for (const [id, f] of Object.entries(FIELDS)) {
    for (const a of f.aliases) {
      const words = a.split(' ');
      for (let i = 0; i + words.length <= tokens.length; i++) {
        if (words.every((w, k) => tokens[i + k].w === w)) exact.push({ id, from: i, to: i + words.length });
      }
    }
  }
  // longest match wins at each position ("sub grade" beats "grade")
  exact.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from));

  // 1. Exact matches for this app's fields.
  for (const h of exact) if (inScope(h.id) && free(h.from, h.to)) claim(h);

  // 2. Fuzzy matches, only for this app's fields, only on words not already claimed.
  const fuzzy = [];
  for (const [id, f] of Object.entries(FIELDS)) {
    if (!inScope(id)) continue;
    for (const a of f.aliases) {
      const words = a.split(' ');
      const L = words.length;
      for (let W = Math.max(1, L - 1); W <= L + 1; W++) {
        for (let i = 0; i + W <= tokens.length; i++) {
          if (taken.slice(i, i + W).some(Boolean)) continue;
          const window = tokens.slice(i, i + W).map(t => t.w);
          if (window.some(w => /\d/.test(w))) continue;
          const score = phraseScore(words, window);
          const min = L === 1 ? MIN_WORD_SCORE : MIN_PHRASE_SCORE;
          // single-word names only match a single, reasonably long word
          if (L === 1 && (W !== 1 || window[0].length < 4)) continue;
          // the first and last heard words must resemble some word of the name, so a neighbouring
          // value word ("85 attach blast stock") is never swallowed into the field name
          const resembles = w => Math.max(...words.map(a => wordSimilarity(a, w))) >= 0.5;
          if (!resembles(window[0]) || !resembles(window[W - 1])) continue;
          if (score >= min) fuzzy.push({ id, from: i, to: i + W, score });
        }
      }
    }
  }
  fuzzy.sort((a, b) => b.score - a.score || (b.to - b.from) - (a.to - a.from));
  const corrections = [];
  for (const h of fuzzy) {
    if (!free(h.from, h.to)) continue;
    // words straight after a field name are that field's value ("pattern name grader 7"), not a new field
    if (h.from > 0 && taken[h.from - 1]) continue;
    claim(h);
    corrections.push({ heard: tokens.slice(h.from, h.to).map(t => t.w).join(' '), field: h.id });
  }

  // 3. Other apps' field names (exact only) still end the previous value, so they don't leak into it.
  for (const h of exact) if (!inScope(h.id) && free(h.from, h.to)) claim(h);

  // 4. Each field's value is the text between its name and the next field name.
  chosen.sort((a, b) => a.from - b.from);
  const values = {};
  chosen.forEach((h, i) => {
    if (!inScope(h.id)) return;
    const start = tokens[h.to - 1].end;
    const end = i + 1 < chosen.length ? tokens[chosen[i + 1].from].start : norm.length;
    const raw = stripFillers(norm.slice(start, end));
    if (!raw) return;
    const type = FIELDS[h.id].type;
    const val = type === 'number' ? parseNumber(raw) : type === 'date' ? parseDate(raw, now) : parseText(raw);
    if (val !== '') values[h.id] = val;
  });
  return { values, corrections: corrections.filter(c => c.field in values) };
}

export function parse(text, fieldIds, now) {
  return parseDetailed(text, fieldIds, now).values;
}
