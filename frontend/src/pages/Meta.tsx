import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CHARACTERS, GAMES, META, TIERS, ladder, slug } from '../data/mock'
import { useApp } from '../state/AppState'
import { useGameParam } from '../useGameParam'
import { Art, Avatar, Card, CharIcon, Note, PageTitle, Pill, Select, Sub } from '../components/ui'
import { cx } from '../lib/format'

const tierColor = { S: 'text-gold-soft', A: 'text-crystal-soft', B: 'text-fg', C: 'text-chaos-soft' } as const

/** 2j tier list + 2k stats table from real ranked matches. */
export function Meta() {
  const game = useGameParam()
  const info = GAMES[game]
  const { requireSignIn } = useApp()
  const [source, setSource] = useState<'top' | 'community'>('top')
  const [minRating, setMinRating] = useState('1800')
  const tiers = TIERS[game]

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <PageTitle
          right={
            <div className="flex gap-1.5">
              <Pill active={source === 'top'} onClick={() => setSource('top')}>
                Top-100 vote
              </Pill>
              <Pill active={source === 'community'} onClick={() => setSource('community')}>
                Community
              </Pill>
            </div>
          }
        >
          {info.short} Tier list
        </PageTitle>
        {(Object.keys(tiers) as (keyof typeof tiers)[]).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <b className={cx('w-6 text-lg', tierColor[t])}>{t}</b>
            <div className="flex flex-wrap gap-2">
              {(source === 'community' && t === 'A' ? [...tiers[t]].reverse() : tiers[t]).map((c) => (
                <Link key={c} to={`/${game}/characters/${slug(c)}`} title={c} className="hover:opacity-80">
                  <CharIcon name={c} />
                </Link>
              ))}
              {tiers[t].length === 0 && <Sub>—</Sub>}
            </div>
          </div>
        ))}
        <div className="flex items-center">
          <Sub>{source === 'top' ? '412' : '2,930'} votes · updated weekly</Sub>
          <span className="flex-1" />
          <Pill onClick={() => requireSignIn('Sign in to vote')}>Submit yours</Pill>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <PageTitle
          right={
            <div className="flex gap-1.5">
              <Pill disabled>Season {info.season}</Pill>
              <Select
                label="Rating"
                value={minRating}
                onChange={setMinRating}
                options={['0', '1500', '1800'].map((v) => ({ value: v, label: v === '0' ? 'All ratings' : `Rating ${v}+` }))}
              />
            </div>
          }
        >
          {info.short} Meta
        </PageTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-1 font-normal">Character</th>
              <th className="py-1 text-right font-normal">Pick</th>
              <th className="py-1 text-right font-normal">Win</th>
              <th className="py-1 pl-4 font-normal">Top {info.helperLabel.toLowerCase()}</th>
            </tr>
          </thead>
          <tbody>
            {META[game].map((r) => (
              <tr key={r.char} className="border-b border-line/50">
                <td className="py-1.5">
                  <Link to={`/${game}/characters/${slug(r.char)}`} className="flex items-center gap-2 hover:text-crystal-soft">
                    <CharIcon name={r.char} size={22} />
                    {r.char}
                  </Link>
                </td>
                <td className="py-1.5 text-right">{r.pick}%</td>
                <td className={cx('py-1.5 text-right', r.win >= 53 && 'text-crystal-soft', r.win <= 46 && 'text-chaos-soft')}>
                  {r.win}%
                </td>
                <td className="py-1.5 pl-4">{r.topHelper}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Note>Built from the characters reported in ranked matches, so it needs no extra input</Note>
      </section>
    </div>
  )
}

/** 2l — character page: matchups + top players. */
export function Character() {
  const game = useGameParam()
  const { slug: s = '' } = useParams()
  const name = CHARACTERS[game].find((c) => slug(c) === s)
  if (!name) return <Sub>Character not found.</Sub>
  const tier = (Object.entries(TIERS[game]).find(([, cs]) => cs.includes(name))?.[0] ?? 'B') as string
  const row = META[game].find((r) => r.char === name)
  const others = CHARACTERS[game].filter((c) => c !== name)
  // Deterministic pseudo matchup numbers from the names.
  const mu = (c: string) => 40 + ((name.length * 7 + c.length * 13 + c.charCodeAt(0)) % 20)
  const players = ladder(game).filter((p) => p.stats[game].mains.includes(name) || p.stats[game].main === name)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Art label="portrait" className="h-16 w-16" />
        <div className="flex flex-col">
          <span className="text-xl font-semibold">
            {name} · {GAMES[game].short}
          </span>
          <Sub>
            {tier} tier{row && ` · ${row.pick}% pick · ${row.win}% win`}
          </Sub>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <Card className="flex-1">
          <b>Matchups</b>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
            {others.map((c) => {
              const v = mu(c)
              return (
                <Link
                  key={c}
                  to={`/${game}/characters/${slug(c)}`}
                  title={`${v}% vs ${c}`}
                  className={cx(
                    'placeholder-art flex flex-col items-center rounded-md border-[1.5px] p-1 text-center',
                    v >= 54 ? 'border-crystal' : v <= 45 ? 'border-chaos' : 'border-line-strong',
                  )}
                >
                  <span className="font-mono text-sm">{v}</span>
                  <span className="truncate text-[10px] text-muted">{c}</span>
                </Link>
              )
            })}
          </div>
          <Sub>win % vs each character</Sub>
        </Card>
        <Card className="md:w-56">
          <b>Top {name} players</b>
          {players.slice(0, 5).map((p, i) => (
            <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-2 text-sm hover:text-crystal-soft">
              <b className="w-4">{i + 1}</b>
              <Avatar name={p.name} />
              {p.name}
            </Link>
          ))}
          {players.length === 0 && <Sub>No ranked mains yet</Sub>}
          {row && (
            <Sub>
              {GAMES[game].helperLabel.toLowerCase()} pick: {row.topHelper}
            </Sub>
          )}
        </Card>
      </div>
    </div>
  )
}
