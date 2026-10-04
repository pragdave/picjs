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

describe(`animation parameters`, () => {
  describe(`take`, () => {
    it(`sets how long the animation lasts`, () => {
      const dispatcher = runProgram(`b = Box\nmove b to (1, 1) take 2.5\n@@`)
      expect(dispatcher.currentRecordingTime()).toBe(2.5)
    })

    it(`can be zero`, () => {
      expect(() => runProgram(`b = Box\nmove b to (1, 1) take 0`)).not.toThrow()
    })

    it.each([
      [`a string`, `"soon"`],
      [`a color`,  `~red`],
      [`negative`, `-1`],
    ])(`must be a number of seconds, not %s`, (_name, take) => {
      expect(() => runProgram(`b = Box\nmove b to (1, 1) take ${take}`))
        .toThrow(/"take".*number of seconds/)
    })
  })

  describe(`ease`, () => {
    it(`must be one of the easing functions`, () => {
      expect(() => runProgram(`b = Box\nmove b to (1, 1) ease "wobbly"`))
        .toThrow(/"ease" parameter must be one of/)
    })
  })
})
