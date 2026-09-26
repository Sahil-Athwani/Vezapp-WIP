import AppGate from '@/components/AppGate';
import WipApp from '@/components/apps/WipApp';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'WIP · Vezapp-WIP' };

export default async function Page() {
  const s = await getSession();
  return <AppGate app="wip"><WipApp isAdmin={s.role === 'Admin'} /></AppGate>;
}
