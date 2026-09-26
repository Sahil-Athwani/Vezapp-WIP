import { handler, requireUser, readJson, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

// Server-side speech-to-text engines. The browser records 16 kHz mono WAV and posts it here, so API keys
// never reach the browser. Each engine is told which words to expect: the field names and the company's
// own pattern and part names.

// Field names plus the natural ways people say them.
const FIELD_PHRASES = [
  'pattern name', 'moulding line', 'moulding process', 'customer part name', 'grade', 'sub grade',
  'number of cavities', 'cavities', 'moulding date', 'planned moulds', 'planned mould number', 'good moulds',
  'reject moulds', 'rejected moulds', 'cavities blocked', 'part name', 'knockout stock', 'shot blast stock',
  'knockout rejection', 'knockout reject', 'shot blasting rejection', 'shot blasting reject', 'shot blast',
  'knockout', 'today', 'yesterday',
];

const ENGINES = {
  google: {
    label: 'Google Cloud',
    key: 'GOOGLE_STT_API_KEY',
    maxSeconds: 55, // synchronous recognition accepts up to 1 minute
    async transcribe(audio, names) {
      const res = await callEngine('Google Speech-to-Text',
        `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(process.env.GOOGLE_STT_API_KEY)}`,
        {
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: process.env.GOOGLE_STT_LANGUAGE || 'en-IN',
            ...(process.env.GOOGLE_STT_MODEL && { model: process.env.GOOGLE_STT_MODEL }),
            // Speech adaptation: strongly prefer our field names and the company's pattern/part names.
            speechContexts: [
              { phrases: FIELD_PHRASES, boost: 15 },
              ...(names.length ? [{ phrases: names.slice(0, 400), boost: 10 }] : []),
            ],
          },
          audio: { content: audio },
        },
        {});
      return (res.results || []).map(r => r.alternatives?.[0]?.transcript || '').join(' ').trim();
    },
  },
  wispr: {
    label: 'Wispr Flow',
    key: 'WISPR_API_KEY',
    maxSeconds: 90,
    async transcribe(audio, names) {
      const res = await callEngine('Wispr Flow', 'https://platform-api.wisprflow.ai/api/v1/dash/api',
        {
          audio,
          language: [process.env.WISPR_LANGUAGE || 'en'],
          context: {
            app: { name: 'Vezapp-WIP', type: 'other' },
            dictionary_context: [...FIELD_PHRASES, ...names],
          },
        },
        { Authorization: `Bearer ${process.env.WISPR_API_KEY}` });
      return res.text || '';
    },
  },
};

async function callEngine(name, url, body, headers) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new HttpError(502, e.name === 'TimeoutError' ? `${name} took too long to respond` : `Could not reach ${name}`);
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 500);
    console.error(`${name} error`, res.status, detail);
    throw new HttpError(502, res.status === 401 || res.status === 403
      ? `${name} rejected the API key (check the key and that the API is enabled)`
      : `${name} error (${res.status})`);
  }
  return res.json();
}

const enabled = () => Object.entries(ENGINES).filter(([, e]) => process.env[e.key]);

// Lists the engines configured on the server.
export const GET = handler(async () => {
  await requireUser();
  return Response.json({
    engines: enabled().map(([id, e]) => ({ id, label: e.label, maxSeconds: e.maxSeconds })),
  });
});

// Body: { engine: 'google' | 'wispr', audio: base64 16 kHz mono WAV }  ->  { text }
export const POST = handler(async req => {
  const user = await requireUser();
  const { audio, engine: id } = await readJson(req);
  const engine = ENGINES[id];
  if (!engine || !process.env[engine.key]) throw new HttpError(400, 'That voice engine is not set up');
  if (typeof audio !== 'string' || !audio) throw new HttpError(400, 'No audio received');
  // 32,000 bytes per second of 16 kHz 16-bit audio, 4/3 larger as base64
  if (audio.length > (engine.maxSeconds + 2) * 32000 * 4 / 3) {
    throw new HttpError(413, `Recording is too long. Keep it under ${engine.maxSeconds} seconds.`);
  }

  // The company's own pattern and part names help the engine hear codes like "PT 102" correctly.
  const names = (await query(
    `SELECT PatternName AS n FROM PatternMaster WHERE CompanyID = ?
      UNION SELECT CustomerPartName FROM PatternMaster WHERE CompanyID = ? AND CustomerPartName IS NOT NULL
      LIMIT 400`,
    [user.cid, user.cid],
  ).catch(() => [])).map(r => r.n).filter(n => n && n.length <= 100);

  return Response.json({ text: await engine.transcribe(audio, names) });
});
