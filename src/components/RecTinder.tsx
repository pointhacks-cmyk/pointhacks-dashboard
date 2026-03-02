'use client'

import { useState, useCallback } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { Check, X, RotateCcw, Wrench, Brain, Search as SearchIcon, FileText, Target, TrendingDown, Lightbulb, TrendingUp, Zap, ArrowUp, BarChart3 } from 'lucide-react'

const TEAL = '#34D399', RED = '#EF4444', NAVY = '#6366f1', GOLD = '#F59E0B', PURPLE = '#8B5CF6'

export interface TinderRec {
  id: string
  severity: 'critical' | 'opportunity' | 'info'
  category: string
  iconType: string
  title: string
  body: string
  impact: 'high' | 'medium' | 'low'
  item: string
  metrics: { label: string; value: string }[]
}

type SwipeAction = 'approve' | 'fix' | 'analysis' | 'skip'

const sevColor: Record<string, string> = { critical: RED, opportunity: TEAL, info: '#6699ff' }
const sevGradient: Record<string, string> = {
  critical: '#EF444410',
  opportunity: '#34D39912',
  info: '#3b82f610',
}
const impactConfig: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: RED, bg: `${RED}15`, label: 'HIGH IMPACT' },
  medium: { color: GOLD, bg: `${GOLD}12`, label: 'MEDIUM' },
  low: { color: TEAL, bg: `${TEAL}12`, label: 'LOW' },
}
const iconMap: Record<string, typeof SearchIcon> = { search: SearchIcon, file: FileText, target: Target, 'trending-down': TrendingDown, lightbulb: Lightbulb }

const spring = { type: 'spring' as const, stiffness: 260, damping: 28 }

interface Props {
  recommendations: TinderRec[]
  onComplete: (results: { id: string; action: SwipeAction }[]) => void
  onClose: () => void
}

export default function RecTinder({ recommendations, onComplete, onClose }: Props) {
  const [cards, setCards] = useState(recommendations)
  const [results, setResults] = useState<{ id: string; action: SwipeAction }[]>([])
  const [exitDir, setExitDir] = useState<{ x: number; y: number; rotate: number } | null>(null)

  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const rotateZ = useTransform(dragX, [-300, 0, 300], [-15, 0, 15])
  const overlayRight = useTransform(dragX, [0, 60, 180], [0, 0.5, 1])
  const overlayLeft = useTransform(dragX, [-180, -60, 0], [1, 0.5, 0])
  const overlayUp = useTransform(dragY, [-180, -60, 0], [1, 0.5, 0])
  const overlayDown = useTransform(dragY, [0, 60, 180], [0, 0.5, 1])
  // Card border glow based on drag direction
  const borderR = useTransform(dragX, [0, 100], ['#2A2A2A', `${TEAL}40`])
  const borderL = useTransform(dragX, [-100, 0], ['#606060', '#2A2A2A'])

  const total = recommendations.length
  const reviewed = results.length
  const done = cards.length === 0
  const approvedCount = results.filter(r => r.action === 'approve').length
  const fixCount = results.filter(r => r.action === 'fix').length
  const analyseCount = results.filter(r => r.action === 'analysis').length
  const skipCount = results.filter(r => r.action === 'skip').length

  const dismiss = useCallback((action: SwipeAction) => {
    if (cards.length === 0) return
    const current = cards[0]
    const dirs: Record<SwipeAction, { x: number; y: number; rotate: number }> = {
      approve: { x: 500, y: -30, rotate: 15 },
      skip: { x: -500, y: -30, rotate: -15 },
      analysis: { x: 0, y: -500, rotate: 3 },
      fix: { x: 0, y: 500, rotate: -3 },
    }
    setExitDir(dirs[action])
    setTimeout(() => {
      setResults(prev => [...prev, { id: current.id, action }])
      setCards(prev => prev.slice(1))
      setExitDir(null)
      dragX.set(0)
      dragY.set(0)
    }, 200)
  }, [cards, dragX, dragY])

  const handleUndo = () => {
    if (results.length === 0) return
    const last = results[results.length - 1]
    const rec = recommendations.find(r => r.id === last.id)
    if (rec) {
      setCards(prev => [rec, ...prev])
      setResults(prev => prev.slice(0, -1))
    }
  }

  const handleDragEnd = (_: any, info: any) => {
    const { offset, velocity } = info
    if (offset.x > 70 || velocity.x > 400) dismiss('approve')
    else if (offset.x < -70 || velocity.x < -400) dismiss('skip')
    else if (offset.y < -70 || velocity.y < -400) dismiss('analysis')
    else if (offset.y > 70 || velocity.y > 400) dismiss('fix')
    dragX.set(0)
    dragY.set(0)
  }

  // ─── Summary Screen ───
  if (done) {
    const stats = [
      { label: 'Approved', count: approvedCount, color: TEAL, icon: Check },
      { label: 'To Fix', count: fixCount, color: GOLD, icon: Wrench },
      { label: 'Analyse', count: analyseCount, color: PURPLE, icon: Brain },
      { label: 'Skipped', count: skipCount, color: '#606060', icon: X },
    ]

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#1A1A1A',  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 480, width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }} style={{ width: 72, height: 72, borderRadius: '50%', background: `${TEAL}12`, border: `2px solid ${TEAL}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={32} style={{ color: TEAL }} />
            </motion.div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 6 }}>Review Complete</h2>
            <p style={{ fontSize: 14, color: '#8A8A8A' }}>{total} recommendations reviewed</p>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
                style={{ padding: '18px 12px', borderRadius: 16, background: '#2A2A2A', border: `1px solid ${s.count > 0 ? s.color + '25' : '#2A2A2A'}`, textAlign: 'center' }}>
                <s.icon size={18} style={{ color: s.count > 0 ? s.color : '#383838', marginBottom: 8 }} />
                <div style={{ fontSize: 28, fontWeight: 800, color: s.count > 0 ? s.color : '#383838', lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 10, color: '#707070', marginTop: 6, fontWeight: 600, letterSpacing: '0.03em' }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { onComplete(results); onClose() }}
              style={{ padding: '14px 32px', borderRadius: 14, border: 'none', background: TEAL, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 20px ${TEAL}25` }}>
              Save Results
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClose}
              style={{ padding: '14px 32px', borderRadius: 14, border: '1px solid #333333', background: 'transparent', color: '#8A8A8A', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Discard
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  const current = cards[0]
  const Icon = iconMap[current?.iconType] || Lightbulb
  const sev = sevColor[current.severity]
  const imp = impactConfig[current.impact]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#1A1A1A',  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Live counters */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { icon: Check, count: approvedCount, color: TEAL },
            { icon: Wrench, count: fixCount, color: GOLD },
            { icon: Brain, count: analyseCount, color: PURPLE },
            { icon: X, count: skipCount, color: '#606060' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: s.count > 0 ? s.color : '#383838' }}>
              <s.icon size={13} /> {s.count}
            </div>
          ))}
        </div>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onClose}
          style={{ background: '#333333', border: '1px solid #333333', borderRadius: 10, padding: '7px 16px', color: '#8A8A8A', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          Exit
        </motion.button>
      </div>

      {/* Progress */}
      <div style={{ width: '100%', maxWidth: 440, padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#606060', marginBottom: 6, fontWeight: 600 }}>
          <span>{reviewed + 1} of {total}</span>
          <span>{Math.round(((reviewed) / total) * 100)}% done</span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: '#2A2A2A', overflow: 'hidden' }}>
          <motion.div animate={{ width: `${(reviewed / total) * 100}%` }} transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: TEAL }} />
        </div>
      </div>

      {/* Card Stack */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, height: 420, padding: '0 20px' }}>
        <AnimatePresence>
          {cards.slice(0, 3).map((card, i) => {
            const isFront = i === 0
            const CardIcon = iconMap[card.iconType] || Lightbulb
            const cardSev = sevColor[card.severity]
            const cardImp = impactConfig[card.impact]

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ scale: 0.92, opacity: 0, y: 30 }}
                animate={{
                  scale: 1 - i * 0.04,
                  y: i * -10,
                  opacity: i === 0 ? 1 : i === 1 ? 0.6 : 0.3,
                  zIndex: 10 - i,
                }}
                exit={exitDir ? { x: exitDir.x, y: exitDir.y, rotate: exitDir.rotate, opacity: 0, transition: { duration: 0.2 } } : { opacity: 0, scale: 0.9 }}
                transition={spring}
                drag={isFront}
                dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
                dragElastic={0.7}
                onDrag={isFront ? (_, info) => { dragX.set(info.offset.x); dragY.set(info.offset.y) } : undefined}
                onDragEnd={isFront ? handleDragEnd : undefined}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 24,
                  background: isFront ? sevGradient[card.severity] : '#1E1E1E',
                  border: isFront ? undefined : '1px solid #2A2A2A',
                  
                  padding: 0, overflow: 'hidden',
                  cursor: isFront ? 'grab' : 'auto',
                  touchAction: 'none', userSelect: 'none',
                  boxShadow: isFront ? `0 20px 60px #1A1A1A, 0 0 0 1px #2A2A2A` : '0 10px 30px #1A1A1A',
                  rotateZ: isFront ? rotateZ : 0,
                  transformPerspective: 1200,
                }}
                whileDrag={isFront ? { scale: 1.02, cursor: 'grabbing' } : {}}
              >
                {/* Swipe overlays */}
                {isFront && (
                  <>
                    <motion.div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: `3px solid ${TEAL}`, opacity: overlayRight, pointerEvents: 'none', zIndex: 20 }}>
                      <div style={{ position: 'absolute', top: 28, left: 24, padding: '8px 18px', borderRadius: 10, background: `${TEAL}20`, border: `2px solid ${TEAL}`, color: TEAL, fontWeight: 800, fontSize: 16, letterSpacing: '0.06em', transform: 'rotate(-12deg)' }}>APPROVE</div>
                    </motion.div>
                    <motion.div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: '3px solid #606060', opacity: overlayLeft, pointerEvents: 'none', zIndex: 20 }}>
                      <div style={{ position: 'absolute', top: 28, right: 24, padding: '8px 18px', borderRadius: 10, background: '#333333', border: '2px solid #606060', color: '#8C8C8C', fontWeight: 800, fontSize: 16, letterSpacing: '0.06em', transform: 'rotate(12deg)' }}>SKIP</div>
                    </motion.div>
                    <motion.div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: `3px solid ${PURPLE}`, opacity: overlayUp, pointerEvents: 'none', zIndex: 20 }}>
                      <div style={{ position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)', padding: '8px 18px', borderRadius: 10, background: `${PURPLE}20`, border: `2px solid ${PURPLE}`, color: PURPLE, fontWeight: 800, fontSize: 16, letterSpacing: '0.06em' }}>ANALYSE</div>
                    </motion.div>
                    <motion.div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: `3px solid ${GOLD}`, opacity: overlayDown, pointerEvents: 'none', zIndex: 20 }}>
                      <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', padding: '8px 18px', borderRadius: 10, background: `${GOLD}20`, border: `2px solid ${GOLD}`, color: GOLD, fontWeight: 800, fontSize: 16, letterSpacing: '0.06em' }}>FIX</div>
                    </motion.div>
                  </>
                )}

                {/* Card inner */}
                <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 5 }}>

                  {/* Top row: severity + impact */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', background: `${cardSev}12`, color: cardSev, textTransform: 'uppercase' }}>
                        {card.severity}
                      </span>
                      <span style={{ fontSize: 10, color: '#4A4A4A', fontWeight: 600 }}>{card.category}</span>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', background: cardImp.bg, color: cardImp.color }}>
                      {cardImp.label}
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: `${cardSev}08`, border: `1.5px solid ${cardSev}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CardIcon size={22} style={{ color: cardSev }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', lineHeight: 1.35, marginBottom: 0 }}>{card.title}</h3>
                    </div>
                  </div>

                  {/* Body */}
                  <p style={{ fontSize: 14, color: '#8A8A8A', lineHeight: 1.7, flex: 1, margin: 0 }}>
                    {card.body}
                  </p>

                  {/* Metrics bar */}
                  <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {card.metrics.map(m => (
                        <div key={m.label} style={{
                          padding: '8px 14px', borderRadius: 10,
                          background: '#2A2A2A', border: '1px solid #2A2A2A',
                        }}>
                          <div style={{ fontSize: 9, color: '#606060', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 2, textTransform: 'uppercase' }}>{m.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Item reference */}
                    <div style={{ fontSize: 11, color: '#505050', fontWeight: 500 }}>
                      {card.item.startsWith('http') ? card.item.replace('https://www.pointhacks.com.au', '') : card.item}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 32 }}>
        {/* Undo */}
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleUndo} disabled={results.length === 0}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#2A2A2A', border: '1.5px solid #333333',
            color: results.length > 0 ? '#8C8C8C' : '#333333',
            cursor: results.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <RotateCcw size={16} />
        </motion.button>

        {/* Skip */}
        <motion.button whileHover={{ scale: 1.12, background: '#2A2A2A' }} whileTap={{ scale: 0.88 }} onClick={() => dismiss('skip')}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            background: '#2A2A2A', border: '2px solid #383838',
            color: '#707070', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
          <X size={22} />
        </motion.button>

        {/* Analyse */}
        <motion.button whileHover={{ scale: 1.12, boxShadow: `0 0 24px ${PURPLE}20` }} whileTap={{ scale: 0.88 }} onClick={() => dismiss('analysis')}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            background: `${PURPLE}08`, border: `2px solid ${PURPLE}40`,
            color: PURPLE, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Brain size={22} />
        </motion.button>

        {/* Fix */}
        <motion.button whileHover={{ scale: 1.12, boxShadow: `0 0 24px ${GOLD}20` }} whileTap={{ scale: 0.88 }} onClick={() => dismiss('fix')}
          style={{
            width: 54, height: 54, borderRadius: '50%',
            background: `${GOLD}08`, border: `2px solid ${GOLD}40`,
            color: GOLD, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Wrench size={22} />
        </motion.button>

        {/* Approve */}
        <motion.button whileHover={{ scale: 1.12, boxShadow: `0 0 30px ${TEAL}25` }} whileTap={{ scale: 0.88 }} onClick={() => dismiss('approve')}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `${TEAL}10`, border: `2.5px solid ${TEAL}50`,
            color: TEAL, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <Check size={28} />
        </motion.button>
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
        <div style={{ width: 44 }} />
        {[
          { w: 54, label: 'Skip', color: '#404040' },
          { w: 54, label: 'Analyse', color: `${PURPLE}80` },
          { w: 54, label: 'Fix', color: `${GOLD}80` },
          { w: 64, label: 'Approve', color: `${TEAL}90` },
        ].map(b => (
          <span key={b.label} style={{ width: b.w, textAlign: 'center', fontSize: 10, color: b.color, fontWeight: 600 }}>{b.label}</span>
        ))}
      </div>

      {/* Hint */}
      <div style={{ position: 'absolute', bottom: 16, fontSize: 10, color: '#383838', fontWeight: 500, letterSpacing: '0.02em' }}>
        Swipe right = Approve · Left = Skip · Up = Analyse · Down = Fix
      </div>
    </div>
  )
}
