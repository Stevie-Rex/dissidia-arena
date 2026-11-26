import { Link, Outlet, useLocation } from 'react-router-dom'
import LockPanel from '../components/appearance/LockPanel'
import { AuthErrorBanner, DisputeNotice, GameSwitcher, Overlays } from '../components/Layout'
import BottomBar from '../components/rift/BottomBar'
import HelpStrip from '../components/rift/HelpStrip'
import IconCredit from '../components/rift/IconCredit'
import MatchStatus from '../components/rift/MatchStatus'
import { useHelpText } from '../components/rift/hints'
import Sidebar from '../components/rift/Sidebar'
import { Btn, Logo } from '../components/ui'
import { useApp } from '../state/AppState'

/** Phones only: the brand and the game switcher. The bottom bar does the rest; desktop has the sidebar. */
function RiftHeader() {
  const { user, requireSignIn } = useApp()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-1.5">
        <Logo />
        <div className="flex items-center gap-2">
          <GameSwitcher crests />
          {user === null && (
            <Btn variant="ghost" onClick={() => requireSignIn('Sign in')}>
              Sign in
            </Btn>
          )}
        </div>
      </div>
    </header>
  )
}

/** The fan-project line at every width, and links that aren't in the sidebar or the phone bar. The icon credit sits in the sidebar foot on desktop. */
function RiftFooter() {
  return (
    <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line px-[clamp(20px,4vw,56px)] py-7 text-[13px] text-muted">
      <span>Dissidia Arena — a fan project</span>
      <nav aria-label="Site links" className="flex flex-wrap gap-4">
        <Link to="/credits" className="hover:text-fg">
          Credits
        </Link>
      </nav>
      <IconCredit className="m-0 w-full text-xs md:hidden" linkClassName="underline underline-offset-2 hover:text-fg" />
    </footer>
  )
}

/**
 * The default interface, in Chaos mode (dark) or Cosmos mode (light). Desktop: the sidebar, then a column with the
 * page and the help strip. Phones: a compact header and the bottom bar.
 */
export default function RiftLayout() {
  const { pathname } = useLocation()
  const help = useHelpText()
  // The home page runs edge to edge (the fracture hero); everything else sits in the content column.
  const fullBleed = pathname === '/'
  return (
    <div className="rift-shell" {...help.handlers}>
      <Sidebar className="hidden md:flex" />
      <div className="rift-column">
        <RiftHeader />
        <LockPanel />
        <AuthErrorBanner />
        <DisputeNotice />
        {fullBleed ? (
          <main className="flex-1">
            <Outlet />
          </main>
        ) : (
          <main className="mx-auto w-full max-w-7xl flex-1 px-[clamp(20px,4vw,56px)] pt-8">
            <Outlet />
          </main>
        )}
        <RiftFooter />
        <HelpStrip text={help.text} className="hidden md:flex" />
      </div>
      <BottomBar />
      <MatchStatus />
      <Overlays rift />
    </div>
  )
}
