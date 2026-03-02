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

const ACCESS_CODE = '20262026'

function AuthScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(8).fill(''))
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...digits]
    
    // Handle paste of full code
    if (value.length > 1) {
      const pasted = value.slice(0, 8).split('')
      for (let i = 0; i < 8; i++) newDigits[i] = pasted[i] || ''
      setDigits(newDigits)
      setError(false)
      const code = newDigits.join('')
      if (code.length === 8) {
        if (code === ACCESS_CODE) {
          setSuccess(true)
          setTimeout(() => { localStorage.setItem('ph-auth', code); onSuccess() }, 600)
        } else {
          setError(true)
        }
      }
      // Focus last filled or next empty
      const nextIdx = Math.min(pasted.length, 7)
      const el = document.getElementById(`code-${nextIdx}`)
      el?.focus()
      return
    }

    newDigits[index] = value
    setDigits(newDigits)
    setError(false)

    // Auto-advance
    if (value && index < 7) {
      const next = document.getElementById(`code-${index + 1}`)
      next?.focus()
    }

    // Check code when complete
    const code = newDigits.join('')
    if (code.length === 8) {
      if (code === ACCESS_CODE) {
        setSuccess(true)
        setTimeout(() => { localStorage.setItem('ph-auth', code); onSuccess() }, 600)
      } else {
        setError(true)
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prev = document.getElementById(`code-${index - 1}`)
      prev?.focus()
      const newDigits = [...digits]
      newDigits[index - 1] = ''
      setDigits(newDigits)
      setError(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#1A1A1A',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'transparent' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'transparent' }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, animation: 'fadeUp 0.6s ease-out', textAlign: 'center' }}>
        <img src="/logo-inverse.svg" alt="Point Hacks" style={{ width: 160, margin: '0 auto 16px' }} />
        <p style={{ fontSize: '0.85rem', color: '#707070', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 48 }}>
          Analytics Dashboard
        </p>

        <p style={{ fontSize: '0.8rem', color: '#8C8C8C', marginBottom: 20, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Enter access code
        </p>

        {/* Code inputs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {digits.map((d, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {i === 4 && <div style={{ position: 'absolute', left: -7, top: '50%', transform: 'translateY(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#383838' }} />}
              <input
                id={`code-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={i === 0 ? 8 : 1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={e => e.target.select()}
                autoFocus={i === 0}
                style={{
                  width: 44, height: 56,
                  textAlign: 'center',
                  fontSize: '1.4rem', fontWeight: 700,
                  borderRadius: 12,
                  border: `2px solid ${success ? '#34D39999' : error ? '#EF444480' : d ? '#34D3994d' : '#333333'}`,
                  background: success ? '#34D39915' : error ? '#EF44440d' : '#2A2A2A',
                  color: success ? '#34D399' : 'white',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  caretColor: '#34D399',
                }}
              />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: 16, animation: 'shake 0.4s ease-in-out' }}>
            Invalid access code
          </div>
        )}

        {success && (
          <div style={{ fontSize: '0.8rem', color: '#34D399', marginBottom: 16 }}>
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
