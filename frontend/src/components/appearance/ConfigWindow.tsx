import { cx } from '../../lib/format'
import { useAppearance } from '../../state/Appearance'
import { MENU_FONTS, REWARDS_BY_KEY, requiredReward, RGB_MAX, WINDOWS, type MenuFont, type Rgb, type WindowTheme } from '../../theme/appearance'
import { LockIcon, MenuCursor, WindowSwatch } from './parts'

function goalOf(field: 'window_theme' | 'menu_font', value: string) {
  const key = requiredReward(field, value)
  return key ? REWARDS_BY_KEY[key].goal : 0
}

/** Classic's Config: interface, window theme, menu font, cursor and the custom colour sliders. */
export default function ConfigWindow({ className, titled = true, asPage = false }: { className?: string; titled?: boolean; asPage?: boolean }) {
  const Title = asPage ? 'h1' : 'h2'
  const Label = asPage ? 'h2' : 'h3'
  const { prefs, save, isUnlocked, lockFor, previewing, endPreview } = useAppearance()
  const customOpen = isUnlocked('window_custom')
  // While previewing, only the base Classic window is on screen, whatever is saved.
  const activeWindow: WindowTheme = previewing ? 'classic' : prefs.window_theme
  const activeFont: MenuFont = previewing && prefs.menu_font === 'bit8' ? 'auto' : prefs.menu_font

  const chooseRift = () => (previewing ? endPreview() : void save({ interface: 'rift' }))
  const setChannel = (i: number, v: number) => {
    const rgb = [...prefs.window_rgb] as Rgb
    rgb[i] = v
    void save({ window_rgb: rgb, window_theme: 'custom' })
  }

  return (
    <section aria-labelledby={titled ? 'cfg-title' : undefined} aria-label={titled ? undefined : 'Config'} className={cx('da-window px-6 pb-6 pt-5', className)}>
      {titled && (
        <Title id="cfg-title" className="da-window__title">
          CONFIG
        </Title>
      )}
      <div className="flex flex-wrap gap-x-10 gap-y-6">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <div>
            <Label className="da-cfg-label">Interface</Label>
            <div role="group" aria-label="Interface" className="flex gap-2">
              <button type="button" aria-pressed={false} onClick={chooseRift} className="da-cfg-opt flex-1">
                Rift
              </button>
              <button type="button" aria-pressed className="da-cfg-opt flex flex-1 items-center justify-center gap-2">
                <span aria-hidden className="text-[var(--win-cursor)]">
                  ▶
                </span>
                Classic{previewing && ' (preview)'}
              </button>
            </div>
          </div>

          <div>
            <Label className="da-cfg-label">Window theme</Label>
            <ul className="m-0 flex list-none flex-col p-0">
              {WINDOWS.map((w) => {
                const on = activeWindow === w.key
                const locked = !(previewing && w.key === 'classic') && !!lockFor('window_theme', w.key)
                return (
                  <li key={w.key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={locked}
                      onClick={() => !previewing && void save({ window_theme: w.key })}
                      className="da-command min-h-11 gap-2.5 px-2 py-1.5 text-[length:var(--menu-body)]"
                    >
                      <span className="da-command__cursor">
                        <MenuCursor />
                      </span>
                      <WindowSwatch window={w.key} className="h-5 w-[34px] flex-none rounded-[4px]!" />
                      <span className="flex-1">{w.name}</span>
                      <span className="flex items-center gap-1.5 text-[length:var(--menu-small)] text-[var(--win-muted)]">
                        {locked ? (
                          <>
                            <LockIcon /> Unlocks at {goalOf('window_theme', w.key)} wins
                          </>
                        ) : w.after ? (
                          `After ${w.after.replace('FF ', '')}`
                        ) : (
                          'Your RGB'
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
          <div>
            <Label className="da-cfg-label">Menu font</Label>
            <div role="group" aria-label="Menu font" className="grid grid-cols-2 gap-2">
              {[{ key: 'auto' as const, name: 'Auto', family: 'var(--menu-family)' }, ...MENU_FONTS].map((f) => {
                const locked = !!lockFor('menu_font', f.key) || (previewing && f.key === 'bit8')
                const on = activeFont === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    disabled={locked}
                    onClick={() => void save({ menu_font: f.key })}
                    className={cx('da-cfg-opt flex flex-col items-start gap-0.5 px-3 py-2.5 text-left', locked && 'da-locked', f.key === 'auto' && 'col-span-2')}
                  >
                    <span style={{ fontFamily: f.family }} className="text-[length:var(--menu-body)]">
                      {f.name}
                    </span>
                    <span className="text-[length:var(--menu-small)] text-[var(--win-muted)]">
                      {locked ? `Unlocks at ${goalOf('menu_font', f.key)} wins` : f.key === 'auto' ? "The window's own" : FONT_NOTES[f.key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="da-cfg-label">Cursor</Label>
            <div role="group" aria-label="Cursor" className="flex gap-2">
              <button type="button" aria-pressed={prefs.cursor === 'glove'} onClick={() => void save({ cursor: 'glove' })} className="da-cfg-opt flex flex-1 items-center justify-center gap-2.5">
                <span className="da-cursor-glove block! flex-none" aria-hidden />
                Glove
              </button>
              <button type="button" aria-pressed={prefs.cursor === 'arrow'} onClick={() => void save({ cursor: 'arrow' })} className="da-cfg-opt flex flex-1 items-center justify-center gap-2.5">
                <span aria-hidden className="text-[var(--win-cursor)]">
                  ▶
                </span>
                Arrow
              </button>
            </div>
          </div>

          <div>
            <Label className="da-cfg-label">Window colour</Label>
            {customOpen && !previewing ? (
              <div className="flex flex-col gap-2">
                {(['R', 'G', 'B'] as const).map((ch, i) => (
                  <label key={ch} className="flex items-center gap-3 text-[length:var(--menu-body)]">
                    <span className="w-5">{ch}</span>
                    <input
                      type="range"
                      min={0}
                      max={RGB_MAX}
                      value={prefs.window_rgb[i]}
                      onChange={(e) => setChannel(i, Number(e.target.value))}
                      className="flex-1 accent-[var(--win-cursor)]"
                    />
                    <span className="w-8 text-right tabular-nums">{String(prefs.window_rgb[i]).padStart(2, '0')}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="m-0 flex items-center gap-2 text-[length:var(--menu-body)]">
                <LockIcon /> Unlocks at {REWARDS_BY_KEY.window_custom.goal} wins.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

const FONT_NOTES: Record<string, string> = {
  bit16: 'SNES era',
  bit8: 'NES era',
  story: 'In the style of IX',
  modern: 'In the style of VIII and X',
}
