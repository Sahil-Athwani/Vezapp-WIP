import { handler, requireUser, readJson, nextUID, text, count, date, HttpError } from '@/lib/api';
import { query, transaction } from '@/lib/db';

const REPORT_SELECT = `
  r.MRUID AS uid, r.MouldingDate AS mouldingDate, r.PlannedMouldNo AS plannedMouldNo, r.GoodMould AS goodMould,
  r.RejectMould AS rejectMould, r.CavitiesBlocked AS cavitiesBlocked, r.CreatedAt AS createdAt,
  r.PatternUID AS patternUid, r.PatternName AS patternName, r.MouldingLine AS mouldingLine,
  r.MouldingProcess AS mouldingProcess, r.CustomerPartName AS customerPartName,
  r.Grade AS grade, r.SubGrade AS subGrade, r.NoOfCavities AS noOfCavities, u.Name AS createdByName`;

// ?from=YYYY-MM-DD&to=YYYY-MM-DD[&patternUid=]  -> report rows + good moulds totalled per pattern
export const GET = handler(async req => {
  const user = await requireUser({ apps: ['mould'] });
  const sp = new URL(req.url).searchParams;
  const from = date(sp.get('from'), 'From date', { required: true });
  const to = date(sp.get('to'), 'To date', { required: true });
  const patternUid = text(sp.get('patternUid'), 'Pattern', { max: 10 });

  const where = `r.CompanyID = ? AND r.MouldingDate BETWEEN ? AND ?${patternUid ? ' AND r.PatternUID = ?' : ''}`;
  const params = patternUid ? [user.cid, from, to, patternUid] : [user.cid, from, to];

  const rows = await query(
    `SELECT ${REPORT_SELECT}
       FROM MouldReporting r LEFT JOIN Users u ON u.UserID = r.OwnerUserID
      WHERE ${where}
      ORDER BY r.MouldingDate DESC, r.CreatedAt DESC
      LIMIT 1000`,
    params,
  );
  const summary = await query(
    `SELECT r.PatternUID AS patternUid, MAX(r.PatternName) AS patternName, MAX(r.CustomerPartName) AS customerPartName,
            COUNT(*) AS reports, SUM(r.PlannedMouldNo) AS planned, SUM(r.GoodMould) AS good, SUM(r.RejectMould) AS rejected
       FROM MouldReporting r
      WHERE ${where}
      GROUP BY r.PatternUID
      ORDER BY good DESC`,
    params,
  );
  return Response.json({ rows, summary });
});

// Reports good moulds against a Pattern Master entry, copying the pattern's details into the report.
export const POST = handler(async req => {
  const user = await requireUser({ apps: ['mould'] });
  const b = await readJson(req);
  const patternUid = text(b.patternUid, 'Pattern', { max: 10, required: true });
  const values = {
    MouldingDate: date(b.mouldingDate, 'Moulding Date', { required: true }),
    PlannedMouldNo: count(b.plannedMouldNo, 'Planned Mould No'),
    GoodMould: count(b.goodMould, 'Good Mould', { required: true }),
    RejectMould: count(b.rejectMould, 'Reject Mould'),
    CavitiesBlocked: count(b.cavitiesBlocked, 'Cavities Blocked', { max: 1000 }),
  };

  const uid = await transaction(async q => {
    const [p] = await q(
      `SELECT PatternUID, PatternName, MouldingLine, MouldingProcess, CustomerPartName, Grade, SubGrade, NoOfCavities
         FROM PatternMaster WHERE CompanyID = ? AND PatternUID = ?`,
      [user.cid, patternUid],
    );
    if (!p) throw new HttpError(400, 'Pick a pattern from Pattern Master');
    if (values.CavitiesBlocked != null && p.NoOfCavities != null && values.CavitiesBlocked > p.NoOfCavities) {
      throw new HttpError(400, `Cavities Blocked (${values.CavitiesBlocked}) is more than the pattern's ${p.NoOfCavities} cavities`);
    }
    const uid = await nextUID(q, user.cid, 'MRP');
    await q('INSERT INTO MouldReporting SET ?', [{
      ...p, ...values, CompanyID: user.cid, MRUID: uid, OwnerUserID: user.uid,
    }]);
    return uid;
  });
  return Response.json({ uid }, { status: 201 });
});
