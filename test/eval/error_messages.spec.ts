import { newDispatcher } from "../helpers/eval.js"
import { Dispatcher } from "../../src/dispatcher.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"

function runProgram(src: string) {
  const parseResult = parseToAST(parse, src, `Start`, false)
  if (parseResult.status !== ParseStatus.Ok) throw new Error(String(parseResult.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parseResult.ast)
  return dispatcher
}

describe(`error messages`, () => {
  it(`say what a number's interpolate needs`, () => {
    expect(() => runProgram(`x = 1\nv = x.interpolate(~red, 0.5)`)).toThrow(/interpolate needs a number for its other, but was given #ff0000/)
  })

  it(`say what a position can be combined with`, () => {
    expect(() => runProgram(`v = (1, 2) + [1, 2, 3]`)).toThrow(/a list of two numbers, but this list has 3/)
  })

  it(`say which operator a value doesn't support`, () => {
    expect(() => runProgram(`v = (1, 2) ^ 2`)).toThrow(/^\(1, 2\) does not implement "\^"$/)
  })

  // values are named by what they are, never by the class that holds them
  it.each([
    [`v = true == 3`,     /^Cannot execute "true == 3"$/],
    [`v = ~red == 3`,     /^Cannot execute "#ff0000 == 3"$/],
    [`v = "a" < 3`,       /^Cannot compare "a" using < with 3$/],
    [`v = 3 < "a"`,       /but this is "a"$/],
    [`v = 3 + true`,      /^true does not implement "\+"$/],
    [`v = 3 && true`,    /^"&&" needs boolean operands, but was given 3$/],
  ])(`name the values an operator was given: %s`, (src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })

  it.each([
    [`a shape`,     `b = Box\nv = b.wobble`,  /Unknown attribute "wobble" for a Box$/],
    [`an arc`,      `a = Arc\nv = a.wobble`,  /Unknown attribute "wobble" for an Arc$/],
    [`a number`,    `x = 3\nv = x.wobble`,    /Unknown attribute "wobble" for 3$/],
  ])(`name the value with an unknown attribute: %s`, (_name, src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })
})

describe(`string operators`, () => {
  it.each([
    [`"ab" * 3`,       `ababab`],
    [`"a,b,c" / ","`,  [`a`, `b`, `c`]],
  ])(`%s`, (src, expected) => {
    const dispatcher = runProgram(`v = ${src}`)
    expect(dispatcher.getCurrentBinding().get_variable_value(`v`).toNative()).toEqual(expected)
  })

  it.each([
    [`"ab" * "x"`,   /"\*" needs a number after a string, but this is "x"/],
    [`"ab" / 2`,     /"\/" needs a string after a string, but this is 2/],
  ])(`%s is an error that says what is needed`, (src, message) => {
    expect(() => runProgram(`v = ${src}`)).toThrow(message)
  })

  it.each([
    [`"a" + 3`,            `a3`],
    [`"a" + (1, 2)`,       `a(1, 2)`],
    [`"a" + [1, "b"]`,     `a[ 1, b ]`],
    [`"a#{3}"`,            `a3`],
    [`"a#{[1, 2]}"`,       `a[ 1, 2 ]`],
  ])(`%s puts the value's text in the string`, (src, expected) => {
    const dispatcher = runProgram(`v = ${src}`)
    expect(dispatcher.getCurrentBinding().get_variable_value(`v`).toNative()).toEqual(expected)
  })

  // a shape's text is only its debugging dump, which is never what was meant
  it.each([
    [`"a" + b`],
    [`"a#{b}"`],
    [`"a" + [1, b]`],
    [`"a#{[b]}"`],
  ])(`%s is an error: a string can't contain a shape`, src => {
    expect(() => runProgram(`b = Box\nv = ${src}`)).toThrow(/^A string can't contain a shape, but this is a Box$/)
  })

  it(`can still inspect a shape with ??`, () => {
    const logged: string[] = []
    const parsed = parseToAST(parse, `b = Box\n?? b`, `Start`, false)
    if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
    new Dispatcher((_loc, value) => logged.push(value), null as unknown as SVGElement, 1).start(parsed.ast)
    expect(logged[0]).toMatch(/^Box\t\tattrs: .*width 1/)
  })
})

describe(`native functions given the wrong kind of argument`, () => {
  it.each([
    [`sin("x")`,                         /sin needs a number for its angle, but was given "x"/],
    [`atan2(1, ~red)`,                   /atan2 needs a number for its dx, but was given #ff0000/],
    [`polar(~red, 1)`,                   /polar needs a number for its radius, but was given #ff0000/],
    [`~red.darken("x")`,                 /darken needs a number for its ratio, but was given "x"/],
    [`~red.spin(~blue)`,                 /spin needs a number for its angle, but was given #0000ff/],
    [`(3).times(4)`,                     /times needs a function for its callback, but was given 4/],
    [`[1, 2].each(5)`,                   /each needs a function for its callback, but was given 5/],
    [`[1..3].ease(5)`,                   /ease needs a string for its style, but was given 5/],
    [`[1..3].ease("wobbly")`,            /ease needs one of linear,.* but was given "wobbly"/],
  ])(`%s`, (src, message) => {
    expect(() => runProgram(`v = ${src}`)).toThrow(message)
  })
})

describe(`assigning the wrong kind of value`, () => {
  it.each([
    [`p = (1, 2)\np.x = "x"`,            /A position's x must be a number, but this is "x"/],
    [`@.now = "x"`,                      /@.now must be a time in seconds, but this is "x"/],
    [`b = Box\nb.x = "x"`,               /A shape's x must be a number, but this is "x"/],
    [`v = (1, 2) + ["a", "b"]`,          /a list of two numbers/],
    [`b = Box\nb.width = ~red`,          /A shape's width must be a number, but this is #ff0000/],
    [`b = Box\nset b.x to ~red`,         /a Box's x can't be set to #ff0000/],
  ])(`%s`, (src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })
})

describe(`native functions given the right arguments`, () => {
  const valueOf = (src: string) => runProgram(src).getCurrentBinding().get_variable_value(`v`).toNative()

  it(`polar`, () => {
    const p = valueOf(`v = polar(2, 90)`) as { x: number, y: number }
    expect(p.x).toBeCloseTo(0)
    expect(p.y).toBeCloseTo(2)
  })

  it(`times, with a callback that takes the count`, () => {
    expect(valueOf(`v = []\n(3).times(i => v.push(i))`)).toEqual([0, 1, 2])
  })
})

describe(`where shapes and lines are placed`, () => {
  it.each([
    [`line from 3 to (1, 1)`,                 /A line can only go from, to, or through a position or a shape, but this is 3/],
    [`line from (0, 0) to ~red`,              /but this is #ff0000/],
    [`line from (0, 0) then 3 then (1, 1)`,   /but this is 3/],
    [`line right "x"`,                        /A line's distance must be a number, but this is "x"/],
    [`Box with .nw at 3`,                     /"with ... at" needs a position or a shape, but this is 3/],
  ])(`%s is an error`, (src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })
})

describe(`colors and comparisons given the wrong kind of value`, () => {
  it.each([
    [`v = rgb("x", 1, 2)`,     /rgb needs a number for its 1st value, but was given "x"/],
    [`v = 3 < ~red`,           /"<" can only compare a number with a number, but this is #ff0000/],
  ])(`%s`, (src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })
})
