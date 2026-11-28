// Lab, round 3 (#70): screenshots of every lab scenario, as each player, in Chaos and Cosmos mode, at desktop and phone width.
// Needs the dev server: LAB_URL=http://localhost:5173 node scripts/lab-shots.mjs [scenario-id ...]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.LAB_URL ?? 'http://localhost:5173'
const out = process.env.LAB_OUT ?? 'lab-shots'
const only = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
const index = await browser.newPage()
await index.goto(`${base}/lab`)
await index.waitForSelector('.lab-index__links a')
// Each link on /lab is one scenario, player and mode.
const links = await index.$$eval('.lab-index__links a', (as) => as.map((a) => a.getAttribute('href')))
await index.close()

// A second shot after these steps: the dialog or form each scenario is about.
const STEPS = {
  'leave-confirm': (p) => p.getByRole('button', { name: 'Leave match' }).click(),
  'leave-replay': (p) => p.getByRole('button', { name: 'Leave match' }).click(),
  'reopen-control': async (p) => {
    await p.getByLabel('Match number').fill('212')
    await p.getByRole('button', { name: 'Find' }).click()
    await p.getByRole('button', { name: 'Reopen match #212' }).click()
  },
  'season-before': (p) => p.getByRole('button', { name: 'Start Season 1 for 012' }).click(),
}

const widths = { desktop: { width: 1366, height: 900 }, phone: { width: 390, height: 844 } }
let n = 0
for (const href of links) {
  const q = new URL(href, base).searchParams
  if (only.length && !only.includes(q.get('lab'))) continue
  for (const [w, viewport] of Object.entries(widths)) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    await page.goto(`${base}${href}`)
    await page.waitForTimeout(1200)
    // The lab bar is the lab's own chrome: hide it from the shots.
    await page.addStyleTag({ content: '.lab-bar{display:none!important}' })
    const where = new URL(href, base).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '')
    const name = [q.get('lab'), where, q.get('as'), q.get('mode'), w].join('_')
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
    const steps = STEPS[q.get('lab')]
    if (steps) {
      await steps(page)
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${out}/${name}_open.png`, fullPage: true })
      n++
    }
    await ctx.close()
    n++
  }
}
await browser.close()
console.log(`${n} screenshots in ${out}/`)
