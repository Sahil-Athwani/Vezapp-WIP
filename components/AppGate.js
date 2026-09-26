import { getSession } from '@/lib/auth';
import { APPS, allowedApps } from '@/lib/apps';

// Server component: renders the app only if the company is subscribed to it.
export default async function AppGate({ app, children }) {
  const s = await getSession();
  let allowed;
  try {
    allowed = await allowedApps(s.cid);
  } catch (e) {
    return <p className="error">Cannot reach the database: {e.message}</p>;
  }
  if (!allowed.includes(app)) {
    const title = APPS.find(a => a.key === app).title;
    return (
      <section className="card">
        <h2>{title}</h2>
        <p>Your company doesn&apos;t have an active {title} subscription. Contact your administrator.</p>
      </section>
    );
  }
  return children;
}
