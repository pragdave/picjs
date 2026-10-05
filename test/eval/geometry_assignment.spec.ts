// Reading and assigning a shape's x, y, width and height after it was drawn

import { newDispatcher } from "../helpers/eval.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"
import { SBase } from "../../src/shapes.js"

function runProgram(src: string) {
  const parseResult = parseToAST(parse, src, `Start`, false)
  if (parseResult.status !== ParseStatus.Ok) throw new Error(String(parseResult.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parseResult.ast)
  return dispatcher
}

const valueOf = (src: string, name = `v`) =>
  runProgram(src).getCurrentBinding().get_variable_value(name).toNative()

// the shape in variable `b` once the timeline has played up to t
function shapeAt(src: string, t: number) {
  const dispatcher = runProgram(src)
  dispatcher.applyTimelineUpTo(t)
  return dispatcher.getCurrentBinding().get_variable_value(`b`) as SBase
}

describe(`a shape's x and y`, () => {
  it.each([
    [`b = Box at (0, 0)`, `b.x`, 0],
    [`b = Box at (0, 0)`, `b.y`, 0],
    [`b = Box at (2, 3)`, `b.x`, 2],
    [`b = Box at (2, 3)`, `b.y`, 3],
  ])(`%s: %s is %s`, (shape, attr, expected) => {
    expect(valueOf(`${shape}\nv = ${attr}`)).toBe(expected)
  })

  it(`can be assigned`, () => {
    const b = shapeAt(`b = Box at (1, 1)\nb.x = 3\nb.y = 4`, 0)
    expect(b.anchor).toEqual({ x: 3, y: 4 })
  })

  it(`can be animated`, () => {
    const src = `b = Box at (1, 1)\nset b.x to 3 take 1`
    expect(shapeAt(src, 0.5).anchor.x).toBeCloseTo(2)
    expect(shapeAt(src, 2).anchor).toEqual({ x: 3, y: 1 })
  })
})

describe(`a shape's width and height`, () => {
  it(`can be assigned`, () => {
    const b = shapeAt(`b = Box wid 1 ht 1\nb.width = 3\nb.height = 2`, 0)
    expect([b.width, b.height]).toEqual([3, 2])
  })

  it(`can be animated`, () => {
    expect(shapeAt(`b = Box wid 1\nset b.width to 3 take 1`, 2).width).toBe(3)
  })
})
