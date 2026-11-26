/*
 * Screenshots of every lab page in dark and light, at desktop and phone width. Use it after each lab pass,
 * so a change to a shared piece (a frame, a button) is seen everywhere it appears, not just where it was made.
 *
 *   npm run dev            (in another terminal; the lab is at http://localhost:5173/lab)
 *   node scripts/lab-shots.mjs [out-dir]
 *
 * It prints any console errors and how far the phone layout overflows sideways (it should be 0).
 */
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const out = process.argv[2] ?? 'lab-shots'
const url = process.env.LAB_URL ?? 'http://localhost:5173/lab'
const pages = ['Home', 'Hub', 'Match room', 'More menu', 'Crests', 'Light tests']
const modes = ['Dark', 'Light']
const screens = ['Desktop', 'Phone']

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
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
      await pick('Page', name) // "Light tests" switches to light, so set the mode after the page
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

console.log(`${n} screenshots in ${out}`)
console.log('phone overflow:', overflow.length ? overflow.join(', ') : 'none')
console.log('console errors:', errors.length ? errors.join('\n') : 'none')
await browser.close()
