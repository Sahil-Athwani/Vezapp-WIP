import AppGate from '@/components/AppGate';
import PatternMasterApp from '@/components/apps/PatternMasterApp';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'Pattern Master · Vezapp-WIP' };

export default async function Page() {
  const s = await getSession();
  return <AppGate app="pattern"><PatternMasterApp isAdmin={s.role === 'Admin'} /></AppGate>;
}
