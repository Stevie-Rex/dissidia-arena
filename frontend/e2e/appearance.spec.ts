import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { mockApi, WINDOW_KEYS } from './mock'

const html = (page: Page) => page.locator('html')

const SIZES = [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 812 }]] as const
const MODE_NAME = { chaos: 'Chaos mode', cosmos: 'Cosmos mode' } as const

/** Contrast of each crest's icon against both ends of its frame's fill, from computed colours. */
async function crestRatios(page: Page): Promise<[string, number][]> {
  return page.evaluate(() => {
    // Computed colours come back as rgb()/rgba() or, from color-mix, as color(srgb r g b) in 0-1.
    const rgb = (c: string) => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number)
      return c.startsWith('color(') ? n.slice(0, 3).map((v) => v * 255) : n.slice(0, 3)
    }
    const lum = ([r, g, b]: number[]) =>
      [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((m, n) => n - m)
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100
    }
    const out: [string, number][] = []
    document.querySelectorAll<HTMLElement>('[data-crest]').forEach((crest, i) => {
      if (!crest.offsetParent) return
      const ink = getComputedStyle(crest.querySelector('[data-crest-icon]')!).color
      const where = `crest ${i} (${crest.closest('button')?.textContent?.trim() ?? ''})`
      crest.querySelectorAll('[data-crest-fill]').forEach((stop, j) => out.push([`${where} fill ${j}`, ratio(ink, getComputedStyle(stop).stopColor)]))
    })
    return out
  })
}

const classicButton = (page: Page) => page.getByRole('group', { name: 'Interface' }).getByRole('button', { name: /classic/i })

test.describe('Rift for a new player', () => {
  test('sees Rift, and Classic shows a lock', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-interface', 'rift')
    await expect(page.getByRole('region', { name: 'Dissidia Arena' }).getByRole('heading', { level: 1, name: 'Dissidia Arena' })).toBeVisible()
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(classicButton(page).getByRole('img', { name: 'Locked' })).toBeVisible()
  })

  test('tapping a locked Classic opens the lock panel with the wins remaining', async ({ page }) => {
    await mockApi(page, { wins: 7 })
    await page.goto('/')
    await classicButton(page).click()
    await expect(classicButton(page)).toHaveAttribute('aria-expanded', 'true')
    const panel = page.getByRole('region', { name: 'Classic interface is locked' })
    await expect(panel).toContainText('Win 3 more ranked battles')
    await expect(panel).toContainText('7 / 10')
    await panel.getByRole('button', { name: 'Not now' }).click()
    await expect(panel).toBeHidden()
  })

  test('has no world picker on Home or Config', async ({ page }) => {
    await mockApi(page, { wins: 0 })
    for (const url of ['/', '/config']) {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('heading', { name: /world/i })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Mako|Gaia|Ivalice/ })).toHaveCount(0)
      await expect(html(page)).not.toHaveAttribute('data-world', /.*/)
    }
  })

  test('an old cached world is ignored and the rest of the cached look still paints first', async ({ page }) => {
    await mockApi(page, { wins: 0, getDelayMs: 3000 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'da-appearance',
        JSON.stringify({
          preferences: { interface: 'rift', window_theme: 'classic', menu_font: 'auto', cursor: 'arrow', window_rgb: [6, 10, 26], world: 'gaia' },
          unlocks: [], rewards: [], ranked_wins: 0, ranked_losses: 0, next: null,
        }),
      )
    })
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForSelector('html[data-cursor="arrow"]', { timeout: 2000 })
    await expect(html(page)).not.toHaveAttribute('data-world', /.*/)
    await expect(page.getByRole('region', { name: 'Dissidia Arena' }).getByRole('heading', { level: 1, name: 'Dissidia Arena' })).toBeVisible()
  })
})

const modeToggle = (page: Page) => page.getByRole('button', { name: /^Switch to (Cosmos|Chaos) mode$/ })

test.describe('Chaos mode and Cosmos mode', () => {
  test('a new visitor sees Chaos mode, and Cosmos mode persists across reloads', async ({ page }) => {
    await mockApi(page, { wins: null })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'chaos')
    await page.getByRole('button', { name: 'Switch to Cosmos mode' }).click()
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'cosmos')
    await expect(modeToggle(page)).toHaveAccessibleName('Switch to Chaos mode')
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'cosmos')
    await page.getByRole('button', { name: 'Switch to Chaos mode' }).click()
    await expect(html(page)).toHaveAttribute('data-rift-mode', 'chaos')
  })

  test("a signed-in player's mode is saved to their account", async ({ page }) => {
    const server = await mockApi(page, { wins: 0 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to Cosmos mode' }).click()
    await expect.poll(() => server.patches).toContainEqual({ rift_mode: 'cosmos' })
    // Another device: the server's choice wins over this browser's cache.
    const other = await page.context().browser()!.newPage()
    await mockApi(other, { wins: 0, prefs: { rift_mode: 'cosmos' } })
    await other.goto('/')
    await expect(other.locator('html')).toHaveAttribute('data-rift-mode', 'cosmos')
    await other.close()
  })

  test('the saved mode paints before the app loads, with no flash of the other mode', async ({ page }) => {
    // The appearance request doesn't answer until the check is done, so only the cached mode can have painted.
    await mockApi(page, { wins: 0, getDelayMs: 60_000, prefs: { rift_mode: 'cosmos' } })
    await page.addInitScript(() => {
      localStorage.setItem(
        'da-appearance',
        JSON.stringify({
          preferences: { interface: 'rift', window_theme: 'classic', menu_font: 'auto', cursor: 'glove', window_rgb: [6, 10, 26], rift_mode: 'cosmos' },
          unlocks: [], rewards: [], ranked_wins: 0, ranked_losses: 0, next: null,
        }),
      )
    })
    await page.goto('/', { waitUntil: 'commit' })
    await page.waitForSelector('html[data-rift-mode="cosmos"]')
    // The first ground the styles paint is Cosmos steel, while the appearance request is still pending. The waits
    // used to be 2-2.5s against a 3s request, which a busy machine (styles arrive through Vite's JS) could miss.
    await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)')
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(184, 191, 202)')
  })

  test('Classic ignores the Rift mode', async ({ page }) => {
    await mockApi(page, { wins: 60, prefs: { interface: 'classic', rift_mode: 'cosmos' } })
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-interface', 'classic')
    await expect(modeToggle(page)).toHaveCount(0)
  })
})

test.describe('Preview', () => {
  test('shows Classic with the banner, saves nothing, and Back to Rift ends it', async ({ page }) => {
    const server = await mockApi(page, { wins: 4 })
    await page.goto('/')
    await classicButton(page).click()
    await page.getByRole('button', { name: 'Preview Classic' }).click()
    await expect(html(page)).toHaveAttribute('data-interface', 'classic')
    await expect(html(page)).toHaveAttribute('data-preview', 'classic')
    await expect(page.getByRole('status').filter({ hasText: 'PREVIEW' })).toContainText('Win 6 more ranked battles')

    // Survives a reload with no flash of Rift (the inline head script applies it before paint).
    await page.reload({ waitUntil: 'commit' })
    await page.waitForSelector('html[data-preview="classic"]', { timeout: 5000 })

    await page.getByRole('button', { name: 'Back to Rift' }).click()
    await expect(html(page)).toHaveAttribute('data-interface', 'rift')
    await expect(html(page)).not.toHaveAttribute('data-preview', 'classic')
    expect(server.patches).toEqual([])
  })

  test('ends in a new tab', async ({ page, context }) => {
    await mockApi(page, { wins: 0 })
    await page.goto('/')
    await classicButton(page).click()
    await page.getByRole('button', { name: 'Preview Classic' }).click()
    const other = await context.newPage()
    await mockApi(other, { wins: 0 })
    await other.goto('/')
    await expect(other.locator('html')).toHaveAttribute('data-interface', 'rift')
  })
})

test.describe('Classic for a player with 10 wins', () => {
  test('can switch, persists the choice, and later skins stay locked', async ({ page }) => {
    const server = await mockApi(page, { wins: 10 })
    await page.goto('/')
    await expect(classicButton(page).getByRole('img', { name: 'Locked' })).toHaveCount(0)
    await classicButton(page).click()
    await expect(html(page)).toHaveAttribute('data-interface', 'classic')
    expect(server.patches).toContainEqual({ interface: 'classic' })
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Battle' })).toBeVisible()

    await page.goto('/config')
    const crystal = page.getByRole('button', { name: /Crystal.*Unlocks at 15 wins/ })
    await expect(crystal).toBeDisabled()
    await expect(page.getByRole('button', { name: /8-bit.*Unlocks at 50 wins/ })).toBeDisabled()
    await expect(page.getByRole('slider')).toHaveCount(0)

    // Choosing Rift from Config switches back and keeps the Classic choices.
    await page.getByRole('button', { name: 'Cursor' }).first().isVisible()
    await page.getByRole('group', { name: 'Cursor' }).getByRole('button', { name: 'Arrow' }).click()
    await expect(html(page)).toHaveAttribute('data-cursor', 'arrow')
    await page.getByRole('main').getByRole('group', { name: 'Interface' }).getByRole('button', { name: 'Rift' }).click()
    await expect(html(page)).toHaveAttribute('data-interface', 'rift')
    await expect(html(page)).toHaveAttribute('data-cursor', 'arrow')
  })

  test('a 403 from the server reverts the change and opens the lock panel', async ({ page }) => {
    // A stale cache says Classic is unlocked; the server (slow to answer GET) says it isn't.
    const server = await mockApi(page, { wins: 3, getDelayMs: 3000 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'da-appearance',
        JSON.stringify({
          preferences: { interface: 'rift', window_theme: 'classic', menu_font: 'auto', cursor: 'glove', window_rgb: [6, 10, 26] },
          unlocks: ['classic_interface'], rewards: [], ranked_wins: 3, ranked_losses: 0, next: null,
        }),
      )
    })
    await page.goto('/', { waitUntil: 'commit' })
    // The cached look is on <html> before React renders (no flash).
    await page.waitForSelector('html[data-cursor="glove"][data-interface="rift"]', { timeout: 2000 })
    await classicButton(page).click()
    await expect.poll(() => server.patches).toContainEqual({ interface: 'classic' })
    await expect(html(page)).toHaveAttribute('data-interface', 'rift')
    await expect(page.getByRole('region', { name: 'Classic interface is locked' })).toContainText('Win 7 more')
  })
})

test.describe('Classic command menu', () => {
  test('moves with the Up and Down arrows and updates the help bar', async ({ page }) => {
    await mockApi(page, { wins: 60, prefs: { interface: 'classic' } })
    await page.goto('/')
    const menu = page.getByRole('navigation', { name: 'Main' })
    const battle = menu.getByRole('button', { name: 'Battle' })
    await expect(battle).toHaveAttribute('aria-current', 'page')
    await battle.focus()
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('button', { name: 'Hub' })).toBeFocused()
    await expect(page.locator('footer [aria-live="polite"]')).toContainText("This game's hub")
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await expect(menu.getByRole('button', { name: 'Config' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/config$/)
    await expect(menu.getByRole('button', { name: 'Config' })).toHaveAttribute('aria-current', 'page')
    await expect(menu.getByRole('button', { name: 'Config' })).toBeFocused()
  })

  test('custom colour sliders appear at 60 wins and switch to Custom', async ({ page }) => {
    const server = await mockApi(page, { wins: 60, prefs: { interface: 'classic' } })
    await page.goto('/config')
    const r = page.getByRole('slider').first()
    await r.focus()
    await page.keyboard.press('ArrowRight')
    await expect(html(page)).toHaveAttribute('data-window', 'custom')
    await expect.poll(() => server.patches.at(-1)).toMatchObject({ window_theme: 'custom', window_rgb: [7, 10, 26] })
    const top = await page.evaluate(() => document.documentElement.style.getPropertyValue('--win-top'))
    expect(top).toBe('#19245e') // customWindow(7, 10, 26).top: 7*3*1.2=25, 10*3*1.2=36, 26*3*1.2=94
  })
})

test.describe('Look and accessibility', () => {
  // These check still pixels. Home's shimmer sweeps under the panels' backdrop blur, so Chromium re-blurs every frame
  // (about 20 fps on one core); with every worker on Home at once that starved the suite into timeouts.
  test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }))

  for (const mode of ['chaos', 'cosmos'] as const) {
    for (const [label, size] of SIZES) {
      test(`Rift home in ${MODE_NAME[mode]} passes colour contrast at ${label} width`, async ({ page }) => {
        await page.setViewportSize(size)
        await mockApi(page, { wins: 12, losses: 5, prefs: { rift_mode: mode } })
        await page.goto('/')
        await expect(html(page)).toHaveAttribute('data-rift-mode', mode)
        await page.waitForLoadState('networkidle')
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
        expect(results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`))).toEqual([])
      })

      test(`Rift home in ${MODE_NAME[mode]} has no axe violations at ${label} width`, async ({ page }) => {
        await page.setViewportSize(size)
        await mockApi(page, { wins: 22, prefs: { rift_mode: mode } })
        for (const url of ['/', '/rewards']) {
          await page.goto(url)
          await page.waitForLoadState('networkidle')
          const r = await new AxeBuilder({ page }).analyze()
          expect(r.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
        }
      })

      // WCAG 1.4.11, which axe doesn't test: an icon in a crest needs 3:1 against the crest's fill. Pages built later
      // (the sidebar, the phone bar) put their icons in the same FramedIcon, so this picks them up.
      test(`every crest icon in ${MODE_NAME[mode]} stands out from its frame at ${label} width`, async ({ page }) => {
        await page.setViewportSize(size)
        await mockApi(page, { wins: 12, prefs: { rift_mode: mode } })
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        const pairs = await crestRatios(page)
        // The game switcher's two crests at least, one pressed and one not.
        expect(pairs.length).toBeGreaterThanOrEqual(2)
        for (const [where, ratio] of pairs) expect(ratio, where).toBeGreaterThanOrEqual(3)
      })
    }
  }

  test('every Rift font weight in use has loaded, in both modes', async ({ page }) => {
    await mockApi(page, { wins: 12, losses: 5 })
    for (const [mode, url] of (['chaos', 'cosmos'] as const).flatMap((m) => ['/', '/rewards', '/config', '/queue'].map((u) => [m, u] as const))) {
      await page.goto(url)
      if (mode === 'cosmos' && url === '/') await page.getByRole('button', { name: 'Switch to Cosmos mode' }).click()
      await expect(html(page)).toHaveAttribute('data-rift-mode', mode)
      await page.waitForLoadState('networkidle')
      const missing = await page.evaluate(async () => {
        await document.fonts.ready
        const loaded = new Set(
          [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')}|${f.weight}|${f.style}`),
        )
        const out = new Set<string>()
        for (const el of document.querySelectorAll('body *')) {
          const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())
          // Classic window swatches (reward previews) keep Classic's own fonts.
          if (!hasText || !(el as HTMLElement).offsetParent || el.closest('[data-window]')) continue
          const cs = getComputedStyle(el)
          const family = cs.fontFamily.split(',')[0].trim().replace(/["']/g, '')
          const key = `${family}|${cs.fontWeight}|${cs.fontStyle}`
          if (!loaded.has(key)) out.add(`${key} (${el.tagName.toLowerCase()}: ${el.textContent!.trim().slice(0, 30)})`)
        }
        return [...out]
      })
      expect(missing, `${mode} ${url}`).toEqual([])
    }
  })

  for (const win of WINDOW_KEYS) {
    test(`Classic home passes colour contrast in the ${win} window`, async ({ page }) => {
      await mockApi(page, { wins: 60, losses: 5, prefs: { interface: 'classic', window_theme: win } })
      await page.goto('/')
      await expect(html(page)).toHaveAttribute('data-window', win)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
      expect(results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`))).toEqual([])
    })
  }

  test('no axe violations on the Classic home and Config', async ({ page }) => {
    await mockApi(page, { wins: 60, prefs: { interface: 'classic' } })
    for (const url of ['/', '/config', '/rewards']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      const r = await new AxeBuilder({ page }).analyze()
      expect(r.violations.map((v) => `${url} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    }
  })

  test('signed-out Home does not scroll sideways at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await mockApi(page, { wins: null })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Dissidia Arena' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
