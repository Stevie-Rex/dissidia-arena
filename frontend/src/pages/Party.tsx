import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FRIENDS, GAMES, playerById } from '../data/mock'
import { useApp } from '../state/AppState'
import { Avatar, Btn, Card, Note, Pill, Sub } from '../components/ui'

/** 2h — party lobby for NT 3v3 (also used for 1v1 friendlies). */
export default function Party() {
  const { party, inviteToParty, removeFromParty, toggleReady, queue, setQueue, region, startQueue, signedIn, requireSignIn } = useApp()
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!signedIn)
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Sub>Sign in to start a party.</Sub>
        <Btn onClick={() => requireSignIn('Sign in to party up')}>Sign in</Btn>
      </div>
    )

  const slots = [...party, ...Array(Math.max(0, 3 - party.length)).fill(null)] as ({ playerId: string; ready: boolean } | null)[]
  const avg = Math.round(party.reduce((s, m) => s + playerById(m.playerId)!.stats.nt.rating, 0) / party.length)
  const allReady = party.length === 3 && party.every((m) => m.ready)
  const link = 'dissidia.comp/p/QX4471'
  const invitable = FRIENDS.filter((f) => f.status === 'idle' && !party.some((m) => m.playerId === f.playerId))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Your party</h1>
        <Sub>
          {GAMES.nt.short} 3v3 · Bo{queue.bestOf} · {region}
        </Sub>
        <span className="flex-1" />
        <Pill onClick={() => navigate('/nt')}>Leave</Pill>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {slots.map((m, i) => {
          if (!m)
            return (
              <Card key={i} tone="dashed" className="items-center">
                <span className="placeholder-art flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-dashed border-line-strong text-muted">
                  +
                </span>
                <Sub>empty slot</Sub>
                <Pill onClick={() => setPicking(true)}>Invite friend</Pill>
              </Card>
            )
          const p = playerById(m.playerId)!
          const isMe = m.playerId === 'me'
          return (
            <Card key={m.playerId} tone={isMe ? 'cosmos' : 'default'} className="items-center">
              <Avatar name={p.name} size={48} ring={isMe ? 'crystal' : 'default'} />
              <b>{p.name}</b>
              <Sub>
                {i === 0 ? 'leader · ' : ''}
                {p.stats.nt.rating}
              </Sub>
              {m.ready ? <span className="text-crystal-soft">✓ ready</span> : <Sub>not ready</Sub>}
              {isMe ? (
                <Pill onClick={toggleReady}>{m.ready ? 'Unready' : 'Ready up'}</Pill>
              ) : (
                <Pill onClick={() => removeFromParty(m.playerId)}>Kick</Pill>
              )}
            </Card>
          )
        })}
      </div>

      {picking && (
        <Card>
          <div className="flex items-center">
            <b>Invite an online friend</b>
            <span className="flex-1" />
            <button type="button" className="text-muted hover:text-fg" onClick={() => setPicking(false)}>
              ✕
            </button>
          </div>
          {invitable.length === 0 && <Sub>No idle friends right now. Share the invite link instead.</Sub>}
          {invitable.map((f) => {
            const p = playerById(f.playerId)!
            return (
              <div key={f.playerId} className="flex items-center gap-2">
                <Avatar name={p.name} ring="crystal" />
                {p.name}
                <Sub>{p.stats.nt.rating}</Sub>
                <span className="flex-1" />
                <Pill
                  onClick={() => {
                    inviteToParty(f.playerId)
                    setPicking(false)
                  }}
                >
                  Invite
                </Pill>
              </div>
            )
          })}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Sub>Invite link</Sub>
        <span className="flex-1 rounded-md border-[1.5px] border-line-strong bg-card px-2 py-1 font-mono text-xs text-muted">{link}</span>
        <Pill
          onClick={() => {
            void navigator.clipboard?.writeText(`https://${link}`)
            setCopied(true)
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </Pill>
        <Pill>Post to Discord</Pill>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Sub>Team rating avg {avg} · matched vs teams ±150</Sub>
        <span className="flex-1" />
        <Btn
          disabled={!allReady}
          onClick={() => {
            setQueue({ game: 'nt', mode: '3v3' })
            startQueue()
          }}
        >
          {allReady ? 'Find match' : 'Waiting for 3 ready'}
        </Btn>
      </div>
      <Note>Parties also work for 1v1 friendlies (unranked)</Note>
    </div>
  )
}
