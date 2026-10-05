import { newDispatcher } from "../helpers/eval.js"
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
  it(`say which operator a value doesn't support`, () => {
    expect(() => runProgram(`v = (1, 2) ^ 2`)).toThrow(/does not implement "\^"/)
  })

  it.each([
    [`a shape`,     `b = Box\nv = b.wobble`,  /Unknown attribute "wobble" for a Box$/],
    [`an arc`,      `a = Arc\nv = a.wobble`,  /Unknown attribute "wobble" for an Arc$/],
    [`a number`,    `x = 3\nv = x.wobble`,    /Unknown attribute "wobble" for 3$/],
  ])(`name the value with an unknown attribute: %s`, (_name, src, message) => {
    expect(() => runProgram(src)).toThrow(message)
  })
})
