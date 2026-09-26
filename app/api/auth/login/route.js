import bcrypt from 'bcryptjs';
import { handler, readJson, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { createSession } from '@/lib/auth';

// Logs in against the existing Users / Companies tables (read-only).
export const POST = handler(async req => {
  const b = await readJson(req);
  const email = String(b.email || '').trim();
  const password = String(b.password || '');
  const [user] = await query(
    `SELECT u.UserID, u.Name, u.Email, u.Role, u.Status, u.CompanyID, u.PasswordHash,
            c.CompanyName, c.IsActive AS CompanyActive
       FROM Users u LEFT JOIN Companies c ON c.CompanyID = u.CompanyID
      WHERE u.Email = ?`,
    [email],
  );
  if (user && !/^\$2[aby]\$/.test(user.PasswordHash)) {
    console.error(`Unsupported password hash format for UserID ${user.UserID}`);
    throw new HttpError(500, 'This account uses a password format the app does not support yet');
  }
  if (!user || !(await bcrypt.compare(password, user.PasswordHash))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  if (user.Status !== 'Active') {
    throw new HttpError(403, user.Status === 'Pending' ? 'Your account is waiting for approval' : 'Your account is not active');
  }
  if (!user.CompanyID) throw new HttpError(403, 'Your account is not linked to a company');
  if (!user.CompanyActive) throw new HttpError(403, 'Your company account is not active');

  await createSession({
    id: user.UserID, companyId: user.CompanyID, role: user.Role, name: user.Name, email: user.Email,
    companyName: user.CompanyName,
  });
  return Response.json({ ok: true });
});
