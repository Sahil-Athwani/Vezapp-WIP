import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'vf_session';
const MAX_AGE = 7 * 24 * 60 * 60;

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET is missing or shorter than 32 characters in .env');
  return new TextEncoder().encode(s);
}

// Session payload: uid (Users.UserID), cid (CompanyID), role ('Admin' | 'User'), name, email, company (CompanyName)
export async function createSession(user) {
  const token = await new SignJWT({
    uid: user.id, cid: user.companyId, role: user.role, name: user.name, email: user.email, company: user.companyName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload;
  } catch {
    return null;
  }
}
