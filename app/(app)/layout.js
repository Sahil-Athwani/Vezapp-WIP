import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { APPS, allowedApps } from '@/lib/apps';
import Shell from '@/components/Shell';

export default async function AppLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const allowed = await allowedApps(session.cid).catch(() => []);
  const links = APPS.filter(a => allowed.includes(a.key)).map(a => ({ href: a.href, label: a.title }));
  return (
    <Shell
      session={{ name: session.name, email: session.email, company: session.company, role: session.role }}
      links={links}
    >
      {children}
    </Shell>
  );
}
