import { handler, requireUser, readJson, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

const WISPR_URL = 'https://platform-api.wisprflow.ai/api/v1/dash/api';
// ~90 s of 16 kHz 16-bit mono WAV as base64; also keeps us under Vercel's 4.5 MB request limit
const MAX_AUDIO_CHARS = 4_000_000;

// Field names are passed as dictionary words so Wispr spells them the way the parser expects.
const FIELD_TERMS = [
  'Pattern Name', 'Moulding Line', 'Moulding Process', 'Customer Part Name', 'Grade', 'Sub Grade',
  'No. Of Cavities', 'Moulding Date', 'Planned Mould', 'Good Mould', 'Reject Mould', 'Cavities Blocked',
  'Part Name', 'Knockout Stock', 'Shot Blast Stock', 'Knockout Rej', 'Shot Blasting Rej', 'WIP',
];

// Tells the voice bar whether Wispr Flow is configured on the server.
export const GET = handler(async () => {
  await requireUser();
  return Response.json({ wispr: !!process.env.WISPR_API_KEY });
});

// Body: { audio: base64 16 kHz mono WAV }  ->  { text }
export const POST = handler(async req => {
  const user = await requireUser();
  if (!process.env.WISPR_API_KEY) throw new HttpError(503, 'Wispr Flow is not set up. Add WISPR_API_KEY to .env');
  const { audio } = await readJson(req);
  if (typeof audio !== 'string' || !audio) throw new HttpError(400, 'No audio received');
  if (audio.length > MAX_AUDIO_CHARS) throw new HttpError(413, 'Recording is too long. Keep it under 90 seconds.');

  // The company's own pattern and part names help Wispr hear codes like "PT 102" correctly.
  const names = await query(
    `SELECT PatternName AS n FROM PatternMaster WHERE CompanyID = ?
      UNION SELECT CustomerPartName FROM PatternMaster WHERE CompanyID = ? AND CustomerPartName IS NOT NULL
      LIMIT 300`,
    [user.cid, user.cid],
  ).catch(() => []);

  let res;
  try {
    res = await fetch(WISPR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WISPR_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio,
        language: [process.env.WISPR_LANGUAGE || 'en'],
        context: {
          app: { name: 'Vezapp-WIP', type: 'other' },
          dictionary_context: [...FIELD_TERMS, ...names.map(r => r.n)],
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new HttpError(502, e.name === 'TimeoutError' ? 'Wispr Flow took too long to respond' : 'Could not reach Wispr Flow');
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    console.error('Wispr Flow error', res.status, detail);
    throw new HttpError(502, res.status === 401 || res.status === 403
      ? 'Wispr Flow rejected the API key'
      : `Wispr Flow error (${res.status})`);
  }
  const data = await res.json();
  return Response.json({ text: data.text || '' });
});
