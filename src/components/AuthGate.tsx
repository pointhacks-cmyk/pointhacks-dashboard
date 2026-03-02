'use client'

import { useEffect, useState } from 'react'

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#1A1A1A',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 32,
    }}>
      <div style={{ animation: 'pulse 2s ease-in-out infinite' }}>
        <img src="/logo-inverse.svg" alt="Point Hacks" style={{ width: 180, opacity: 0.9 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#34D399',
            animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
            opacity: 0.7,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.97); }
        }
      `}</style>
    </div>
  )
}

const ACCESS_CODE = 'Pointhacks2026!'

function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === ACCESS_CODE) {
      setSuccess(true)
      setError(false)
      setTimeout(() => { localStorage.setItem('ph-auth', password); onSuccess() }, 600)
    } else {
      setError(true)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#1A1A1A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, animation: 'fadeUp 0.6s ease-out', textAlign: 'center' }}>
        <img src="/logo-inverse.svg" alt="Point Hacks" style={{ width: 160, margin: '0 auto 16px' }} />
        <p style={{ fontSize: '0.85rem', color: '#707070', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
          Analytics Dashboard
        </p>

        <p style={{ fontSize: '0.8rem', color: '#8C8C8C', marginBottom: 20, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Enter password
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            autoFocus
            placeholder="Password"
            style={{
              width: '100%',
              height: 52,
              padding: '0 20px',
              fontSize: '1rem', fontWeight: 500,
              borderRadius: 12,
              border: `2px solid ${success ? '#34D39999' : error ? '#EF444480' : password ? '#34D3994d' : '#333333'}`,
              background: success ? '#34D39915' : error ? '#EF44440d' : '#2A2A2A',
              color: success ? '#34D399' : 'white',
              outline: 'none',
              transition: 'all 0.2s ease',
              caretColor: '#34D399',
              marginBottom: 16,
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: '1px solid #383838',
              background: '#2A2A2A',
              color: '#F5F5F5',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#363636' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2A2A2A' }}
          >
            Sign In
          </button>
        </form>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#f87171', marginTop: 16, animation: 'shake 0.4s ease-in-out' }}>
            Invalid password
          </div>
        )}

        {success && (
          <div style={{ fontSize: '0.8rem', color: '#34D399', marginTop: 16 }}>
            Access granted
          </div>
        )}

        <p style={{ fontSize: '0.7rem', color: '#383838', marginTop: 32 }}>
          Protected dashboard · Authorized users only
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('ph-auth')
    if (stored === ACCESS_CODE) {
      setAuthed(true)
    }
    setChecking(false)
  }, [])

  if (checking) return <LoadingScreen />
  if (!authed) return <AuthScreen onSuccess={() => setAuthed(true)} />
  return <>{children}</>
}
