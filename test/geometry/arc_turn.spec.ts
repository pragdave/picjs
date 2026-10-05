// An arc's turn: cw and ccw are a quarter turn, and an angle turns that far,
// clockwise on screen when positive, as Face's angles are.

import { newDispatcher } from "../helpers/eval.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"
import { renderToString } from "../../src/index.js"
import type { SArc } from "../../src/shapes/sarc.js"
import type { LineLike } from "../../src/shapes/line_like.js"

const R = 0.625   // a bare arc's radius

function run(src: string) {
  const parsed = parseToAST(parse, src, `Start`, false)
  if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parsed.ast)
  dispatcher.renderToSvgNodes()
  return (name: string) => dispatcher.getCurrentBinding().get_variable_value(name) as unknown as LineLike
}

const close = (actual: { x: number, y: number }, x: number, y: number) => {
  expect(actual.x).toBeCloseTo(x)
  expect(actual.y).toBeCloseTo(y)
}

describe(`a bare arc`, () => {
  it.each([
    [`cw`,          `Arc`,              R,                     R],
    [`cw, as 90`,   `Arc turn 90`,      R,                     R],
    [`ccw`,         `Arc ccw`,          R,                     -R],
    [`ccw, as -90`, `Arc turn -90`,     R,                     -R],
    [`45`,          `Arc turn 45`,      R * Math.SQRT1_2,      R * (1 - Math.SQRT1_2)],
    [`180`,         `Arc turn 180`,     0,                     2 * R],
    [`-180`,        `Arc turn -180`,    0,                     -2 * R],
  ])(`turning %s ends where it should`, (_name, arc, x, y) => {
    close(run(`a = ${arc}`)(`a`).end, x, y)
  })

  // the line after the arc goes on in the direction the arc left
  it.each([
    [`90`,   `Arc turn 90`,   0,                1],
    [`45`,   `Arc turn 45`,   Math.SQRT1_2,     Math.SQRT1_2],
    [`-45`,  `Arc turn -45`,  Math.SQRT1_2,     -Math.SQRT1_2],
    [`180`,  `Arc turn 180`,  -1,               0],
    [`270`,  `Arc turn 270`,  0,                -1],
  ])(`turning %s turns the direction as far`, (_name, arc, dx, dy) => {
    const get = run(`a = ${arc}\nl = Line`)
    const line = get(`l`)
    close(line.start, get(`a`).end.x, get(`a`).end.y)
    close({ x: line.end.x - line.start.x, y: line.end.y - line.start.y }, dx, dy)
  })

  it(`turns relative to the way it is facing`, () => {
    // facing south, a clockwise quarter turn heads west
    const get = run(`Face s\na = Arc\nl = Line`)
    close(get(`a`).end, -R, R)
    const line = get(`l`)
    close({ x: line.end.x - line.start.x, y: line.end.y - line.start.y }, -1, 0)
  })
})

describe(`an arc between two points`, () => {
  const arc = (turn: string) => run(`a = Arc from (0, 0) to (2, 0) ${turn}`)(`a`) as SArc

  it.each([
    [`cw bulges up`,                ``,           -(Math.SQRT2 - 1)],
    [`a clockwise half turn`,       `turn 180`,   -1],
    [`an anticlockwise half turn`,  `turn -180`,  1],
    [`three quarters, clockwise`,   `turn 270`,   -(Math.SQRT2 + 1)],
  ])(`%s: its middle is where it should be`, (_name, turn, y) => {
    close(arc(turn).pointAtPercent(0.5), 1, y)
  })

  it(`is bounded by the whole curve when it turns past halfway`, () => {
    const a = arc(`turn 270`)
    close(a.nw, 1 - Math.SQRT2, -1 - Math.SQRT2)
    close(a.se, 1 + Math.SQRT2, 0)
  })

  // the canvas is made from extents, so a curve outside its extent is cut off
  it.each([
    [`a quarter turn`,  ``,          0,              -(Math.SQRT2 - 1), 2,              0],
    [`a half turn`,     `turn 180`,  0,              -1,                2,              0],
    [`three quarters`,  `turn 270`,  1 - Math.SQRT2, -1 - Math.SQRT2,   1 + Math.SQRT2, 0],
  ])(`%s takes up the space its curve does`, (_name, turn, minX, minY, maxX, maxY) => {
    const extent = arc(turn).extent()
    close({ x: extent.minX, y: extent.minY }, minX, minY)
    close({ x: extent.maxX, y: extent.maxY }, maxX, maxY)
  })
})

describe(`drawing an arc`, () => {
  const path = (src: string) => {
    const { svg, error } = renderToString(src, { includeSource: false })
    expect(error).toBeUndefined()
    return svg.match(/<path[^>]* d=" M [^"]*"/)![0]
  }
  // the flags in an SVG arc command: large-arc, then sweep (1 is clockwise)
  const flags = (src: string) => path(src).match(/A \S+ \S+ \S+ (\d) (\d)/)!.slice(1).join(` `)

  it.each([
    [`a quarter turn`,                      `Arc from (0, 0) to (2, 0)`,                  `0 1`],
    [`an anticlockwise quarter turn`,       `Arc from (0, 0) to (2, 0) ccw`,              `0 0`],
    [`three quarters`,                      `Arc from (0, 0) to (2, 0) turn 270`,         `1 1`],
    [`three quarters, anticlockwise`,       `Arc from (0, 0) to (2, 0) turn -270`,        `1 0`],
    [`well past halfway, with arrows`,      `Arc <-> from (0, 0) to (2, 0) turn 220`,     `1 1`],
    // each arrowhead takes about 12° off this arc, which takes it back under halfway
    [`a hair past halfway, with arrows`,    `Arc <-> from (0, 0) to (2, 0) turn 181`,     `0 1`],
  ])(`%s is drawn the right way round`, (_name, src, expected) => {
    expect(flags(src)).toBe(expected)
  })
})

describe(`an arc's turn`, () => {
  it.each([
    [`0`], [`360`], [`-360`], [`400`], [`"left"`],
  ])(`can't be %s`, turn => {
    expect(() => run(`Arc turn ${turn}`))
      .toThrow(/An arc's turn must be cw, ccw, or an angle between -360 and 360 other than 0/)
  })
})
