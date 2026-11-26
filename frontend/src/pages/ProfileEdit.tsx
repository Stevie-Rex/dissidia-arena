import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCENTS, BANNERS, BLOCK_LABEL, loadCustom, type BlockId, type ProfileCustom } from './profileCustom'
import { Art, Btn, Pill, Select, Sub } from '../components/ui'
import { Panel } from '../components/rift/menus'
import { useAppearance } from '../state/Appearance'
import { cx } from '../lib/format'

const ALL_BLOCKS = Object.keys(BLOCK_LABEL) as BlockId[]

/** 1t — edit mode: modular blocks you arrange. */
export default function ProfileEdit() {
  const { ui } = useAppearance()
  const navigate = useNavigate()
  const [c, setC] = useState<ProfileCustom>(loadCustom)
  const [drag, setDrag] = useState<number | null>(null)
  const update = (patch: Partial<ProfileCustom>) => setC((x) => ({ ...x, ...patch }))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= c.blocks.length) return
    const blocks = [...c.blocks]
    const [b] = blocks.splice(from, 1)
    blocks.splice(to, 0, b)
    update({ blocks })
  }
  const missing = ALL_BLOCKS.filter((b) => !c.blocks.includes(b))

  return (
    <div className="flex flex-col gap-5">
      {ui === 'rift' && <h1 className="m-0 text-4xl">Edit profile</h1>}
      <div className="rift-profile-editor flex flex-col gap-4 md:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Sub>Profile preview · drag or use the arrows to reorder</Sub>
          <Art label={BANNERS[c.banner]} className="h-16" />
          {c.blocks.map((b, i) => (
            <div
              key={b}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== null) move(drag, i)
                setDrag(null)
              }}
              className={cx(
                'flex cursor-grab items-center gap-2 rounded-lg border-[1.5px] border-dashed bg-card p-3',
                i === 0 ? 'border-gold' : 'border-line-strong',
              )}
            >
              <span className="text-muted">⋮⋮</span>
              <b>{BLOCK_LABEL[b]}</b>
              {b === 'pinned' && <Sub>your best set</Sub>}
              <span className="flex-1" />
              <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => move(i, i - 1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => move(i, i + 1)} aria-label="Move down">
                ↓
              </button>
              <button
                type="button"
                className="text-xs text-muted hover:text-chaos-soft"
                onClick={() => update({ blocks: c.blocks.filter((x) => x !== b) })}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <Panel title="Customise" className="md:w-64">
          <Sub>Banner</Sub>
          <div className="flex flex-wrap gap-2">
            {BANNERS.map((label, i) => (
              <button key={label} type="button" onClick={() => update({ banner: i })} aria-label={label}>
                <Art className={cx('h-7 w-12', c.banner === i && 'border-crystal')} />
              </button>
            ))}
          </div>
          <Sub>Accent / frame</Sub>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={`accent ${a}`}
                onClick={() => update({ accent: a })}
                className={cx('h-6 w-6 rounded-full border-2', c.accent === a ? 'border-fg' : 'border-transparent')}
                style={{ background: a }}
              />
            ))}
          </div>
          <Sub>Title (earned)</Sub>
          <Select
            label="Title"
            value={c.title}
            onChange={(title) => update({ title })}
            options={[
              { value: '', label: 'none' },
              { value: 'Weekly Top 8', label: 'Weekly Top 8' },
            ]}
          />
          <label htmlFor="profile-bio" className="text-sm text-muted">Bio</label>
          <input
            id="profile-bio"
            value={c.bio}
            maxLength={60}
            onChange={(e) => update({ bio: e.target.value })}
            className="rounded-md border-[1.5px] border-line-strong bg-panel px-2 py-1 text-sm focus:border-crystal focus:outline-none"
          />
          <Sub>Blocks</Sub>
          <div className="flex flex-wrap gap-1.5">
            {missing.length ? (
              missing.map((b) => (
                <Pill key={b} onClick={() => update({ blocks: [...c.blocks, b] })}>
                  + {BLOCK_LABEL[b]}
                </Pill>
              ))
            ) : (
              <Sub>all blocks added</Sub>
            )}
          </div>
          <Btn
            className="mt-3"
            onClick={() => {
              localStorage.setItem('dc.profile', JSON.stringify(c))
              navigate('/players/me')
            }}
          >
            Save
          </Btn>
        </Panel>
      </div>
    </div>
  )
}
