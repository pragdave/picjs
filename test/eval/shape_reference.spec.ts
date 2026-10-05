import { newDispatcher } from "../helpers/eval.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"
import { SBase, SLine } from "../../src/shapes.js"
import { TPosition } from "../../src/types.js"

function runProgram(src: string) {
  const parseResult = parseToAST(parse, src, `Start`, false)
  if (parseResult.status !== ParseStatus.Ok) throw new Error(String(parseResult.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parseResult.ast)
  return dispatcher
}

// the value of variable `v` after running src
function valueAfter(src: string, v = `v`) {
  return runProgram(src).getCurrentBinding().get_variable_value(v)
}

// x of the shape held in variable `v`, once laid out
function xOf(src: string, v: string, t = 0) {
  const dispatcher = runProgram(src)
  dispatcher.applyTimelineUpTo(t)
  return (dispatcher.getCurrentBinding().get_variable_value(v) as SBase).anchor.x
}

const ThreeBoxes = `
  a = Box at (1, 0)
  b = Box at (2, 0)
  c = Box at (3, 0)
`

describe(`shape references`, () => {

  describe(`counting from the start`, () => {
    it.each([
      [`first box`, `a`], [`1st box`, `a`],
      [`second box`, `b`], [`2nd box`, `b`],
      [`third box`, `c`], [`3rd box`, `c`],
    ])(`%s`, (ref, name) => {
      const binding = runProgram(`${ThreeBoxes}  v = ${ref}`).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(name))
    })
  })

  describe(`counting from the end`, () => {
    it.each([
      [`last box`, `c`], [`first last box`, `c`],
      [`second last box`, `b`], [`2nd last box`, `b`],
      [`third last box`, `a`], [`3rd last box`, `a`],
    ])(`%s`, (ref, name) => {
      const binding = runProgram(`${ThreeBoxes}  v = ${ref}`).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(name))
    })
  })

  it(`works with attributes and arithmetic`, () => {
    const p = valueAfter(`${ThreeBoxes}  v = last box.n + (0, 1)`) as TPosition
    expect([p.x, p.y]).toEqual([3, -0.375 + 1])
  })

  it(`accepts the capitalized shape names, and Shape for any kind`, () => {
    const binding = runProgram(`${ThreeBoxes}  d = Circle at (4, 0)  v = last Box  w = last Shape  u = 2nd last Shape`)
      .getCurrentBinding()
    expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`c`))
    expect(binding.get_variable_value(`w`)).toBe(binding.get_variable_value(`d`))
    expect(binding.get_variable_value(`u`)).toBe(binding.get_variable_value(`c`))
  })

  it(`counts each kind of shape separately`, () => {
    const binding = runProgram(`
      a = Box at (1, 0)
      k = Circle at (2, 0)
      b = Box at (3, 0)
      v = last circle
      w = 2nd box
    `).getCurrentBinding()
    expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`k`))
    expect(binding.get_variable_value(`w`)).toBe(binding.get_variable_value(`b`))
  })

  it(`counts multi-segment lines as lines`, () => {
    const binding = runProgram(`
      l = Line from (0, 0) then (1, 0) then (1, 1)
      v = last line
    `).getCurrentBinding()
    expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`l`))
  })

  describe(`means the order shapes were drawn in`, () => {
    it(`counts shapes drawn in loops and functions`, () => {
      expect(xOf(`[1..3].each(i => { Box at (i, 0) })  v = last box`, `v`)).toBe(3)
      expect(xOf(`make = i => Box at (i, 0)  make(7)  make(5)  v = last box`, `v`)).toBe(5)
    })

    it(`counts shapes inside groups`, () => {
      // a and b exist outside, so the group assigns to them rather than to its own variables
      const binding = runProgram(`a = 0  b = 0  Group { a = Box  b = Box }  v = last box`).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`b`))
    })

    it(`ignores when a shape appears on the timeline`, () => {
      const binding = runProgram(`
        @ = 5
        a = Box
        @ = 0
        b = Box
        v = last box
      `).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`b`))
    })

    it(`only sees shapes drawn so far`, () => {
      const binding = runProgram(`a = Box  v = last box  b = Box`).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`a`))
    })

    it(`means the previous shape, inside a new shape's own attributes`, () => {
      expect(xOf(`a = Box wid 2 at (10, 0)  v = Box at last box.e`, `v`)).toBe(11)
    })
  })

  describe(`in positions that are worked out again later`, () => {
    it(`keeps meaning the same shape in a constraint`, () => {
      const src = `
        a = Box wid 2 at (10, 0)
        v = Box wid 2 with .w at last box.e
        c = Box at (50, 0)
      `
      expect(xOf(src, `v`)).toBe(12)
    })

    it(`keeps following that shape when it moves`, () => {
      const src = `
        a = Box wid 2 at (10, 0)
        v = Box wid 2 with .w at last box.e
        c = Box at (50, 0)
        move a to (20, 0) take 1
      `
      expect(xOf(src, `v`, 2)).toBe(22)
    })

    it(`keeps meaning the same shapes in a line's ends`, () => {
      const dispatcher = runProgram(`
        a = Box at (0, 0)
        b = Box at (4, 0)
        l = Line from 2nd last box to last box
        c = Box at (40, 0)
      `)
      dispatcher.applyTimelineUpTo(0)
      const line = dispatcher.getCurrentBinding().get_variable_value(`l`) as SLine
      const xs = [line.start.x, line.end.x].sort((p: number, q: number) => p - q)
      expect(xs[0]).toBeGreaterThan(0)
      expect(xs[1]).toBeLessThan(4)
    })
  })

  describe(`in animations and assignments, behaves exactly like a variable holding the shape`, () => {
    const timeline = (src: string) => (runProgram(src) as any).timeline.asArray()
    const positions = (src: string, t: number) => {
      const dispatcher = runProgram(src)
      dispatcher.applyTimelineUpTo(t)
      return dispatcher.shapes().map(s => [s.x, s.y, s.params.opacity ?? 1, s.params.fill])
    }

    it.each([
      [`move ... to`,       `move last box to (2, 2)`,              `move a to (2, 2)`],
      [`move ... north`,    `move last box north 1`,                `move a north 1`],
      [`move a cardinal`,   `move last box.s to (2, 2)`,            `move a.s to (2, 2)`],
      [`set an attribute`,  `set last box.opacity to 0 take 1`,     `set a.opacity to 0 take 1`],
      [`rotate`,            `rotate last box by 90`,                `rotate a by 90`],
      [`assign`,            `last box.fill = ~red`,                 `a.fill = ~red`],
      [`assign a position`, `last box.s = (3, 3)`,                  `a.s = (3, 3)`],
    ])(`%s`, (_name, withReference, withVariable) => {
      const ref = `a = Box\n${withReference}`
      const variable = `a = Box\n${withVariable}`
      expect(timeline(ref)).toEqual(timeline(variable))
      for (const t of [0, 0.5, 2])
        expect(positions(ref, t)).toEqual(positions(variable, t))
    })

    it(`draw`, () => {
      const ref = `l = line right 1 nodraw\ndraw last line take 1`
      const variable = `l = line right 1 nodraw\ndraw l take 1`
      expect(timeline(ref)).toEqual(timeline(variable))
    })
  })

  describe(`labels`, () => {
    it(`counts labels drawn on their own, not labels inside other shapes`, () => {
      const binding = runProgram(`
        t = Label "on its own"
        b = Box "inside a box"
        v = last Label
      `).getCurrentBinding()
      expect(binding.get_variable_value(`v`)).toBe(binding.get_variable_value(`t`))
    })
  })

  describe(`errors`, () => {
    it(`says how many there are when there aren't enough`, () => {
      expect(() => runProgram(`${ThreeBoxes}  v = 4th box`)).toThrow(/4th box.*only 3 boxes/)
      expect(() => runProgram(`${ThreeBoxes}  v = 4th last box`)).toThrow(/4th last box.*only 3 boxes/)
      expect(() => runProgram(`v = last circle`)).toThrow(/no circles/)
      expect(() => runProgram(`Box  v = 2nd box`)).toThrow(/only 1 box\b/)
    })
  })

  describe(`compatibility`, () => {
    it(`leaves the ordinal words free as variable names`, () => {
      expect(valueAfter(`first = 3  second = 4  last = 5  v = first + second + last`).value).toBe(12)
    })

    it(`keeps a word at the end of one line separate from a shape on the next`, () => {
      const dispatcher = runProgram(`last = 3\nv = last\nbox`)
      expect(dispatcher.getCurrentBinding().get_variable_value(`v`).value).toBe(3)
      expect(dispatcher.shapes().length).toBe(1)
    })

    it(`still reads numbers that aren't ordinals`, () => {
      expect(valueAfter(`v = 2 * 3`).value).toBe(6)
    })
  })
})
