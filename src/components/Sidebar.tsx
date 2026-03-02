'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Search,
  Link as LinkIcon,
  Lightbulb,
  MessageCircle,
  X,
  Users,
  PenTool,
  Shield,
  Settings,
  LogOut,
  ChevronUp,
} from 'lucide-react'

const navSections = [
  {
    label: 'ANALYTICS',
    items: [
      { name: 'Overview', href: '/', icon: Home },
      { name: 'Monitor', href: '/monitor', icon: Shield, emphasis: true },
      { name: 'Search & SEO', href: '/search', icon: Search },
      { name: 'SEO Intelligence', href: '/seo', icon: LinkIcon },
      { name: 'Content Queue', href: '/content', icon: PenTool },
      { name: 'Audience', href: '/audience', icon: Users },
    ],
  },
  {
    label: 'AI',
    items: [
      { name: 'Recommendations', href: '/recommendations', icon: Lightbulb, badge: true },
      { name: 'AI Chat', href: '/chat', icon: MessageCircle },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

const COLLAPSED_W = 68
const EXPANDED_W = 250

const teamMembers = [
  { name: 'Keith', role: 'Admin', initials: 'KS', color: '#34D399', email: 'keith@pointhacks.com.au', status: 'online' },
  { name: 'Daniel', role: 'Editor', initials: 'DW', color: '#6366f1', email: 'daniel@pointhacks.com.au', status: 'online' },
  { name: 'Sarah', role: 'SEO Lead', initials: 'SM', color: '#8B5CF6', email: 'sarah@pointhacks.com.au', status: 'away' },
  { name: 'James', role: 'Content', initials: 'JL', color: '#F59E0B', email: 'james@pointhacks.com.au', status: 'offline' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const activeUser = teamMembers[0] // Keith is active user

  // Listen for mobile hamburger toggle
  useEffect(() => {
    const handler = () => setOpen(prev => !prev)
    window.addEventListener('toggle-mobile-sidebar', handler)
    return () => window.removeEventListener('toggle-mobile-sidebar', handler)
  }, [])

  const expanded = hovered
  const sidebarWidth = expanded ? EXPANDED_W : COLLAPSED_W

  const sidebarContent = (mobile: boolean) => {
    const show = mobile || expanded
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div style={{
          padding: show ? '18px 20px 14px' : '18px 12px 14px',
          borderBottom: '1px solid #333333',
          display: 'flex', justifyContent: 'center',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>
          {show ? (
            <img src="/logo-inverse.svg" alt="Point Hacks" style={{ maxWidth: 130, height: 'auto', objectFit: 'contain' }} />
          ) : (
            <img src="/logo-inverse.svg" alt="Point Hacks" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: show ? '16px 10px' : '16px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {navSections.map((section, sIdx) => (
            <div key={section.label}>
              {sIdx > 0 && (
                <div style={{ height: 1, background: '#333333', margin: show ? '4px 8px 14px' : '8px 4px 12px' }} />
              )}
              {show && (
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                  color: '#606060', padding: '0 8px 8px',
                  transition: 'opacity 0.2s',
                }}>
                  {section.label}
                </div>
              )}
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                const hasBadge = 'badge' in item && (item as any).badge
                const isEmphasis = 'emphasis' in item && (item as any).emphasis
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    title={!show ? item.name : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: show ? 'flex-start' : 'center',
                      gap: show ? 10 : 0,
                      padding: show ? '11px 12px' : '11px 8px',
                      minHeight: 44,
                      borderRadius: 10,
                      fontSize: 13.5,
                      fontWeight: active ? 600 : isEmphasis ? 600 : 500,
                      color: active ? 'white'
                        : isEmphasis ? '#34D399'
                        : '#8C8C8C',
                      background: active
                        ? isEmphasis ? '#34D39920' : '#404040'
                        : 'transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                      marginBottom: 2,
                      position: 'relative',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      ...(isEmphasis && !active ? {  } : {}),
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = isEmphasis ? '#34D399' : '#ECECEC'
                        e.currentTarget.style.background = isEmphasis ? '#34D39915' : '#333333'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = isEmphasis ? '#34D399' : '#8C8C8C'
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    {show && <span style={{ flex: 1 }}>{item.name}</span>}
                    {hasBadge && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: '#EF4444',
                        animation: 'pulse-dot 2s ease-in-out infinite',
                        flexShrink: 0,
                        position: !show ? 'absolute' : 'relative',
                        top: !show ? 7 : 'auto',
                        right: !show ? 7 : 'auto',
                      }} />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Team Avatars (collapsed: stacked, expanded: list) */}
        {show && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid #333333' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#606060', padding: '0 8px 8px' }}>
              TEAM
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {teamMembers.map(member => (
                <div key={member.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `${member.color}25`, border: `1.5px solid ${member.color}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: member.color,
                    }}>
                      {member.initials}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: -1, right: -1,
                      width: 9, height: 9, borderRadius: '50%',
                      background: member.status === 'online' ? '#34D399' : member.status === 'away' ? '#F59E0B' : '#404040',
                      border: '2px solid #1E1E1E',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#ECECEC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                    <div style={{ fontSize: 10, color: '#606060' }}>{member.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!show && (
          <div style={{ padding: '8px 0 4px', borderTop: '1px solid #333333', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {teamMembers.slice(0, 3).map(member => (
              <div key={member.name} title={`${member.name} - ${member.status}`} style={{ position: 'relative' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `${member.color}25`, border: `1.5px solid ${member.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: member.color,
                }}>
                  {member.initials}
                </div>
                <div style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 8, height: 8, borderRadius: '50%',
                  background: member.status === 'online' ? '#34D399' : member.status === 'away' ? '#F59E0B' : '#404040',
                  border: '2px solid #1E1E1E',
                }} />
              </div>
            ))}
            {teamMembers.length > 3 && (
              <div style={{ fontSize: 9, color: '#4A4A4A', fontWeight: 600 }}>+{teamMembers.length - 3}</div>
            )}
          </div>
        )}

        {/* Profile / Account */}
        <div style={{ borderTop: '1px solid #333333', position: 'relative' }}>
          {/* Profile popup (expanded mode) */}
          {profileOpen && show && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 8, right: 8,
              background: '#2A2A2A', border: '1px solid #333333',
              borderRadius: 14, padding: 16, marginBottom: 4,
               boxShadow: '0 -8px 30px #1A1A1A',
            }}>
              {/* Profile header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: `${activeUser.color}20`, border: `2px solid ${activeUser.color}60`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: activeUser.color,
                }}>
                  {activeUser.initials}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{activeUser.name}</div>
                  <div style={{ fontSize: 11, color: '#8A8A8A' }}>{activeUser.email}</div>
                </div>
              </div>

              {/* Role badge */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${activeUser.color}15`, color: activeUser.color }}>{activeUser.role}</span>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#34D3991a', color: '#34D399' }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34D399', marginRight: 4, verticalAlign: 'middle' }}></span>
                  Online
                </span>
              </div>

              {/* Menu items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { icon: Settings, label: 'Account Settings', href: '/settings' },
                ].map(item => (
                  <Link key={item.label} href={item.href} onClick={() => { setProfileOpen(false); setOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                    fontSize: 12, fontWeight: 500, color: '#9A9A9A', textDecoration: 'none',
                    transition: 'background 0.15s',
                  }} onMouseEnter={e => e.currentTarget.style.background = '#333333'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <item.icon size={15} /> {item.label}
                  </Link>
                ))}
                <div style={{ height: 1, background: '#2A2A2A', margin: '4px 0' }} />
                <button onClick={() => {
                  localStorage.removeItem('ph-auth')
                  window.location.reload()
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                  fontSize: 12, fontWeight: 500, color: '#EF4444', background: 'transparent', border: 'none',
                  cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 0.15s',
                }} onMouseEnter={e => e.currentTarget.style.background = '#EF444415'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Profile trigger */}
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: show ? 'flex-start' : 'center',
              gap: show ? 10 : 0, width: '100%',
              padding: show ? '12px 14px' : '12px 0',
              background: profileOpen ? '#2A2A2A' : 'transparent',
              border: 'none', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#2A2A2A'}
            onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `${activeUser.color}20`, border: `2px solid ${activeUser.color}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: activeUser.color,
              }}>
                {activeUser.initials}
              </div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: '50%',
                background: '#34D399', border: '2px solid #1E1E1E',
              }} />
            </div>
            {show && (
              <>
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#ECECEC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeUser.name}</div>
                  <div style={{ fontSize: 10, color: '#707070' }}>{activeUser.role}</div>
                </div>
                <ChevronUp size={14} style={{ color: '#4A4A4A', transform: profileOpen ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: sidebarWidth,
          height: '100vh',
          background: '#1E1E1E',
          
          
          borderRight: '1px solid #333333',
          zIndex: 50,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
      >
        {sidebarContent(false)}
      </aside>

      {/* Spacer for main content — always uses collapsed width so content doesn't shift */}
      <style>{`
        @media (min-width: 768px) {
          main { margin-left: ${COLLAPSED_W}px !important; }
        }
      `}</style>

      {/* Mobile overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: '#1A1A1A', zIndex: 55 }}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className="md:hidden"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 260, height: '100vh',
          background: '#1E1E1E',
          
          
          borderRight: '1px solid #333333',
          zIndex: 60,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: 20, right: 16,
            background: '#383838', border: 'none',
            borderRadius: 8, padding: 6, color: 'white', cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
        {sidebarContent(true)}
      </aside>
    </>
  )
}
