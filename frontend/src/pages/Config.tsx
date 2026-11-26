import { Link } from 'react-router-dom'
import ConfigWindow from '../components/appearance/ConfigWindow'
import InterfaceSwitcher from '../components/appearance/InterfaceSwitcher'
import { Panel, PickerList } from '../components/rift/menus'
import { useMuted } from '../lib/sound'
import { useAppearance } from '../state/Appearance'
import type { RiftMode } from '../theme/appearance'

const MODES = [
  { value: 'chaos', label: 'Chaos mode' },
  { value: 'cosmos', label: 'Cosmos mode' },
] satisfies { value: RiftMode; label: string }[]

/** Settings. Classic gets its Config window; Rift gets the mode, the interface and a pointer to Classic's options. */
export default function Config() {
  const { ui, prefs, save } = useAppearance()
  const [muted, setMuted] = useMuted()
  if (ui === 'classic') return <ConfigWindow asPage />
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2.5">
        <p className="da-eyebrow">Settings</p>
        <h1 className="m-0 text-[clamp(30px,5vw,40px)]">Your look</h1>
        <p className="m-0 max-w-xl text-[15px] text-muted">Pick how the Rift looks. Each choice is saved as soon as you make it.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Appearance">
          <PickerList
            specs={[
              {
                key: 'mode',
                label: 'Mode',
                hint: 'Chaos mode is dark night glass. Cosmos mode is brushed steel.',
                options: MODES,
                value: prefs.rift_mode,
                onChange: (rift_mode: RiftMode) => void save({ rift_mode }),
              },
            ]}
          />
        </Panel>
        <Panel title="Interface">
          <p className="m-0 text-[15px] text-muted">
            Rift is this interface. Classic is a menu-window interface in the style of the 012 menus.
          </p>
          <InterfaceSwitcher className="rift-panel__switch" />
          <p className="m-0 text-[15px] text-muted">
            Window themes, menu fonts and the cursor are set from Classic's Config.{' '}
            <Link to="/rewards" className="text-gold underline underline-offset-4">
              See how to unlock them
            </Link>
            .
          </p>
        </Panel>
      </div>
      <label className="flex min-h-11 items-center gap-3 self-start">
        <input type="checkbox" checked={!muted} onChange={(event) => setMuted(!event.target.checked)} />
        Match found sound
      </label>
    </div>
  )
}
