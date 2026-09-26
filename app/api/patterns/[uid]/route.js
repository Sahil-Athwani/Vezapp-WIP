import { handler, requireUser, readJson, routeUid, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { PATTERN_SELECT, patternColumns } from '@/lib/patterns';

async function findPattern(uid, cid) {
  const [p] = await query(`SELECT ${PATTERN_SELECT} FROM PatternMaster p WHERE p.CompanyID = ? AND p.PatternUID = ?`, [cid, uid]);
  if (!p) throw new HttpError(404, 'Pattern not found');
  return p;
}

export const GET = handler(async (req, ctx) => {
  const user = await requireUser({ apps: ['pattern', 'mould'] });
  return Response.json(await findPattern(await routeUid(ctx), user.cid));
});

// Body { ...fields, partial: true } updates only the non-blank fields (used when voice fills
// some fields of an existing pattern). Without partial, blank fields are cleared.
export const PUT = handler(async (req, ctx) => {
  const user = await requireUser({ apps: ['pattern'] });
  const uid = await routeUid(ctx);
  await findPattern(uid, user.cid);
  const body = await readJson(req);
  const cols = patternColumns(body);
  const update = body.partial ? Object.fromEntries(Object.entries(cols).filter(([, v]) => v !== null)) : cols;

  const [clash] = await query(
    'SELECT PatternName FROM PatternMaster WHERE CompanyID = ? AND PatternKey = ? AND PatternUID <> ?',
    [user.cid, cols.PatternKey, uid],
  );
  if (clash) throw new HttpError(409, `Another pattern named ${clash.PatternName} already exists`);

  await query('UPDATE PatternMaster SET ? WHERE CompanyID = ? AND PatternUID = ?', [
    { ...update, UpdatedByUserID: user.uid }, user.cid, uid,
  ]);
  return Response.json(await findPattern(uid, user.cid));
});

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser({ admin: true, apps: ['pattern'] });
  const uid = await routeUid(ctx);
  await findPattern(uid, user.cid);
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM MouldReporting WHERE CompanyID = ? AND PatternUID = ?', [user.cid, uid]);
  if (n > 0) throw new HttpError(409, `This pattern has ${n} mould report(s) and can't be deleted`);
  await query('DELETE FROM PatternMaster WHERE CompanyID = ? AND PatternUID = ?', [user.cid, uid]);
  return Response.json({ ok: true });
});
