// The library's entry point (src/index.ts, built as dist/picjs.js) gives the
// renderer its dependencies up front, so renderToString works without first
// awaiting ensureReady(). These render through that path.

import { renderToString } from "../../src/index.js"

describe(`renderToString through the library entry point`, () => {
  it(`renders a diagram`, () => {
    const result = renderToString(`Box`, { includeSource: false })
    expect(result.error).toBeUndefined()
    expect(result.svg).toContain(`<rect`)
  })

  it.each([
    [`an empty diagram`,           ``],
    [`a diagram that draws nothing`, `x = 1`],
  ])(`renders %s, at the default size`, (_name, src) => {
    const result = renderToString(src, { includeSource: false })
    expect(result.error).toBeUndefined()
    expect([result.width, result.height]).toEqual([10, 7])
  })
})
