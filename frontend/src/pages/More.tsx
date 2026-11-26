import { navItems } from '../components/rift/navItems'
import { GiGears } from '../components/rift/icons'
import { MenuBars, PlayerCard } from '../components/rift/Sidebar'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import ModeToggle from '../components/appearance/ModeToggle'
import { useApp } from '../state/AppState'

const feedbackUrl = import.meta.env.VITE_DISCORD_FEEDBACK_URL

export default function More() {
  const { game, user } = useApp()
  const items = navItems(game, user?.role).filter(({ key }) => key === 'rewards' || key === 'admin')
  items.push(
    { key: 'settings', label: 'Settings', to: '/config', glyph: (size) => <GiGears size={size} />, hint: 'Change your appearance and other settings.' },
    { key: 'credits', label: 'Credits', to: '/credits', hint: 'Credits and licences for the icons and fonts.' },
  )

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="font-display text-2xl">More</h1>
      <PlayerCard />
      <MenuBars label="More destinations" items={items} />
      <ModeToggle wide className="rift-foot-btn min-h-11" />
      <InterfaceSwitcher />
      <a
        className="rift-foot-btn min-h-11"
        href={feedbackUrl || 'https://github.com/Stevie-Rex/dissidia-arena/issues/new'}
      >
        {feedbackUrl ? 'Feedback on Discord' : 'Feedback on GitHub'}
      </a>
    </div>
  )
}
