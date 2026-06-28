import { useState, useRef, useEffect, useCallback } from 'react'
import { askClaude } from '../lib/claude'
import { getGearItems, getAllJumpsForStats, getGearSwaps, getJumpsOnGearItem, getNextJumpNumber } from '../lib/db'

function buildSystemPrompt(ctx) {
  return `You are SkyLog Assistant, embedded in a personal skydiving logbook app.
Help the user log jumps, query their stats, and manage gear.

Current context:
- Total jumps: ${ctx.totalJumps}
- Current canopy: ${ctx.activeCanopyLabel} (${ctx.activeCanopySize} sqft)
- Current lineset: ${ctx.activeLinesetLabel} (${ctx.linesetJumps} jumps on it, max ${ctx.linesetMax})
- Reserve repack expires: ${ctx.repackExpiry}
- Default location: ${ctx.mostRecentLocation}
- Default jump type: ${ctx.mostRecentJumpType}
- Today's date: ${ctx.today}
- Next jump number: ${ctx.nextJumpNumber}

When logging jumps, extract: date, numberOfJumps, location, jumpType, eventName (optional), notes (optional).
Use most recent location and jump type as defaults if not specified by the user.
Respond with a JSON block when the user wants to log jumps:
{"action": "log_jumps", "data": { "date": "YYYY-MM-DD", "numberOfJumps": N, "location": "...", "jumpType": "...", "eventName": "...", "notes": "..." }}
For questions, answer naturally in 1-2 sentences.
For ambiguous requests, ask one clarifying question.`
}

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'var(--accent-gradient)' : 'var(--input-bg)',
        color: 'var(--text-primary)',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: isUser ? '0 2px 12px var(--accent-glow)' : 'none',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

export default function AIAssistant({ settings, onLogPrefill }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [ctx, setCtx] = useState(null)
  const [actionCard, setActionCard] = useState(null)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  const loadContext = useCallback(async () => {
    try {
      const [gear, allJumps, swaps] = await Promise.all([
        getGearItems(),
        getAllJumpsForStats(),
        getGearSwaps(),
      ])
      const canopy = gear.find(g => g.category === 'main_canopy' && g.is_active)
      const lineset = gear.find(g => g.category === 'lineset' && g.is_active)
      const reserve = gear.find(g => g.category === 'reserve' && g.is_active)
      const linesetJumps = lineset ? await getJumpsOnGearItem(lineset.id, allJumps, swaps) : 0
      const nextNum = await getNextJumpNumber(settings?.starting_jump_number ?? 1)
      const total = allJumps.reduce((s, j) => s + j.number_of_jumps, 0)
      const recent = [...allJumps].reverse()
      const repackExpiry = (() => {
        const d = reserve?.data
        if (!d?.last_repack_date || !d?.repack_validity_months) return 'Unknown'
        const exp = new Date(d.last_repack_date)
        exp.setMonth(exp.getMonth() + Number(d.repack_validity_months))
        return exp.toDateString()
      })()

      setCtx({
        totalJumps: total,
        activeCanopyLabel: canopy ? (canopy.label || `${canopy.data?.brand || ''} ${canopy.data?.model || ''}`.trim()) : 'None',
        activeCanopySize: canopy?.data?.size_sqft || 'unknown',
        activeLinesetLabel: lineset ? (lineset.label || 'Active Lineset') : 'None',
        linesetJumps,
        linesetMax: lineset?.data?.max_jumps || 'unknown',
        repackExpiry,
        mostRecentLocation: recent[0]?.location || 'unknown',
        mostRecentJumpType: recent[0]?.jump_type || 'unknown',
        today: new Date().toISOString().split('T')[0],
        nextJumpNumber: nextNum,
      })
    } catch { /* ignore */ }
  }, [settings])

  useEffect(() => {
    if (open && !ctx) loadContext()
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
  }, [open, ctx, loadContext])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return
    const userMsg = { role: 'user', content: text.trim() }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setSending(true)
    setActionCard(null)

    try {
      const systemPrompt = buildSystemPrompt(ctx || {
        totalJumps: '?', activeCanopyLabel: '?', activeCanopySize: '?',
        activeLinesetLabel: '?', linesetJumps: '?', linesetMax: '?',
        repackExpiry: '?', mostRecentLocation: '?', mostRecentJumpType: '?',
        today: new Date().toISOString().split('T')[0], nextJumpNumber: '?',
      })

      const response = await askClaude(
        updated.map(m => ({ role: m.role, content: m.content })),
        systemPrompt
      )

      // Try to extract action JSON
      const jsonMatch = response.match(/\{[\s\S]*"action"\s*:\s*"log_jumps"[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          const displayText = response.replace(jsonMatch[0], '').trim() || `Ready to log ${parsed.data?.numberOfJumps || 1} jump(s)`
          setMessages(prev => [...prev, { role: 'assistant', content: displayText }])
          setActionCard(parsed.data)
        } catch {
          setMessages(prev => [...prev, { role: 'assistant', content: response }])
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I couldn't connect. ${err.message}` }])
    }
    setSending(false)
  }

  const handleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported in this browser'); return }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const r = new SR()
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'
    r.onresult = e => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev + (prev ? ' ' : '') + transcript)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognitionRef.current = r
    r.start()
    setListening(true)
  }

  const handleConfirmLog = () => {
    onLogPrefill?.(actionCard)
    setActionCard(null)
    setOpen(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 16px)',
          right: 20,
          width: 52, height: 52,
          borderRadius: '50%',
          background: 'var(--accent-gradient)',
          boxShadow: '0 4px 20px var(--accent-glow)',
          border: 'none', cursor: 'pointer',
          display: open ? 'none' : 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 24, zIndex: 40,
        }}
      >
        ✨
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: '50%',
              transform: 'translateX(-50%)',
              width: '100%', maxWidth: 480,
              height: '80svh',
              background: '#13131a',
              borderRadius: '20px 20px 0 0',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column',
              animation: 'sheet-up 300ms cubic-bezier(0.32,0.72,0,1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>✨</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>SkyLog Assistant</div>
                  <div style={{ fontSize: 11, color: 'var(--success)' }}>● Online</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 40 }}>✨</span>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>How can I help?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {["3 jumps today at Castellon", "When does my reserve expire?", "What's my wingload on a 150?"].map(hint => (
                      <button key={hint} className="btn-secondary" style={{ fontSize: 13, padding: '8px 12px' }} onClick={() => sendMessage(hint)}>{hint}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => <ChatBubble key={i} msg={m} />)}
              {sending && (
                <div style={{ display: 'flex', gap: 4, padding: '4px 0 4px 8px' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)', animation: `fade-up 600ms ${i * 150}ms ease infinite alternate` }} />
                  ))}
                </div>
              )}
              {/* Action card */}
              {actionCard && (
                <div className="card" style={{ border: '1px solid rgba(0,122,255,0.3)', marginTop: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>Ready to log:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                    {Object.entries(actionCard).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" style={{ fontSize: 14 }} onClick={handleConfirmLog}>
                    Pre-fill Log Form →
                  </button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                className="input-field"
                placeholder="Ask anything or describe your jumps..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                rows={1}
                style={{ flex: 1, resize: 'none', minHeight: 44, maxHeight: 100, paddingTop: 12 }}
              />
              <button
                className="btn-icon"
                onClick={handleVoice}
                style={{ background: listening ? 'var(--danger-subtle)' : 'var(--input-bg)', color: listening ? 'var(--danger)' : 'var(--text-secondary)', flexShrink: 0, width: 44, height: 44 }}
              >
                🎙
              </button>
              <button
                className="btn-icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                style={{ background: input.trim() ? 'var(--accent)' : 'var(--input-bg)', color: '#fff', flexShrink: 0, width: 44, height: 44, opacity: sending ? 0.5 : 1 }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
