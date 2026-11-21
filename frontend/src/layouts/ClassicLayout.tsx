import { useRef, useState, type KeyboardEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import { MenuCursor } from '../components/appearance/parts'
import PreviewBanner from '../components/appearance/PreviewBanner'
import { AuthErrorBanner, DisputeNotice, GameSwitcher, Overlays } from '../components/Layout'
import { Avatar, SideGlyph } from '../components/ui'
import { roleLinks } from '../lib/api'
import { useApp } from '../state/AppState'
import { useAppearance } from '../state/Appearance'
import { WINDOWS } from '../theme/appearance'

interface Command {
  id: string
  label: string
  to: string
  help: string
  /** Paths (prefix match) that make this command current. */
  match: RegExp
}

function useCommands(): Command[] {
  const { game, user } = useApp()
  return [
    { id: 'battle', label: 'Battle', to: '/queue', match: /^\/($|queue|match)/, help: 'Find a ranked match. Bo3, your region first.' },
    { id: 'hub', label: 'Hub', to: `/${game}`, match: /^\/(012|nt)$/, help: "This game's hub: who's online, recent matches and news." },
    { id: 'fighters', label: 'Fighters', to: `/${game}/meta`, match: /^\/(012|nt)\/(meta|characters)/, help: 'Characters, picks and the meta for this game.' },
    { id: 'rankings', label: 'Rankings', to: `/${game}/ladder`, match: /^\/(012|nt)\/ladder/, help: 'See who leads the ladder.' },
    { id: 'tournaments', label: 'Tournaments', to: '/tournaments', match: /^\/tournaments/, help: 'Brackets and check-ins.' },
    { id: 'party', label: 'Party', to: '/party', match: /^\/(party|friends)/, help: 'Group up with friends.' },
    { id: 'rewards', label: 'Rewards', to: '/rewards', match: /^\/rewards/, help: 'Win ranked battles to unlock window themes, fonts and colours.' },
    { id: 'config', label: 'Config', to: '/config', match: /^\/config/, help: 'Interface, window theme, menu font and cursor.' },
    ...roleLinks(user?.role).map((l) => ({ ...l, id: l.to.slice(1), match: new RegExp(`^${l.to}`) })),
  ]
}

/** The command window: a list of buttons with a cursor, moved with the Up and Down arrows. */
function CommandMenu({ commands, current, onHelp }: { commands: Command[]; current: number; onHelp: (help: string | null) => void }) {
  const navigate = useNavigate()
  const [focus, setFocus] = useState(Math.max(0, current))
  // When the page changes, the tab stop follows the new current command (without remounting, so focus stays).
  const [shownFor, setShownFor] = useState(current)
  if (shownFor !== current) {
    setShownFor(current)
    setFocus(Math.max(0, current))
  }
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const move = (i: number) => {
    const n = (i + commands.length) % commands.length
    setFocus(n)
    refs.current[n]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowDown: focus + 1, ArrowUp: focus - 1, Home: 0, End: commands.length - 1 }
    if (e.key in keys) {
      e.preventDefault()
      move(keys[e.key])
    }
  }
  return (
    <nav aria-label="Main" className="da-window box-border max-w-full flex-[1_1_220px] p-3">
      <ul className="m-0 flex list-none flex-col p-0" onKeyDown={onKeyDown}>
        {commands.map((c, i) => (
          <li key={c.id}>
            <button
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              tabIndex={i === focus ? 0 : -1}
              aria-current={i === current ? 'page' : undefined}
              onFocus={() => {
                setFocus(i)
                onHelp(c.help)
              }}
              onBlur={() => onHelp(null)}
              onClick={() => navigate(c.to)}
              className="da-command"
            >
              <span className="da-command__cursor">
                <MenuCursor />
              </span>
              {c.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ClassicHeader() {
  const { user, signedIn, requireSignIn } = useApp()
  const { appearance } = useAppearance()
  return (
    <header className="da-window flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <Link to="/" className="text-[length:var(--menu-title)] tracking-[0.1em]">
        DISSIDIA ARENA
      </Link>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--menu-small)] text-[var(--win-muted)]">
        <GameSwitcher />
        {signedIn ? (
          <Link to="/players/me" className="flex items-center gap-2">
            <Avatar name={user?.displayName} src={user?.avatarUrl} size={24} />
            {user?.displayName}
          </Link>
        ) : (
          <button type="button" className="da-btn min-h-9 px-3" onClick={() => requireSignIn('Sign in')}>
            Sign in
          </button>
        )}
        <span data-side="cosmos" className="flex items-center gap-1.5 text-[var(--side)]">
          <SideGlyph side="cosmos" /> Cosmos
        </span>
        <span>Wins {appearance.ranked_wins}</span>
        <InterfaceSwitcher />
      </div>
    </header>
  )
}

/** The reward interface: every panel an old-school menu window, with a command list and a help bar. */
export default function ClassicLayout() {
  const { pathname } = useLocation()
  const { prefs, previewing } = useAppearance()
  const commands = useCommands()
  const current = commands.findIndex((c) => c.match.test(pathname))
  const [focusHelp, setFocusHelp] = useState<string | null>(null)
  const help = focusHelp ?? commands[current]?.help ?? 'Choose a command.'
  const windowName = WINDOWS.find((w) => w.key === (previewing ? 'classic' : prefs.window_theme))?.name ?? 'Classic'

  return (
    <div className="min-h-screen p-[clamp(12px,3vw,40px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
        <PreviewBanner />
        <ClassicHeader />
        <AuthErrorBanner />
        <DisputeNotice />
        <div className="flex flex-wrap items-start gap-4">
          <CommandMenu commands={commands} current={current} onHelp={setFocusHelp} />
          <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
            <Outlet />
          </main>
        </div>
        <footer className="flex flex-col gap-4">
          <div aria-live="polite" className="da-window px-5 py-3.5 text-[length:var(--menu-body)]">
            {help}
          </div>
          <p className="m-0 text-center text-[length:var(--menu-small)] text-[var(--win-muted)]">
            Dissidia Arena — a fan project · INTERFACE: CLASSIC · WINDOW: {windowName.toUpperCase()}
          </p>
        </footer>
      </div>
      <Overlays />
    </div>
  )
}
