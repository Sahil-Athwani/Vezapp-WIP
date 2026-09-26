import { query } from './db';

// The three apps. If an APP_CODE_* env var is set, a company can use that app only while it has a
// row in Subscriptions with that AppCode covering today. If it is left blank, the app is open to all companies.
export const APPS = [
  { key: 'pattern', title: 'Pattern Master', href: '/pattern-master', env: 'APP_CODE_PATTERN_MASTER',
    desc: 'Create and update patterns: line, process, customer part, grade, cavities.' },
  { key: 'mould', title: 'Mould Reporting', href: '/mould-reporting', env: 'APP_CODE_MOULD_REPORTING',
    desc: 'Speak a pattern name to pull its details from Pattern Master, then report planned, good and rejected moulds.' },
  { key: 'wip', title: 'WIP', href: '/wip', env: 'APP_CODE_WIP',
    desc: 'Record knockout and shot blast stock and rejections by part.' },
];

export async function allowedApps(companyId) {
  const gated = APPS.filter(a => process.env[a.env]);
  let active = new Set();
  if (gated.length) {
    const rows = await query(
      `SELECT DISTINCT AppCode FROM Subscriptions
        WHERE CompanyID = ? AND AppCode IN (?) AND CURDATE() BETWEEN StartDate AND EndDate`,
      [companyId, gated.map(a => process.env[a.env])],
    );
    active = new Set(rows.map(r => r.AppCode));
  }
  return APPS.filter(a => !process.env[a.env] || active.has(process.env[a.env])).map(a => a.key);
}
