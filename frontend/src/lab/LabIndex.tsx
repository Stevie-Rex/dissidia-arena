/*
 * Lab, round 3 (#70): the dev-only /lab page. Each scenario opens the real app on sample data, with no backend
 * or sign-in. Rendered outside the app's providers, so it makes no API calls. This branch never merges.
 */
import { SCENARIOS } from './scenarios'
import { readSession, saveSession } from './fakeApi'
import { labUrl } from './urls'
import './lab.css'

const SIDE_NAMES = { a: 'Vesper', b: 'Kestrel', master: 'the Master' } as const

export default function LabIndex() {
  const groups = [...new Set(SCENARIOS.map((s) => s.group))]
  const active = readSession()
  return (
    <div className="lab-index">
      <header>
        <h1>Lab, round 3</h1>
        <p>
          Reopening, Season 1, Ratings, Leave and Forfeit, and "My opponent's gone" (issue #70). Each link opens the real app on
          sample data, with no backend or sign-in. The lab bar at the bottom switches player, mode and scenario. Check each at
          desktop and phone width.
        </p>
        {active && (
          <button
            type="button"
            onClick={() => {
              saveSession(null)
              window.location.assign('/')
            }}
          >
            Leave the lab (back to the real API)
          </button>
        )}
      </header>
      {groups.map((g) => (
        <section key={g}>
          <h2>{g}</h2>
          <ul>
            {SCENARIOS.filter((s) => s.group === g).map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong>
                <span>{s.note}</span>
                <span className="lab-index__links">
                  {s.sides.map((as) =>
                    (['chaos', 'cosmos'] as const).map((mode) => (
                      <a key={as + mode} href={labUrl(s.id, s.path, { as, mode })}>
                        {s.sides.length > 1 ? `As ${SIDE_NAMES[as]}, ` : ''}
                        {mode === 'chaos' ? 'Chaos mode' : 'Cosmos mode'}
                      </a>
                    )),
                  )}
                  {s.pages
                    ?.filter((p) => p.path !== s.path)
                    .map((p) =>
                      (['chaos', 'cosmos'] as const).map((mode) => (
                        <a key={p.path + mode} href={labUrl(s.id, p.path, { as: s.sides[0], mode })}>
                          {p.label}, {mode === 'chaos' ? 'Chaos mode' : 'Cosmos mode'}
                        </a>
                      )),
                    )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
