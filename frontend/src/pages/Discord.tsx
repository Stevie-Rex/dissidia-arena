import { useState } from 'react'
import { useApp } from '../state/AppState'
import { Art, Avatar, Btn, Card, Gem, Note, Pill, Select, Sub } from '../components/ui'

const CHANNELS = ['# general', '# ranked-queue', '# results', '# tournaments', 'off']

const POSTS = [
  { key: 'results', label: 'Match results', def: '# results' },
  { key: 'pings', label: 'Queue pings ("3 searching")', def: '# ranked-queue' },
  { key: 'checkins', label: 'Tournament check-ins', def: '# tournaments' },
  { key: 'weekly', label: 'Weekly ladder top 10', def: 'off' },
]

/** 2b — server admin setup page, with 2a/2c previews of how the bot behaves. */
export default function Discord() {
  const { signedIn, requireSignIn } = useApp()
  const [posts, setPosts] = useState<Record<string, string>>(Object.fromEntries(POSTS.map((p) => [p.key, p.def])))
  const [roles, setRoles] = useState(true)
  const [saved, setSaved] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Connect your Discord server</h1>
          <span className="flex-1" />
          <Pill active>● Bot online</Pill>
        </div>
        <Card>
          <div className="flex items-center gap-3">
            <Art label="icon" className="h-9 w-9" />
            <div className="flex flex-col">
              <b>Dissidia NA Community</b>
              <Sub>2,140 members · you're admin</Sub>
            </div>
            <span className="flex-1" />
            <Pill>Change</Pill>
          </div>
        </Card>
        <Card>
          <b>Post to channels</b>
          {POSTS.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <Sub className="w-48">{p.label}</Sub>
              <Select
                label={p.label}
                value={posts[p.key]}
                onChange={(v) => {
                  setPosts((x) => ({ ...x, [p.key]: v }))
                  setSaved(false)
                }}
                options={CHANNELS.map((c) => ({ value: c, label: c }))}
              />
            </div>
          ))}
        </Card>
        <Card>
          <div className="flex items-center">
            <b>Rank roles</b>
            <span className="flex-1" />
            <Pill active={roles} onClick={() => setRoles((r) => !r)}>
              {roles ? 'auto-sync ✓' : 'auto-sync off'}
            </Pill>
          </div>
          <Sub>Give Discord roles from ladder rank: Top 16 · Top 100 · Season champion</Sub>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <Sub>Commands: /queue /cancel /report /rank /ladder /bracket</Sub>
          <span className="flex-1" />
          <Btn onClick={() => requireSignIn('Sign in to connect a server') && setSaved(true)}>{saved && signedIn ? 'Saved ✓' : 'Save'}</Btn>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">How it looks in your server</h2>
        <Card className="flex-row gap-4 bg-panel">
          <div className="hidden w-32 flex-none flex-col gap-1 border-r-[1.5px] border-line pr-3 text-sm sm:flex">
            <Sub>server channels</Sub>
            <span># general</span>
            <span className="rounded bg-crystal-bg px-1 text-crystal-soft"># ranked-queue</span>
            <span># results</span>
            <span># tournaments</span>
          </div>
          <div className="flex flex-1 flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Avatar name="You" />
              <b>you</b>
              <Sub>/queue game:NT mode:1v1 bo:3</Sub>
            </div>
            <div className="flex items-start gap-2">
              <Avatar name="Bot" ring="you" />
              <Card className="flex-1 border-l-[3px] border-l-gold">
                <div className="flex items-center gap-2">
                  <Gem />
                  <b>Searching · NT 1v1 Bo3 · NA</b>
                </div>
                <Sub>9 in queue · est. 1:30</Sub>
              </Card>
            </div>
            <div className="flex items-start gap-2">
              <Avatar name="Bot" ring="you" />
              <Card className="flex-1 border-l-[3px] border-l-chaos">
                <b>Match found</b>
                <div className="flex items-center gap-2">
                  <span className="text-crystal-soft">you · 1520</span>
                  <Gem />
                  <span className="text-chaos-soft">Player G · 1530</span>
                </div>
                <div className="flex items-center gap-2">
                  <Btn>Accept</Btn>
                  <Pill>Decline</Pill>
                  <span className="flex-1" />
                  <Sub>0:15</Sub>
                </div>
              </Card>
            </div>
            <Note>Room info and result buttons go to DMs, so the channel stays clean</Note>
          </div>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <Sub>① accepted</Sub>
            <b>vs Player G</b>
            <Sub>G hosts · PSN: playerG</Sub>
          </Card>
          <Card>
            <Sub>② report per game</Sub>
            <b>Game 1 winner?</b>
            <Sub>Me / Them + character and stage dropdowns</Sub>
          </Card>
          <Card>
            <Sub>③ confirm</Sub>
            <b>G says: 2–1 you</b>
            <Sub>Confirm / Dispute</Sub>
          </Card>
          <Card>
            <Sub>④ posted</Sub>
            <b className="text-crystal-soft">1520 → 1532</b>
            <Sub>result card posted in #results</Sub>
          </Card>
        </div>
        <Note>Site and bot share one match record, so you can report from either one</Note>
      </section>
    </div>
  )
}
