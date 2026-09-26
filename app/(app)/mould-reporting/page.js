import AppGate from '@/components/AppGate';
import MouldReportingApp from '@/components/apps/MouldReportingApp';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'Mould Reporting · Vezapp-WIP' };

export default async function Page() {
  const s = await getSession();
  return <AppGate app="mould"><MouldReportingApp isAdmin={s.role === 'Admin'} /></AppGate>;
}
