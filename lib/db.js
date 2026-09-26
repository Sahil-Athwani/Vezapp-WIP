import mysql from 'mysql2/promise';

// One pool per serverless instance, reused across hot reloads and warm invocations.
export function getPool() {
  if (!globalThis._vfPool) {
    const missing = ['VOICE_DB_HOST', 'VOICE_DB_USER', 'VOICE_DB_NAME'].filter(k => !process.env[k]);
    if (missing.length) throw new Error('Database is not configured. Missing in .env: ' + missing.join(', '));
    globalThis._vfPool = mysql.createPool({
      host: process.env.VOICE_DB_HOST,
      port: Number(process.env.VOICE_DB_PORT || 3306),
      user: process.env.VOICE_DB_USER,
      password: process.env.VOICE_DB_PASSWORD,
      database: process.env.VOICE_DB_NAME,
      ssl: process.env.VOICE_DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.VOICE_DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined,
      waitForConnections: true,
      connectionLimit: Number(process.env.VOICE_DB_POOL_SIZE || 5),
      dateStrings: true,
    });
  }
  return globalThis._vfPool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

export async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(async (sql, params = []) => (await conn.query(sql, params))[0]);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
