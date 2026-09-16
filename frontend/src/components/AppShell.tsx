'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSessionUser } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/contracts', label: 'Mis contratos' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getSessionUser();

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-institucional text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <p className="text-lg font-bold leading-tight">CONTRACTUS 360</p>
          <p className="text-xs text-white/70">Panel del contratista</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition ${
                pathname?.startsWith(item.href)
                  ? 'bg-white/15 text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs text-white/70">
          Herramienta de gestión interna. No reemplaza SECOP II.
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.fullName ?? 'Contratista'}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-institucional hover:underline"
            >
              Cerrar sesión
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 bg-[#f4f6fb]">{children}</main>
      </div>
    </div>
  );
}
