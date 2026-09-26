import { handler, requireUser, routeUid, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

export const DELETE = handler(async (req, ctx) => {
  const user = await requireUser({ admin: true, apps: ['wip'] });
  const r = await query('DELETE FROM WIPReporting WHERE CompanyID = ? AND WIPUID = ?', [user.cid, await routeUid(ctx)]);
  if (!r.affectedRows) throw new HttpError(404, 'Entry not found');
  return Response.json({ ok: true });
});
