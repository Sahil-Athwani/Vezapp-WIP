import { handler, requireUser, readJson, nextUID, HttpError } from '@/lib/api';
import { query, transaction } from '@/lib/db';
import { PATTERN_SELECT, patternColumns } from '@/lib/patterns';

// Readable from Mould Reporting and WIP too (pattern lookup / part name suggestions)
export const GET = handler(async req => {
  const user = await requireUser({ apps: ['pattern', 'mould', 'wip'] });
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  const rows = await query(
    `SELECT ${PATTERN_SELECT}, p.UpdatedAt AS updatedAt,
            COALESCE(r.GoodMoulds, 0) AS totalGoodMoulds, COALESCE(r.Reports, 0) AS reports
       FROM PatternMaster p
       LEFT JOIN (SELECT PatternUID, SUM(GoodMould) AS GoodMoulds, COUNT(*) AS Reports
                    FROM MouldReporting WHERE CompanyID = ? GROUP BY PatternUID) r ON r.PatternUID = p.PatternUID
      WHERE p.CompanyID = ? ${q ? 'AND (p.PatternName LIKE ? OR p.CustomerPartName LIKE ?)' : ''}
      ORDER BY p.PatternName
      LIMIT 1000`,
    q ? [user.cid, user.cid, `%${q}%`, `%${q}%`] : [user.cid, user.cid],
  );
  return Response.json({ rows });
});

export const POST = handler(async req => {
  const user = await requireUser({ apps: ['pattern'] });
  const cols = patternColumns(await readJson(req));
  const uid = await transaction(async q => {
    const [existing] = await q(
      'SELECT PatternUID, PatternName FROM PatternMaster WHERE CompanyID = ? AND PatternKey = ?',
      [user.cid, cols.PatternKey],
    );
    if (existing) {
      throw new HttpError(409, `Pattern ${existing.PatternName} already exists`, { exists: true, uid: existing.PatternUID });
    }
    const uid = await nextUID(q, user.cid, 'PTN');
    await q('INSERT INTO PatternMaster SET ?', [
      { ...cols, CompanyID: user.cid, PatternUID: uid, OwnerUserID: user.uid, UpdatedByUserID: user.uid },
    ]);
    return uid;
  });
  return Response.json({ uid }, { status: 201 });
});
