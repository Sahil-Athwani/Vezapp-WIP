import Anthropic from '@anthropic-ai/sdk';
import { FIELDS } from './voiceParser.js';

// Uses Claude to work out which spoken values belong in which form fields, even when speech-to-text
// mishears the field names ("short blood stock" = Shot Blast Stock) or the phrasing is natural
// ("rejected knockouts are 20").

const SYSTEM = `You fill in a foundry data-entry form from a voice transcript.

The transcript comes from speech recognition, which often mishears words. Typical mishearings:
"short blood stock" or "shoot blast stock" = shot blast stock; "knockouts" / "knock out" = knockout;
"patent name" / "party name" = pattern name / part name; "great" = grade; "mold" = mould;
"rejected knockouts are 20" = knockout rejection 20. Work out what the speaker meant and which form field
each spoken value belongs to.

Rules:
- Return only fields the speaker actually gave a value for. Never invent a value that was not spoken, and
  leave out fields that were not mentioned.
- A value usually follows its field name, but the speaker may also say it the other way round.
- If the same field is given twice, the later value wins (the speaker corrected themselves).
- Number fields: whole number as digits ("forty five" -> "45", "one zero two" -> "102").
- Date fields: YYYY-MM-DD. Resolve "today", "yesterday", or a day without a year using today's date.
- Text fields: the spoken value. If it clearly matches one of the company's known names, use that name's
  exact spelling.
- If you cannot tell which field a value belongs to, or cannot make out a value, leave it out and describe
  it briefly in "unclear". Otherwise set "unclear" to an empty string.
- "heard": the exact words from the transcript you used for that field (field name and value).

Latency-sensitive: the user is waiting at the form, so begin your answer immediately.`;

export class InterpretError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let client;
// baseURL is pinned so a stray ANTHROPIC_BASE_URL in the machine's environment can't redirect the key elsewhere.
const getClient = () => (client ??= new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com',
  timeout: 20_000,
  maxRetries: 1,
}));

// text: transcript; ids: field ids on this screen; today: 'YYYY-MM-DD'; names: company's known names.
// -> { values: { fieldId: value }, heard: [{ field, heard }], unclear }
export async function interpretTranscript({ text, ids, today, names = [] }) {
  const fieldList = ids.map(id => `- ${id}: "${FIELDS[id].label}" (${FIELDS[id].type})`).join('\n');
  const prompt = `Form fields on this screen:\n${fieldList}\n\n`
    + `Company's known pattern and part names: ${names.length ? names.join(', ') : '(none yet)'}\n\n`
    + `Today's date: ${today}\n\n<transcript>\n${text}\n</transcript>`;

  const schema = {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', enum: ids },
            value: { type: 'string' },
            heard: { type: 'string' },
          },
          required: ['field', 'value', 'heard'],
          additionalProperties: false,
        },
      },
      unclear: { type: 'string' },
    },
    required: ['fields', 'unclear'],
    additionalProperties: false,
  };

  let response;
  try {
    response = await getClient().beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema } },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      throw new InterpretError(502, 'Claude rejected the API key');
    }
    if (e instanceof Anthropic.RateLimitError) throw new InterpretError(503, 'Claude is busy, try again in a moment');
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new InterpretError(504, 'Claude took too long to respond');
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API error', e.status, e.message);
      throw new InterpretError(502, `Claude error (${e.status ?? 'network'})`);
    }
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new InterpretError(502, 'Claude could not process this transcript');

  let parsed;
  try {
    parsed = JSON.parse(response.content.find(b => b.type === 'text')?.text);
  } catch {
    throw new InterpretError(502, 'Claude returned an unexpected answer');
  }

  // Never trust model output blindly: keep only valid values for the requested fields.
  const values = {};
  const heard = [];
  for (const f of parsed.fields || []) {
    if (!ids.includes(f.field)) continue;
    const type = FIELDS[f.field].type;
    let v = String(f.value || '').trim();
    if (type === 'number') {
      v = v.replace(/[,\s]/g, '');
      if (!/^\d{1,8}$/.test(v)) continue;
      v = String(Number(v));
    } else if (type === 'date') {
      const d = new Date(v + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(d) || d.toISOString().slice(0, 10) !== v) continue;
    } else {
      v = v.toUpperCase().slice(0, 150);
      if (!v) continue;
    }
    values[f.field] = v;
    heard.push({ field: f.field, heard: String(f.heard || '').slice(0, 200) });
  }
  return { values, heard, unclear: String(parsed.unclear || '').slice(0, 300), model: response.model };
}
