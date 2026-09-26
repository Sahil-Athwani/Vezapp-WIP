import { handler, requireUser, readJson, nextUID, text, count, date } from '@/lib/api';
import { query, transaction } from '@/lib/db';

// ?from=YYYY-MM-DD&to=YYYY-MM-DD filters by entry date
export const GET = handler(async req => {
  const user = await requireUser({ apps: ['wip'] });
  const sp = new URL(req.url).searchParams;
  const from = date(sp.get('from'), 'From date', { required: true });
  const to = date(sp.get('to'), 'To date', { required: true });
  const rows = await query(
    `SELECT w.WIPUID AS uid, w.PartName AS partName, w.KnockoutStock AS knockoutStock,
            w.ShotBlastStock AS shotBlastStock, w.KnockoutRej AS knockoutRej, w.ShotBlastingRej AS shotBlastRej,
            w.CreatedAt AS createdAt, u.Name AS createdByName
       FROM WIPReporting w LEFT JOIN Users u ON u.UserID = w.OwnerUserID
      WHERE w.CompanyID = ? AND w.CreatedAt >= ? AND w.CreatedAt < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY w.CreatedAt DESC
      LIMIT 1000`,
    [user.cid, from, to],
  );
  return Response.json({ rows });
});

export const POST = handler(async req => {
  const user = await requireUser({ apps: ['wip'] });
  const b = await readJson(req);
  const values = {
    PartName: text(b.partName, 'Part Name', { max: 255, required: true }),
    KnockoutStock: count(b.knockoutStock, 'Knockout Stock'),
    ShotBlastStock: count(b.shotBlastStock, 'Shot Blast Stock'),
    KnockoutRej: count(b.knockoutRej, 'Knockout Rej'),
    ShotBlastingRej: count(b.shotBlastRej, 'Shot Blasting Rej'),
  };
  const uid = await transaction(async q => {
    const uid = await nextUID(q, user.cid, 'WIP');
    await q('INSERT INTO WIPReporting SET ?', [{ ...values, CompanyID: user.cid, WIPUID: uid, OwnerUserID: user.uid }]);
    return uid;
  });
  return Response.json({ uid }, { status: 201 });
});
