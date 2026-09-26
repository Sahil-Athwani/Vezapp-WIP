import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function AuthLayout({ children }) {
  if (await getSession()) redirect('/');
  return (
    <main className="auth-wrap">
      <div className="auth-blob a" />
      <div className="auth-blob b" />
      <div className="auth-dots" />
      {children}
      <p className="auth-foot">© {new Date().getFullYear()} Vezapp-WIP — Moulding &amp; WIP Reporting</p>
    </main>
  );
}
