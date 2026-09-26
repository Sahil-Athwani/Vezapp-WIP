import { getSession } from './auth';
import { query } from './db';
import { APPS, allowedApps } from './apps';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// Wraps a route handler so thrown HttpErrors become JSON responses.
export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
      if (e.code === 'ER_DUP_ENTRY') return Response.json({ error: 'This entry already exists' }, { status: 409 });
      console.error(e);
      const msg = /not configured|AUTH_SECRET/.test(e.message) ? e.message
        : /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ER_ACCESS_DENIED|ER_BAD_DB/.test(e.code || '') ? 'Cannot connect to the database: ' + e.message
        : e.code === 'ER_NO_SUCH_TABLE' ? 'Database tables are missing. Run: npm run db:migrate'
        : 'Server error';
      return Response.json({ error: msg }, { status: 500 });
    }
  };
}

// Re-checks the user and company on every request (so deactivating in the main app takes effect
// immediately), and that the company is subscribed to at least one of `apps`.
// Every data query must be scoped by the returned `cid`.
export async function requireUser({ admin = false, apps } = {}) {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Please log in');
  const [u] = await query(
    `SELECT u.Role, u.Status, c.IsActive AS CompanyActive
       FROM Users u JOIN Companies c ON c.CompanyID = u.CompanyID
      WHERE u.UserID = ? AND u.CompanyID = ?`,
    [s.uid, s.cid],
  );
  if (!u || u.Status !== 'Active' || !u.CompanyActive) throw new HttpError(401, 'Your account is not active');
  if (admin && u.Role !== 'Admin') throw new HttpError(403, 'Only company admins can do this');
  if (apps) {
    const allowed = await allowedApps(s.cid);
    if (!apps.some(a => allowed.includes(a))) {
      const names = APPS.filter(a => apps.includes(a.key)).map(a => a.title).join(' / ');
      throw new HttpError(403, `Your company does not have an active ${names} subscription`);
    }
  }
  return { ...s, role: u.Role };
}

// Next per-company UID like PTN01, using the existing CompanyUIDCounters table.
// `q` must be a transaction's query function so LAST_INSERT_ID() stays on one connection.
export async function nextUID(q, companyId, prefix) {
  await q(
    `INSERT INTO CompanyUIDCounters (CompanyID, EntityPrefix, CurrentValue, PadWidth)
     VALUES (?, ?, LAST_INSERT_ID(1), 2)
     ON DUPLICATE KEY UPDATE CurrentValue = LAST_INSERT_ID(CurrentValue + 1)`,
    [companyId, prefix],
  );
  const [r] = await q(
    'SELECT LAST_INSERT_ID() AS v, PadWidth FROM CompanyUIDCounters WHERE CompanyID = ? AND EntityPrefix = ?',
    [companyId, prefix],
  );
  const uid = prefix + String(r.v).padStart(r.PadWidth || 2, '0');
  if (uid.length > 10) throw new Error(`UID ${uid} is longer than 10 characters`);
  return uid;
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request body');
  }
}

export async function routeUid(ctx) {
  const uid = String((await ctx.params).uid || '');
  if (!/^[A-Z]{2,5}\d{1,8}$/.test(uid)) throw new HttpError(404, 'Not found');
  return uid;
}

// ---- field validation ----
export function text(v, label, { max = 150, required = false } = {}) {
  const s = v == null ? '' : String(v).trim();
  if (!s) {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  if (s.length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
  return s;
}

export function count(v, label, { max = 10_000_000, required = false } = {}) {
  if (v == null || String(v).trim() === '') {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) throw new HttpError(400, `${label} must be a whole number from 0 to ${max}`);
  return n;
}

export function date(v, label, { required = false } = {}) {
  const s = v == null ? '' : String(v).trim();
  if (!s) {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  const d = new Date(s + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d) || d.toISOString().slice(0, 10) !== s) {
    throw new HttpError(400, `${label} must be a valid date`);
  }
  return s;
}
