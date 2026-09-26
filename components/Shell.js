'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Layers, Factory, PackageSearch, LogOut, Menu } from 'lucide-react';

const ICONS = { '/pattern-master': Layers, '/mould-reporting': Factory, '/wip': PackageSearch };

// Sidebar + top bar around every signed-in page.
export default function Shell({ session, links, children }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const nav = [{ href: '/', label: 'Dashboard', Icon: LayoutDashboard }, ...links.map(l => ({ ...l, Icon: ICONS[l.href] }))];
  const current = nav.find(l => (l.href === '/' ? path === '/' : path.startsWith(l.href)));
  const role = session.role === 'Admin' ? 'Admin' : 'User';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <Link href="/" className="sidebar-brand">
          <img src="/logo.svg" alt="" />
          <span>Vezapp-WIP</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Main">
          {nav.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={current?.href === href ? 'active' : ''}>
              <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card">
            <div className="name">{session.name}</div>
            {session.email && <div className="email">{session.email}</div>}
            <div className="muted" style={{ fontSize: '.8rem' }}>{session.company}</div>
            <span className="role-badge">{role}</span>
          </div>
          <button type="button" className="secondary signout" onClick={logout}>
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>
      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={20} aria-hidden="true" />
            </button>
            <h1>{current?.label || 'Vezapp-WIP'}</h1>
          </div>
          <div className="topbar-user">
            <div>
              <div className="name">{session.name}</div>
              <div className="role">{role}</div>
            </div>
            <div className="avatar" aria-hidden="true">{(session.name || '?').trim().charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
