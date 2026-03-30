'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useState, useEffect } from 'react';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/trends', label: 'Trends' },
  { href: '/sources', label: 'Sources' },
  { href: '/settings', label: 'Settings' },
];

export function NavBar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-[#2d2d4e] bg-white/80 dark:bg-[#1a1a2e]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm">
              OS
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 hidden sm:block">
              OpportunityScout
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive =
                pathname === href ||
                (href !== '/dashboard' && pathname.startsWith(href));

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#252540]',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right side: theme toggle + mobile menu */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="btn-ghost p-2 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-[#2d2d4e] bg-white dark:bg-[#1a1a2e] px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={clsx(
                  'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                    : 'text-gray-600 dark:text-gray-400',
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
