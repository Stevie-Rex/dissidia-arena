/*
 * Lab, round 3 (#70): the bar along the bottom while a scenario is on. Not part of any design: it only switches
 * scenario, player and mode, and plays the other player's moves. This branch never merges.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ModeToggle from '../components/appearance/ModeToggle'
import { labState, runAction } from './fakeApi'
import { labUrl } from './urls'
import { SCENARIOS } from './scenarios'
import './lab.css'

const SIDE_NAMES = { a: 'Vesper', b: 'Kestrel', master: 'the Master' } as const

export default function LabBar() {
  const { session, scenario } = labState()
  const [open, setOpen] = useState(true)
  const [done, setDone] = useState<string | null>(null)
  if (!scenario) return null
  const i = SCENARIOS.indexOf(scenario)
  const go = (id: string, as?: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!
    window.location.assign(labUrl(s.id, s.path, { as, mode: session.mode }))
  }

  if (!open)
    return (
      <button type="button" className="lab-bar lab-bar--closed" onClick={() => setOpen(true)}>
        Lab
      </button>
    )

  return (
    <aside className="lab-bar" aria-label="Lab controls">
      <div className="lab-bar__row">
        <a href="/lab" className="lab-bar__home">Lab</a>
        <select aria-label="Scenario" value={scenario.id} onChange={(e) => go(e.target.value)}>
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.group} · {s.title}
            </option>
          ))}
        </select>
        <button type="button" disabled={i <= 0} onClick={() => go(SCENARIOS[i - 1].id)} aria-label="Previous scenario">
          ‹
        </button>
        <button type="button" disabled={i >= SCENARIOS.length - 1} onClick={() => go(SCENARIOS[i + 1].id)} aria-label="Next scenario">
          ›
        </button>
        {scenario.sides.length > 1 && (
          <span className="lab-bar__group" role="group" aria-label="You are">
            You are
            {scenario.sides.map((as) => (
              <button key={as} type="button" aria-pressed={as === session.as} onClick={() => go(scenario.id, as)}>
                {SIDE_NAMES[as]}
              </button>
            ))}
          </span>
        )}
        <ModeToggle wide />
        <button type="button" onClick={() => go(scenario.id, session.as)}>
          Reset
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Hide the lab bar">
          ✕
        </button>
      </div>
      <p className="lab-bar__note">{scenario.note}</p>
      {(scenario.pages || scenario.actions) && (
        <div className="lab-bar__row">
          {scenario.pages?.map((p) => (
            <Link key={p.path} to={p.path}>
              {p.label}
            </Link>
          ))}
          {scenario.actions?.map((a, n) =>
            a.as && a.as !== session.as ? null : (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  runAction(n)
                  setDone(a.label)
                }}
              >
                {a.label}
              </button>
            ),
          )}
          {done && <span role="status">Done: {done}. The page catches up within a couple of seconds.</span>}
        </div>
      )}
    </aside>
  )
}
