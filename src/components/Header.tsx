'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  Settings,
  BookMarked,
  Sun,
  Moon,
  Monitor,
  Wand2,
  Menu,
  X,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

export const Header: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    if (nextTheme) {
      setTheme(nextTheme);
    }
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/generator', label: 'Generator', icon: Wand2 },
    { href: '/library', label: 'Pokédex', icon: BookOpen },
    { href: '/admin', label: 'Settings', icon: Settings },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className="border-b-2 shadow-md"
      style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-elevated)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo - simplified on mobile */}
        <Link href="/" className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shadow-lg"
            style={{ background: 'var(--accent-primary)' }}
          >
            <BookMarked className="h-6 w-6" style={{ color: 'var(--text-inverse)' }} />
          </div>
          {/* Hide text on mobile, show on md+ */}
          <div className="hidden md:block">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Field Logs
            </h1>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Pokédex Research System
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={isActive ? 'btn btn-primary' : 'btn btn-ghost'}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}

          <div className="mx-2 h-6 w-px" style={{ background: 'var(--border-secondary)' }} />

          <button onClick={cycleTheme} className="btn btn-ghost" title={`Theme: ${theme}`}>
            <ThemeIcon className="h-4 w-4" />
          </button>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <button onClick={cycleTheme} className="btn btn-ghost" title={`Theme: ${theme}`}>
            <ThemeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn btn-ghost"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div
          className="border-t-2 md:hidden"
          style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-elevated)' }}
        >
          <nav className="flex flex-col gap-2 px-6 py-4">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 transition-all ${
                    isActive ? 'font-semibold' : ''
                  }`}
                  style={{
                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? 'var(--text-inverse)' : 'var(--text-primary)',
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};
