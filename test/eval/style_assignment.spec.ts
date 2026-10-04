// Changing a shape's color after it was created must look exactly like
// creating it with that color.

import { renderToStringAsync } from "../../src/render-to-string.js"
import { newDispatcher } from "../helpers/eval.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"
import { serialize } from "../../src/svg-node.js"

const render = async (src: string) => (await renderToStringAsync(src, { includeSource: false })).svg

// the rendered elements at time t
function frame(src: string, t: number) {
  const parsed = parseToAST(parse, src, `Start`, false)
  if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parsed.ast)
  dispatcher.applyTimelineUpTo(t)
  return dispatcher.renderToSvgNodes().map(serialize).join(``)
}

describe(`assigning a color to an existing shape`, () => {
  it.each([
    [`a palette fill`,     `b = box "Hello"\nb.fill = ~b5`,   `box "Hello" fill ~b5`],
    [`a named fill`,       `b = box "Hello"\nb.fill = ~red`,  `box "Hello" fill ~red`],
    [`a hex fill`,         `b = box\nb.fill = #336699`,       `box fill #336699`],
    [`a palette stroke`,   `b = box\nb.stroke = ~f4`,         `box stroke ~f4`],
    [`a named stroke`,     `b = box\nb.stroke = ~red`,        `box stroke ~red`],
  ])(`%s looks the same as creating the shape with it`, async (_name, assigned, created) => {
    expect(await render(assigned)).toEqual(await render(created))
  })
})

describe(`animating a color with set`, () => {
  const animated = `b = box\nset b.fill to ~b5 take 1`

  it(`ends looking the same as creating the shape with it`, () => {
    expect(frame(animated, 2)).toEqual(frame(`b = box fill ~b5`, 0))
  })

  it(`shows the colors in between`, () => {
    const middle = frame(animated, 0.5)
    expect(middle).not.toEqual(frame(animated, 0))
    expect(middle).not.toEqual(frame(animated, 2))
    expect(middle).not.toMatch(/pj-fill-/)     // an in-between color has no palette slot
  })
})
