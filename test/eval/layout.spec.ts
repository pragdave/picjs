import { newDispatcher } from "../helpers/eval.js"
import { ParseStatus, parseToAST } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"
import * as TLE from "../../src/timeline/tlentries.js"

function runProgram(src: string) {
  const parseResult = parseToAST(parse, src, `Start`, false)
  if (parseResult.status !== ParseStatus.Ok) throw new Error(String(parseResult.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parseResult.ast)
  return dispatcher
}

function animations(dispatcher: any): TLE.Animation[] {
  return dispatcher.timeline.entries()
    .map((e: any) => e.element)
    .filter((e: any) => e instanceof TLE.Animation)
}

function timelineSummary(dispatcher: any) {
  return dispatcher.timeline.asArray()
}

// A box whose center follows the variable `x`
const OneBox = `
  b = Box
  px = 100
  view = layout(() => { b.c = (px, 0) })
`

describe(`layout`, () => {

  describe(`without step()`, () => {
    it(`places shapes exactly as the same assignments written inline`, () => {
      const withLayout = runProgram(`b = Box  layout(() => { b.c = (100, 50) })`)
      const inline     = runProgram(`b = Box  b.c = (100, 50)`)
      expect(timelineSummary(withLayout)).toEqual(timelineSummary(inline))

      withLayout.applyTimelineUpTo(0)
      expect(withLayout.shapes()[0].x).toBeCloseTo(100)
      expect(withLayout.shapes()[0].y).toBeCloseTo(50)
    })

    it(`adds no animations`, () => {
      const dispatcher = runProgram(OneBox)
      expect(animations(dispatcher)).toEqual([])
      expect(dispatcher.totalDuration()).toBe(0)
    })
  })

  describe(`step()`, () => {
    it(`does nothing when nothing changed`, () => {
      const dispatcher = runProgram(`${OneBox}  view.step()`)
      expect(animations(dispatcher)).toEqual([])
      expect(dispatcher.currentRecordingTime()).toBe(0)
    })

    it(`moves a shape whose position changed, then advances @`, () => {
      const dispatcher = runProgram(`${OneBox}  px = 300  view.step()`)
      const anims = animations(dispatcher)
      expect(anims.length).toBe(1)
      expect(anims[0].start).toBe(0)
      expect(anims[0].end).toBeCloseTo(0.7)       // the same default as move
      expect(dispatcher.currentRecordingTime()).toBeCloseTo(0.7)

      dispatcher.applyTimelineUpTo(1)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(300)
    })

    it(`starts at the current value of @`, () => {
      const dispatcher = runProgram(`${OneBox}  @ = 2  px = 300  view.step()`)
      const anims = animations(dispatcher)
      expect(anims[0].start).toBe(2)
      expect(dispatcher.currentRecordingTime()).toBeCloseTo(2.7)
    })

    it(`sequences consecutive steps`, () => {
      const dispatcher = runProgram(`${OneBox}  px = 200  view.step()  px = 300  view.step()`)
      const anims = animations(dispatcher)
      expect(anims.map(a => a.start)).toEqual([0, expect.closeTo(0.7)])

      dispatcher.applyTimelineUpTo(0.7)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(200)
      dispatcher.applyTimelineUpTo(2)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(300)
    })

    it(`uses the layout's take and ease attributes`, () => {
      const dispatcher = runProgram(`${OneBox}  view.take = 2  view.ease = "cubicOut"  px = 300  view.step()`)
      const anims = animations(dispatcher)
      expect(anims[0].end).toBeCloseTo(2)
      expect(anims[0].thing.ease()).toBe(`cubicOut`)
    })

    it(`only animates the shapes that changed, all starting together`, () => {
      const dispatcher = runProgram(`
        a = Box
        b = Box
        c = Box
        spots = [100, 200, 300]
        view = layout(() => {
          a.c = (spots[0], 0)
          b.c = (spots[1], 0)
          c.c = (spots[2], 0)
        })
        spots = [150, 200, 350]
        view.step()
      `)
      const anims = animations(dispatcher)
      expect(anims.length).toBe(2)
      expect(anims.map(a => a.start)).toEqual([0, 0])
    })

    it(`compares positions by the cardinal they were set with`, () => {
      const dispatcher = runProgram(`
        b = Box
        k = 0
        view = layout(() => {
          if (k == 0) { b.c = (100, 0) } else { b.s = (100, 0) }
        })
        k = 1
        view.step()
      `)
      expect(animations(dispatcher).length).toBe(1)
    })

    it(`puts a shape back if something else moved it since the last step`, () => {
      const dispatcher = runProgram(`${OneBox}  move b to (500, 0)  @@  view.step()`)
      const anims = animations(dispatcher)
      expect(anims.length).toBe(2)
      dispatcher.applyTimelineUpTo(5)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(100)
    })

    it(`does not put back shapes it did not place`, () => {
      const dispatcher = runProgram(`${OneBox}  other = Box  move other to (500, 0)  @@  view.step()`)
      expect(animations(dispatcher).length).toBe(1)
    })
  })

  describe(`errors`, () => {
    it(`requires a function`, () => {
      expect(() => runProgram(`layout(3)`)).toThrow(/layout.*function/)
    })
  })

  describe(`compatibility`, () => {
    it(`a user variable called layout still works`, () => {
      const dispatcher = runProgram(`layout = 3  b = Box  b.c = (layout, 0)`)
      dispatcher.applyTimelineUpTo(0)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(3)
    })
  })
})
