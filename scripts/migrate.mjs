// Creates PatternMaster, MouldReporting and WIPReporting. Safe to run repeatedly: it only runs
// CREATE TABLE IF NOT EXISTS, never drops or alters anything, and then verifies that each table
// (new or pre-existing) has the columns this app needs.
//   npm run db:migrate
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const missing = ['VOICE_DB_HOST', 'VOICE_DB_USER', 'VOICE_DB_NAME'].filter(k => !process.env[k]);
if (missing.length) {
  console.error('Fill these in .env first: ' + missing.join(', '));
  process.exit(1);
}

// Existing tables/columns the app reads, and columns the new tables must have.
const REQUIRED = {
  Companies: ['CompanyID', 'CompanyName', 'IsActive'],
  Users: ['UserID', 'Name', 'Email', 'PasswordHash', 'Role', 'CompanyID', 'Status'],
  Subscriptions: ['CompanyID', 'AppCode', 'StartDate', 'EndDate'],
  CompanyUIDCounters: ['CompanyID', 'EntityPrefix', 'CurrentValue', 'PadWidth'],
  PatternMaster: ['CompanyID', 'PatternUID', 'PatternName', 'PatternKey', 'MouldingLine', 'MouldingProcess',
    'CustomerPartName', 'Grade', 'SubGrade', 'NoOfCavities', 'OwnerUserID', 'UpdatedByUserID', 'UpdatedAt'],
  MouldReporting: ['CompanyID', 'MRUID', 'PatternUID', 'PatternName', 'MouldingDate', 'PlannedMouldNo',
    'GoodMould', 'RejectMould', 'CavitiesBlocked', 'OwnerUserID', 'CreatedAt'],
  WIPReporting: ['CompanyID', 'WIPUID', 'PartName', 'KnockoutStock', 'ShotBlastStock', 'KnockoutRej',
    'ShotBlastingRej', 'OwnerUserID', 'CreatedAt'],
};

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
const statements = sql
  .split(/;\s*$/m)
  .map(s => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean);

const conn = await mysql.createConnection({
  host: process.env.VOICE_DB_HOST,
  port: Number(process.env.VOICE_DB_PORT || 3306),
  user: process.env.VOICE_DB_USER,
  password: process.env.VOICE_DB_PASSWORD,
  database: process.env.VOICE_DB_NAME,
  ssl: process.env.VOICE_DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.VOICE_DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
});

async function columnsOf(table) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [table],
  );
  return new Set(rows.map(r => r.c));
}

try {
  for (const t of ['Companies', 'Users', 'Subscriptions', 'CompanyUIDCounters']) {
    const cols = await columnsOf(t);
    if (!cols.size) throw new Error(`Existing table ${t} was not found in ${process.env.VOICE_DB_NAME}. Is VOICE_DB_NAME correct?`);
  }

  for (const stmt of statements) {
    const table = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)[1];
    const existed = (await columnsOf(table)).size > 0;
    await conn.query(stmt);
    console.log(existed ? `  exists   ${table} (left unchanged)` : `  created  ${table}`);
  }

  let ok = true;
  for (const [table, need] of Object.entries(REQUIRED)) {
    const have = await columnsOf(table);
    const lacking = need.filter(c => !have.has(c));
    if (lacking.length) {
      ok = false;
      console.error(`  ERROR    ${table} is missing columns: ${lacking.join(', ')}`);
    }
  }
  if (!ok) throw new Error('Some tables do not match what the app expects (see above). No existing table was altered.');
  console.log(`Done. Database ${process.env.VOICE_DB_NAME} is ready.`);
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
