import { query } from './db';

// The company's own pattern and customer part names — used to help speech engines and Claude recognise
// codes like "PT 102" that aren't ordinary words.
export async function companyNames(companyId, limit = 400) {
  const rows = await query(
    `SELECT PatternName AS n FROM PatternMaster WHERE CompanyID = ?
      UNION SELECT CustomerPartName FROM PatternMaster WHERE CompanyID = ? AND CustomerPartName IS NOT NULL
      LIMIT ${Number(limit)}`,
    [companyId, companyId],
  ).catch(() => []);
  return rows.map(r => r.n).filter(n => n && n.length <= 100);
}
