import { Link } from 'react-router-dom'
import ConfigWindow from '../components/appearance/ConfigWindow'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import { useMuted } from '../lib/sound'
import { useAppearance } from '../state/Appearance'

/** Appearance settings. Classic gets its Config window; Rift gets the interface choice. */
export default function Config() {
  const { ui } = useAppearance()
  const [muted, setMuted] = useMuted()
  if (ui === 'classic') return <ConfigWindow asPage />
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <p className="da-eyebrow">APPEARANCE</p>
        <h1 className="m-0 text-[38px] font-semibold">Your look</h1>
        <p className="m-0 max-w-xl text-[15px] text-muted">
          Window themes, menu fonts and the cursor are set from Classic's Config.{' '}
          <Link to="/rewards" className="text-gold underline underline-offset-4">
            See how to unlock them
          </Link>
          .
        </p>
      </div>
      <section aria-labelledby="cfg-interface" className="flex flex-col gap-3">
        <h2 id="cfg-interface" className="m-0 text-xl font-semibold">
          Interface
        </h2>
        <InterfaceSwitcher />
      </section>
      <label className="flex min-h-11 items-center gap-3 self-start">
        <input type="checkbox" checked={!muted} onChange={(event) => setMuted(!event.target.checked)} />
        Match found sound
      </label>
    </div>
  )
}
