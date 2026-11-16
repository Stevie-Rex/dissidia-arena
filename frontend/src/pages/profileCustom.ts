export type BlockId = 'rank' | 'mains' | 'pinned' | 'bio' | 'history'
export const BLOCK_LABEL: Record<BlockId, string> = {
  rank: 'Rank card',
  mains: 'Featured mains',
  pinned: 'Pinned match',
  bio: 'Bio',
  history: 'Match history',
}

export interface ProfileCustom {
  accent: string
  title: string
  bio: string
  blocks: BlockId[]
  banner: number
}

export const ACCENTS = ['#7cc8e6', '#dcb65e', '#d65a5a', '#a070d0']
export const BANNERS = ['custom banner (upload or pick character art)', 'Kain art', 'Cosmos art', 'Chaos art']

export function loadCustom(): ProfileCustom {
  try {
    const raw = localStorage.getItem('dc.profile')
    if (raw) return JSON.parse(raw) as ProfileCustom
  } catch {
    /* ignore */
  }
  return { accent: ACCENTS[0], title: '', bio: 'Learning the ropes', blocks: ['rank', 'mains', 'history'], banner: 0 }
}
