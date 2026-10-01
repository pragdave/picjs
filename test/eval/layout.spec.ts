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

  describe(`transition`, () => {
    const LiftAndDrop = `${OneBox}
      view.transition = (shape, from, to) => {
        move shape to (from.x, 50) take 1
        then move shape to (to.x, 50) take 2
        then move shape to to take 1
      }
    `

    it(`replaces the default move for shapes that changed`, () => {
      const dispatcher = runProgram(`${LiftAndDrop}  px = 300  view.step()`)
      const anims = animations(dispatcher)
      expect(anims.map(a => [a.start, a.end])).toEqual([[0, 1], [1, 3], [3, 4]])
    })

    it(`advances @ to the end of the transition`, () => {
      const dispatcher = runProgram(`${LiftAndDrop}  px = 300  view.step()`)
      expect(dispatcher.currentRecordingTime()).toBe(4)
    })

    it(`is given the old and new positions`, () => {
      const dispatcher = runProgram(`${LiftAndDrop}  px = 300  view.step()`)
      dispatcher.applyTimelineUpTo(1)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(100)
      expect(dispatcher.shapes()[0].y).toBeCloseTo(50)
      dispatcher.applyTimelineUpTo(3)
      expect(dispatcher.shapes()[0].x).toBeCloseTo(300)
      dispatcher.applyTimelineUpTo(4)
      expect(dispatcher.shapes()[0].y).toBeCloseTo(0)
    })

    it(`gives positions in the cardinal the layout used`, () => {
      const dispatcher = runProgram(`
        b = Box wid 2 ht 2
        k = 0
        seen = []
        view = layout(() => {
          if (k == 0) { b.c = (10, 10) } else { b.s = (20, 0) }
        })
        view.transition = (shape, from, to) => { seen.push(from)  seen.push(to) }
        k = 1
        view.step()
      `)
      // y grows downwards, so b.c at (10, 10) means b.s was at (10, 11)
      const seen = dispatcher.getCurrentBinding().get_variable_value(`seen`).value
      expect(seen.map((p: any) => [p.x, p.y])).toEqual([[10, 11], [20, 0]])
    })

    it(`runs every changed shape's transition from the same @`, () => {
      const dispatcher = runProgram(`
        a = Box
        b = Box
        spots = [100, 200]
        view = layout(() => { a.c = (spots[0], 0)  b.c = (spots[1], 0) })
        view.transition = (shape, from, to) => {
          move shape to to take 1
          @ += 5     // must not delay the next shape
        }
        spots = [150, 250]
        view.step()
      `)
      expect(animations(dispatcher).map(a => a.start)).toEqual([0, 0])
      expect(dispatcher.currentRecordingTime()).toBe(1)
    })

    it(`is not called when nothing changed`, () => {
      const dispatcher = runProgram(`${LiftAndDrop}  view.step()`)
      expect(animations(dispatcher)).toEqual([])
      expect(dispatcher.currentRecordingTime()).toBe(0)
    })

    it(`must be a function`, () => {
      expect(() => runProgram(`${OneBox}  view.transition = 3  px = 300  view.step()`))
        .toThrow(/transition.*function/)
    })
  })

  describe(`enter and exit`, () => {
    // `shown` controls which of a and b the layout places
    const TwoBoxes = `
      a = Box
      b = Box opacity 0.5
      shown = [true, false]
      view = layout(() => {
        if (shown[0]) { a.c = (100, 0) }
        if (shown[1]) { b.c = (200, 0) }
      })
    `
    const opacityAt = (src: string, t: number, i: number) => {
      const dispatcher = runProgram(src)
      dispatcher.applyTimelineUpTo(t)
      return (dispatcher.shapes()[i] as any).params.opacity ?? 1
    }
    const xAt = (src: string, t: number, i: number) => {
      const dispatcher = runProgram(src)
      dispatcher.applyTimelineUpTo(t)
      return dispatcher.shapes()[i].x
    }

    it(`leaves shapes the layout has not placed alone when there is no step`, () => {
      expect(opacityAt(TwoBoxes, 0, 1)).toBeCloseTo(0.5)
      expect(animations(runProgram(TwoBoxes))).toEqual([])
    })

    describe(`a shape placed for the first time in a step`, () => {
      const Enter = `${TwoBoxes}  @ = 1  shown = [true, true]  view.step()`

      it(`is hidden until the step`, () => {
        expect(opacityAt(Enter, 0, 1)).toBe(0)
        expect(opacityAt(Enter, 0.9, 1)).toBe(0)
      })

      it(`is in place at the start of the step, and fades in to its own opacity`, () => {
        expect(xAt(Enter, 1, 1)).toBeCloseTo(200)
        expect(opacityAt(Enter, 1, 1)).toBe(0)
        expect(opacityAt(Enter, 1.35, 1)).toBeGreaterThan(0)
        expect(opacityAt(Enter, 1.35, 1)).toBeLessThan(0.5)
        expect(opacityAt(Enter, 2, 1)).toBeCloseTo(0.5)
      })

      it(`advances @ past the fade`, () => {
        expect(runProgram(Enter).currentRecordingTime()).toBeCloseTo(1.7)
      })

      it(`is not hidden before the layout was declared`, () => {
        const src = `
          a = Box
          go = false
          @ = 1
          view = layout(() => { if (go) { a.c = (100, 0) } })
          @ = 2
          go = true
          view.step()
        `
        expect(opacityAt(src, 0.5, 0)).toBe(1)
        expect(opacityAt(src, 1.5, 0)).toBe(0)
        expect(opacityAt(src, 3, 0)).toBe(1)
      })
    })

    describe(`a shape the layout stops placing`, () => {
      const Exit = `${TwoBoxes}  @ = 1  shown = [false, false]  view.step()`

      it(`fades out where it is`, () => {
        expect(opacityAt(Exit, 1, 0)).toBe(1)
        expect(opacityAt(Exit, 2, 0)).toBe(0)
        expect(xAt(Exit, 2, 0)).toBeCloseTo(100)
        expect(runProgram(Exit).currentRecordingTime()).toBeCloseTo(1.7)
      })

      it(`fades back in at its new place if placed again`, () => {
        const src = `${TwoBoxes}
          a_x = 100
          view2 = layout(() => { if (shown[0]) { a.c = (a_x, 0) } })
          shown = [false, false]  view2.step()
          shown = [true, false]  a_x = 300  view2.step()
        `
        expect(opacityAt(src, 0.5, 0)).toBeGreaterThan(0)    // fading out
        expect(opacityAt(src, 0.7, 0)).toBe(0)
        expect(xAt(src, 0.7, 0)).toBeCloseTo(300)            // jumped while invisible
        expect(opacityAt(src, 1.4, 0)).toBeCloseTo(1)
      })

      it(`is not hidden before it entered`, () => {
        expect(opacityAt(Exit, 0.5, 0)).toBe(1)
      })
    })

    describe(`hooks`, () => {
      it(`view.enter replaces the fade in, with the shape already visible and in place`, () => {
        const src = `${TwoBoxes}
          seen = []
          view.enter = (shape, at) => {
            seen.push(at)
            move shape to at + (0, 50) take 2
          }
          @ = 1  shown = [true, true]  view.step()
        `
        expect(opacityAt(src, 0.5, 1)).toBe(0)
        expect(opacityAt(src, 1, 1)).toBeCloseTo(0.5)
        expect(xAt(src, 1, 1)).toBeCloseTo(200)
        const dispatcher = runProgram(src)
        expect(dispatcher.currentRecordingTime()).toBe(3)
        const seen = dispatcher.getCurrentBinding().get_variable_value(`seen`).value
        expect(seen.map((p: any) => [p.x, p.y])).toEqual([[200, 0]])
      })

      it(`view.exit replaces the fade out, and is given where the shape was`, () => {
        const src = `${TwoBoxes}
          seen = []
          view.exit = (shape, from) => {
            seen.push(from)
            move shape to from + (0, 500) take 2
          }
          @ = 1  shown = [false, false]  view.step()
        `
        expect(opacityAt(src, 3, 0)).toBe(1)
        const dispatcher = runProgram(src)
        expect(dispatcher.currentRecordingTime()).toBe(3)
        const seen = dispatcher.getCurrentBinding().get_variable_value(`seen`).value
        expect(seen.map((p: any) => [p.x, p.y])).toEqual([[100, 0]])
      })

      it(`must be functions`, () => {
        expect(() => runProgram(`${TwoBoxes}  view.enter = 1  shown = [true, true]  view.step()`))
          .toThrow(/enter.*function/)
        expect(() => runProgram(`${TwoBoxes}  view.exit = 1  shown = [false, false]  view.step()`))
          .toThrow(/exit.*function/)
      })
    })

    it(`never touches shapes the layout has never placed`, () => {
      const src = `${TwoBoxes}  scenery = Box  @ = 1  shown = [false, false]  view.step()`
      expect(opacityAt(src, 0, 2)).toBe(1)
      expect(opacityAt(src, 3, 2)).toBe(1)
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
