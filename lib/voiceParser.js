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

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parse(text, fieldIds, now) {
  const norm = normalize(text);
  const hits = [];
  for (const [id, f] of Object.entries(FIELDS)) {
    for (const a of f.aliases) {
      const re = new RegExp('(?:^|\\s)(' + escapeRe(a) + ')(?=\\s|$)', 'g');
      let m;
      while ((m = re.exec(norm))) {
        const start = m.index + m[0].length - m[1].length;
        hits.push({ id, start, end: start + a.length });
      }
    }
  }
  // longest match wins at each position, no overlaps ("sub grade" beats "grade")
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const chosen = [];
  for (const h of hits) {
    const last = chosen[chosen.length - 1];
    if (!last || h.start >= last.end) chosen.push(h);
  }

  const values = {};
  chosen.forEach((h, i) => {
    if (fieldIds && !fieldIds.includes(h.id)) return;
    const raw = stripFillers(norm.slice(h.end, i + 1 < chosen.length ? chosen[i + 1].start : norm.length));
    if (!raw) return;
    const type = FIELDS[h.id].type;
    const val = type === 'number' ? parseNumber(raw) : type === 'date' ? parseDate(raw, now) : parseText(raw);
    if (val !== '') values[h.id] = val;
  });
  return values;
}
