import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAppStore } from '../../store/appStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/markets',
    label: 'Markets',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    path: '/signals',
    label: 'Signal History',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    path: '/backtesting',
    label: 'Backtesting',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: '/performance',
    label: 'Performance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'AI Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const Sidebar: React.FC = () => {
  const setShowLoginModal = useAppStore((s) => s.setShowLoginModal);
  const binomoBalance = useAppStore((s) => s.binomoBalance);
  const binomoCurrency = useAppStore((s) => s.binomoCurrency);
  const binomoAccountType = useAppStore((s) => s.binomoAccountType);

  return (
    <aside className="hidden md:flex bg-gray-950 border-r border-gray-800 w-16 md:w-56 flex-col flex-shrink-0 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-yellow-500 text-black font-black flex items-center justify-center flex-shrink-0 text-base shadow-md shadow-yellow-500/20">
          B
        </div>
        <span className="hidden md:block text-white font-bold text-sm leading-tight">
          Binomo Live<br />
          <span className="text-yellow-400 font-semibold text-xs">AI OTC Feed</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              )
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="hidden md:block">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Binomo Login Quick Button */}
      <div className="p-3 border-t border-gray-800/80">
        <button
          onClick={() => setShowLoginModal(true)}
          className="w-full p-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-extrabold text-xs shadow-md shadow-yellow-500/10 flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>🔑</span>
          <span className="hidden md:inline">Binomo Login</span>
        </button>
        <div className="hidden md:flex items-center justify-between text-[10px] text-gray-500 mt-2 px-1">
          <span className="capitalize">{binomoAccountType}</span>
          <span className="text-yellow-400 font-bold">{binomoCurrency} {binomoBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800">
        <p className="hidden md:block text-gray-600 text-xs">
          v2.5 · 24/7 OTC Active
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
