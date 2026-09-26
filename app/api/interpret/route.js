import { handler, requireUser, readJson, HttpError } from '@/lib/api';
import { companyNames } from '@/lib/vocab';
import { FIELDS } from '@/lib/voiceParser';
import { interpretTranscript, InterpretError } from '@/lib/interpret';

// Tells the browser whether Claude is configured.
export const GET = handler(async () => {
  await requireUser();
  return Response.json({ enabled: !!process.env.ANTHROPIC_API_KEY });
});

// Body: { text, fields: [field ids on this screen], today: 'YYYY-MM-DD' }
// -> { values: { fieldId: value }, heard: [{ field, heard }], unclear }
export const POST = handler(async req => {
  const user = await requireUser();
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'Claude is not set up. Add ANTHROPIC_API_KEY to .env');
  const body = await readJson(req);
  const text = String(body.text || '').trim().slice(0, 4000);
  const ids = Array.isArray(body.fields) ? body.fields.filter(id => id in FIELDS) : [];
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  if (!text || !ids.length) throw new HttpError(400, 'Nothing to interpret');

  try {
    const { values, heard, unclear } = await interpretTranscript({
      text, ids, today, names: await companyNames(user.cid, 300),
    });
    return Response.json({ values, heard, unclear });
  } catch (e) {
    if (e instanceof InterpretError) throw new HttpError(e.status, e.message);
    throw e;
  }
});
