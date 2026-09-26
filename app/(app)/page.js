import { getSession } from '@/lib/auth';
import { allowedApps } from '@/lib/apps';
import Dashboard from '@/components/Dashboard';

export const metadata = { title: 'Dashboard · Vezapp-WIP' };

export default async function Home() {
  const s = await getSession();
  let allowed = [], dbError = null;
  try {
    allowed = await allowedApps(s.cid);
  } catch (e) {
    dbError = e.message;
  }
  if (dbError) return <p className="error">Cannot reach the database: {dbError}</p>;
  if (!allowed.length) {
    return (
      <section className="card">
        <h2>No active apps</h2>
        <p className="muted">Your company has no active Vezapp-WIP subscriptions. Contact your administrator.</p>
      </section>
    );
  }
  return <Dashboard firstName={(s.name || '').split(' ')[0]} allowed={allowed} />;
}
