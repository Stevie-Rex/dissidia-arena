/*
 * Screenshots of every lab page in Chaos mode and Cosmos mode, at desktop and phone width. Use it after each lab pass,
 * so a change to a shared piece (a frame, a button) is seen everywhere it appears, not just where it was made.
 *
 *   npm run dev            (in another terminal; the lab is at http://localhost:5173/lab)
 *   node scripts/lab-shots.mjs [out-dir]
 *
 * It prints any console errors and how far the phone layout overflows sideways (it should be 0).
 *
 * Then a Cosmos mode pass (#58): with direction C, it steps through every option of the Cosmos accent, Cosmos
 * plates and Medallion switches on the pages they change, saves a screenshot of each and runs axe's
 * color-contrast rule on it. axe cannot judge text on a gradient or on art, which is most of direction C, so for
 * each node it leaves undecided the script photographs each line of the text in black, in white and hidden. Where
 * the black and white renders differ is where the glyphs sit; it measures the real text colour against the hidden
 * render there (ignoring the 5% most extreme, for anti-aliasing). Visible text it cannot measure counts as a
 * failure. It prints every failure with the option that caused it, and exits non-zero if there are any. It only uses what a person sees: toolbar buttons by role and name, and the
 * rendered page.
 */
import { mkdirSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'lab-shots'
const url = process.env.LAB_URL ?? 'http://localhost:5173/lab'
const pages = ['Home', 'Hub', 'Match room', 'More menu', 'Crests', 'Light tests']
const modes = ['Chaos', 'Cosmos']
const screens = ['Desktop', 'Phone']

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }) // axe needs a context, not browser.newPage
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url)
await page.waitForTimeout(2000)

const toolbar = page.getByRole('banner', { name: 'Lab controls' })
const pick = (group, label) => toolbar.getByRole('group', { name: group }).getByRole('button', { name: label, exact: true }).click()
await pick('Status', 'None')

const overflow = []
let n = 0
for (const screen of screens) {
  await pick('Screen', screen)
  for (const name of pages) {
    for (const mode of modes) {
      await pick('Page', name) // "Light tests" switches to Cosmos mode, so set the mode after the page
      await pick('Mode', mode)
      await page.mouse.move(1, 1)
      await page.waitForTimeout(300)
      const file = `${out}/${String(++n).padStart(2, '0')}-${screen}-${name}-${mode}.png`.replaceAll(' ', '-').toLowerCase()
      await page.screenshot({ path: file, fullPage: true })
      if (screen === 'Phone') {
        const px = await page.evaluate(() => {
          const m = document.querySelector('.lab-main')
          return m ? m.scrollWidth - m.clientWidth : 0
        })
        if (px > 0) overflow.push(`${name} (${mode}): ${px}px`)
      }
    }
  }
}

/* ---------- Cosmos mode pass (#58) ---------- */

const ACCENTS = ['Olive · Current', 'Warm bronze · New', 'Copper bronze · New', 'Antique gold · New']
const PLATES = ['Steel · Current', 'Glass · New']
const MEDALLIONS = ['Current', '80% · New', '65% · New']
const contrast = []
let byPixels = 0
let hidden = 0

/**
 * The contrast of an element's text against the pixels behind its glyphs. Returns { ratio, need }, or
 * { skip: reason } when it can't measure: 'hidden' (not on screen, fine) or 'covered' / 'no glyphs' (a failure).
 */
async function pixelContrast(selector) {
  const el = page.locator(selector).first()
  if (!(await el.isVisible().catch(() => false))) return { skip: 'hidden' }
  // Bring it to the middle, and note it if something else (the floating status card, say) sits over it.
  const covered = await el.evaluate((e) => {
    e.scrollIntoView({ block: 'center', inline: 'nearest' })
    const r = e.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !top || !(e.contains(top) || top.contains(e))
  })
  if (covered) return { skip: 'covered' }
  // Measure behind the text itself, line by line: a link that wraps would otherwise take in the sentence around it.
  // Each line is cut to the element's own box: a big numeral's line box reaches past the well it sits in.
  const lines = await el.evaluate((e) => {
    const range = document.createRange()
    range.selectNodeContents(e)
    const box = e.getBoundingClientRect()
    return [...range.getClientRects()]
      .map((r) => {
        const x = Math.max(r.left, box.left)
        const y = Math.max(r.top, box.top)
        return { x, y, width: Math.min(r.right, box.right) - x, height: Math.min(r.bottom, box.bottom) - y }
      })
      .filter((r) => r.width >= 2 && r.height >= 2)
  })
  if (lines.length === 0) return { skip: 'hidden' }
  const text = await el.evaluate((e) => {
    // Read the colour before touching it: getComputedStyle is live.
    const { color, fontSize, fontWeight } = getComputedStyle(e)
    const big = parseFloat(fontSize) >= 24 || (parseFloat(fontSize) >= 18.66 && Number(fontWeight) >= 700)
    e.dataset.shotStyle = e.getAttribute('style') ?? ''
    return { color, big }
  })
  // Three renders of each line: the text in black, in white, and hidden. Where black and white differ are the
  // glyphs, however close the real text colour is to its background; the hidden render is what sits behind them.
  const shots = { black: [], white: [], behind: [] }
  for (const [key, ink] of [['black', '#000000'], ['white', '#FFFFFF'], ['behind', 'transparent']]) {
    await el.evaluate((e, ink) => {
      for (const [k, v] of [['color', ink], ['-webkit-text-fill-color', ink], ['text-shadow', 'none']]) e.style.setProperty(k, v, 'important')
    }, ink)
    for (const clip of lines) shots[key].push(await page.screenshot({ clip, animations: 'disabled' }))
  }
  await el.evaluate((e) => {
    e.setAttribute('style', e.dataset.shotStyle ?? '')
    delete e.dataset.shotStyle
  })
  let ratio = Infinity
  for (let i = 0; i < lines.length; i++) {
    const r = await glyphRatio(shots.black[i], shots.white[i], shots.behind[i], text.color)
    if (r !== null) ratio = Math.min(ratio, r)
  }
  return ratio === Infinity ? { skip: 'no glyphs' } : { ratio, need: text.big ? 3 : 4.5 }
}

/**
 * The contrast of `color` against what sits behind its glyphs: the pixels of `behind` wherever the black and white
 * renders differ. Takes the 5th-worst percentile, so anti-aliased edges don't count. Null if there are no glyphs.
 */
function glyphRatio(black, white, behind, color) {
  return page.evaluate(
    async ({ k, w, b, color }) => {
      const pixels = async (b64) => {
        const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
        const c = new OffscreenCanvas(img.width, img.height).getContext('2d')
        c.drawImage(img, 0, 0)
        return c.getImageData(0, 0, img.width, img.height).data
      }
      const [dark, light, off] = [await pixels(k), await pixels(w), await pixels(b)]
      const lum = (r, g, b) =>
        [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0)
      const fg = lum(...(color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))
      const ratios = []
      for (let i = 0; i < off.length; i += 4) {
        // A glyph pixel is mostly ink: black and white renders differ there by well over half the range.
        if (Math.abs(dark[i] - light[i]) + Math.abs(dark[i + 1] - light[i + 1]) + Math.abs(dark[i + 2] - light[i + 2]) < 400) continue
        const bg = lum(off[i], off[i + 1], off[i + 2])
        ratios.push((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05))
      }
      if (ratios.length === 0) return null
      ratios.sort((x, y) => x - y)
      return ratios[Math.floor(ratios.length * 0.05)]
    },
    { k: black.toString('base64'), w: white.toString('base64'), b: behind.toString('base64'), color },
  )
}

/**
 * Screenshot the stage in clean view (H hides the lab's own controls, so they never sit over the design), run
 * axe's color-contrast rule on it, and keep any failures under `label`.
 */
async function check(label, scope = '.lab-stage') {
  await page.keyboard.press('h')
  await page.mouse.move(1, 1)
  await page.waitForTimeout(400)
  const file = `${out}/${String(++n).padStart(2, '0')}-cosmos-${label.replaceAll(/[ ·%]+/g, '-').toLowerCase()}.png`
  await page.screenshot({ path: file, fullPage: true })
  const r = await new AxeBuilder({ page }).include(scope).withRules(['color-contrast']).analyze()
  for (const v of r.violations) for (const node of v.nodes) contrast.push(`${label}: ${node.target.join(' ')}: ${node.any[0]?.message ?? v.help}`)
  for (const v of r.incomplete) {
    for (const node of v.nodes) {
      const selector = node.target.join(' ')
      const m = await pixelContrast(selector)
      if (m.skip === 'hidden') {
        hidden++
        continue
      }
      if (m.skip) {
        contrast.push(`${label}: ${selector}: could not be measured (${m.skip})`)
        continue
      }
      byPixels++
      if (m.ratio < m.need) contrast.push(`${label}: ${selector}: ${m.ratio.toFixed(2)}:1 against the pixels behind it (needs ${m.need}:1)`)
    }
  }
  await page.evaluate(() => document.querySelector('.lab-main')?.scrollTo(0, 0))
  await page.keyboard.press('h')
  await toolbar.waitFor()
  if (label.startsWith('Phone')) {
    const px = await page.evaluate(() => {
      const m = document.querySelector('.lab-main')
      return m ? m.scrollWidth - m.clientWidth : 0
    })
    if (px > 0) overflow.push(`${label}: ${px}px`)
  }
}

await pick('Light variant', 'C · Burnished Steel')
await pick('Mode', 'Cosmos')
// "Narrow" is the desktop layout in an 820px window: the hero copy and the Chaos slab are closest there.
for (const screen of ['Desktop', 'Narrow', 'Phone']) {
  await pick('Screen', screen === 'Narrow' ? 'Desktop' : screen)
  await page.setViewportSize({ width: screen === 'Narrow' ? 820 : 1440, height: 900 })
  for (const accent of ACCENTS) {
    await pick('Cosmos accent · New', accent)
    await pick('Page', 'Home')
    await pick('Status', 'Searching') // the Searching dot
    await check(`${screen} Home accent ${accent}`)
    await pick('Page', 'Hub')
    await pick('Status', 'Match found') // the Match found title and timer
    await check(`${screen} Hub accent ${accent}`)
    await toolbar.getByRole('button', { name: '▶ Find a match' }).click()
    await page.waitForTimeout(1600) // let the shatter finish
    await check(`${screen} Match found accent ${accent}`, '.lab-found')
    await page.keyboard.press('Escape')
    await pick('Status', 'None')
  }
  await pick('Cosmos accent · New', ACCENTS[0])
  for (const plates of PLATES) {
    await pick('Cosmos plates · New', plates)
    for (const name of ['Home', 'Hub']) {
      await pick('Page', name)
      await check(`${screen} ${name} plates ${plates}`)
    }
  }
  await pick('Cosmos plates · New', PLATES[0])
  for (const size of MEDALLIONS) {
    await pick('Medallion · New', size) // this also goes to Home
    await check(`${screen} Home medallion ${size}`)
  }
  await pick('Medallion · New', MEDALLIONS[0])
}
await page.setViewportSize({ width: 1440, height: 900 })

console.log(`${n} screenshots in ${out}`)
console.log('phone overflow:', overflow.length ? overflow.join(', ') : 'none')
console.log('console errors:', errors.length ? errors.join('\n') : 'none')
console.log('Cosmos mode contrast failures:', contrast.length ? `\n${contrast.join('\n')}` : 'none')
console.log(`(${byPixels} text nodes axe could not judge were measured against their pixels; ${hidden} were off screen)`)
if (contrast.length || errors.length || overflow.length) process.exitCode = 1
await browser.close()
