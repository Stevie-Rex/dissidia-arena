/** Lab, round 3 (#70): the link that opens a scenario on a page. */
export const labUrl = (id: string, path: string, opts: { as?: string; mode?: string } = {}) => {
  const [p, q = ''] = path.split('?')
  const params = new URLSearchParams(q)
  params.set('lab', id)
  if (opts.as) params.set('as', opts.as)
  if (opts.mode) params.set('mode', opts.mode)
  return `${p}?${params}`
}
