import { handler, requireUser, text, date } from '@/lib/api';
import { query } from '@/lib/db';
import { allowedApps } from '@/lib/apps';

// ?from=YYYY-MM-DD&to=YYYY-MM-DD[&patternUid=]
// Returns only the sections for apps the company is subscribed to (others are null).
export const GET = handler(async req => {
  const user = await requireUser({ apps: ['pattern', 'mould', 'wip'] });
  const allowed = await allowedApps(user.cid);
  const sp = new URL(req.url).searchParams;
  const from = date(sp.get('from'), 'From date', { required: true });
  const to = date(sp.get('to'), 'To date', { required: true });
  const patternUid = text(sp.get('patternUid'), 'Pattern', { max: 10 });
  const out = { patterns: null, mould: null, wip: null };

  if (allowed.includes('pattern') || allowed.includes('mould')) {
    out.patterns = await query(
      'SELECT PatternUID AS uid, PatternName AS patternName FROM PatternMaster WHERE CompanyID = ? ORDER BY PatternName LIMIT 1000',
      [user.cid],
    );
  }

  if (allowed.includes('mould')) {
    const where = `CompanyID = ? AND MouldingDate BETWEEN ? AND ?${patternUid ? ' AND PatternUID = ?' : ''}`;
    const params = patternUid ? [user.cid, from, to, patternUid] : [user.cid, from, to];
    const [totals] = await query(
      `SELECT COUNT(*) AS reports, COALESCE(SUM(GoodMould), 0) AS good, COALESCE(SUM(RejectMould), 0) AS reject,
              COALESCE(SUM(PlannedMouldNo), 0) AS planned
         FROM MouldReporting WHERE ${where}`,
      params,
    );
    const series = await query(
      `SELECT MouldingDate AS date, SUM(GoodMould) AS good, COALESCE(SUM(RejectMould), 0) AS reject
         FROM MouldReporting WHERE ${where} GROUP BY MouldingDate ORDER BY MouldingDate`,
      params,
    );
    const top = await query(
      `SELECT PatternUID AS uid, MAX(PatternName) AS patternName, SUM(GoodMould) AS good, COALESCE(SUM(RejectMould), 0) AS reject
         FROM MouldReporting WHERE ${where} GROUP BY PatternUID ORDER BY good DESC LIMIT 6`,
      params,
    );
    const num = v => Number(v || 0);
    out.mould = {
      totals: { reports: num(totals.reports), good: num(totals.good), reject: num(totals.reject), planned: num(totals.planned) },
      series: series.map(r => ({ date: r.date, good: num(r.good), reject: num(r.reject) })),
      top: top.map(r => ({ ...r, good: num(r.good), reject: num(r.reject) })),
    };
  }

  if (allowed.includes('wip')) {
    // Stock is a snapshot: take each part's latest entry up to the end date. Rejections add up over the range.
    const [stock] = await query(
      `SELECT COUNT(*) AS parts, COALESCE(SUM(w.KnockoutStock), 0) AS knockoutStock, COALESCE(SUM(w.ShotBlastStock), 0) AS shotBlastStock
         FROM WIPReporting w
         JOIN (SELECT PartName, MAX(CreatedAt) AS latest FROM WIPReporting
                WHERE CompanyID = ? AND CreatedAt < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY PartName) l
           ON l.PartName = w.PartName AND l.latest = w.CreatedAt
        WHERE w.CompanyID = ?`,
      [user.cid, to, user.cid],
    );
    const [range] = await query(
      `SELECT COUNT(*) AS entries, COALESCE(SUM(KnockoutRej), 0) AS knockoutRej, COALESCE(SUM(ShotBlastingRej), 0) AS shotBlastRej
         FROM WIPReporting WHERE CompanyID = ? AND CreatedAt >= ? AND CreatedAt < DATE_ADD(?, INTERVAL 1 DAY)`,
      [user.cid, from, to],
    );
    out.wip = Object.fromEntries(Object.entries({ ...stock, ...range }).map(([k, v]) => [k, Number(v || 0)]));
  }

  return Response.json(out);
});
