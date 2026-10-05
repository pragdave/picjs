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

describe(`copying a color from one shape to another`, () => {
  it(`keeps a palette color's slot, so the copy follows the theme too`, async () => {
    expect(await render(`b = box fill ~b5\ncircle fill b.fill`))
      .toEqual(await render(`box fill ~b5\ncircle fill ~b5`))
  })

  it(`copies a named color`, async () => {
    expect(await render(`b = box fill ~red\ncircle fill b.fill`))
      .toEqual(await render(`box fill ~red\ncircle fill ~red`))
  })

  it(`is an error for a color the shape doesn't have`, () => {
    expect(() => frame(`l = line right 1\nv = l.fill`, 0)).toThrow(/a Line has no fill/)
  })
})

describe(`a group's opacity`, () => {
  // the opacities on the way down to the box's rectangle, which SVG multiplies
  const opacities = (svg: string) =>
    (svg.match(/<(g|rect)[^>]*>/g) ?? []).map(tag => Number(tag.match(/opacity="([^"]*)"/)?.[1] ?? 1))
  const effective = (svg: string) => opacities(svg).reduce((a, b) => a * b, 1)

  it(`applies once, to the group`, () => {
    expect(effective(frame(`g = Group opacity 0.5 { box }`, 0))).toBeCloseTo(0.5)
  })

  it(`applies once when animated`, () => {
    expect(effective(frame(`g = Group { box }\nset g.opacity to 0.5 take 1`, 2))).toBeCloseTo(0.5)
  })

  it(`combines with a shape's own opacity`, () => {
    expect(effective(frame(`g = Group opacity 0.5 { box opacity 0.4 }`, 0))).toBeCloseTo(0.2)
  })
})

describe(`a label's font`, () => {
  const valueOf = (src: string) => {
    const parsed = parseToAST(parse, src, `Start`, false)
    if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
    const dispatcher = newDispatcher()
    dispatcher.start(parsed.ast)
    return dispatcher.getCurrentBinding().get_variable_value(`v`).toNative()
  }

  // The family is quoted: a font family can be several words, so an unquoted
  // one runs on into whatever follows, even the next line
  it.each([
    [`family`, `"Georgia"`],
    [`size`,   `24pt`],
    [`style`,  `italic`],
  ])(`is the font it was given: %s`, (attr, expected) => {
    expect(valueOf(`l = Label "x" font italic 24pt "Georgia"\nv = l.font.${attr}`)).toBe(expected)
  })

  it(`is the default font when it was given none`, () => {
    expect(valueOf(`l = Label "x"\nv = l.font.family`)).toBe(`sans-serif`)
  })
})
