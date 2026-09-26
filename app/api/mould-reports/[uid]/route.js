import { handler, requireUser, routeUid, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser({ admin: true, apps: ['mould'] });
  const r = await query('DELETE FROM MouldReporting WHERE CompanyID = ? AND MRUID = ?', [user.cid, await routeUid(ctx)]);
  if (!r.affectedRows) throw new HttpError(404, 'Report not found');
  return Response.json({ ok: true });
});
