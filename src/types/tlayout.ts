// A layout separates "where things are" from "how they got there".
//
// `layout(fn)` takes a function that positions shapes from the current state of
// the program (for example, disks on pegs). It runs the function straight away,
// and its assignments take effect exactly as if they had been written inline.
//
// Each later `view.step()` runs the function again, but captures the position
// assignments rather than applying them. Every shape whose position differs from
// the last time the layout placed it is animated there with a `move`, all
// starting at `@`. `@` then advances to the end of those moves.
//
// Setting `view.transition = (shape, from, to) => ...` replaces that default
// move. It is called once per changed shape with `@` at the step's start, and
// `from` and `to` are both positions of the cardinal point the layout set.

import { AnimationStyle, TA, TBase } from "./_base.js"
import { TFunction } from "./tfunction.js"
import { TNative } from "./tnative.js"
import { TPosition } from "./tposition.js"
import { RTE } from "../runtime_error.js"
import { MoveToAnimator } from "../animators/_base.js"
import type { Interpreter } from "../interpreter.js"
import type { LayoutPlacement } from "../dispatcher.js"
import type { SBase } from "../shapes.js"
import type { Cardinals } from "../position.js"

interface Placed {
  placement: LayoutPlacement
  positionChanges: number   // the shape's count when we last placed it
}

export class TLayout extends TBase<TFunction> {

  private placed = new Map<SBase, Placed>()

  constructor(interpreter: Interpreter, fn: TA) {
    if (!(fn instanceof TFunction))
      throw new RTE(`layout needs a function that positions shapes, but was given ${fn?.toNative?.() ?? fn}`)
    super(fn, AnimationStyle.none)

    this.attrs.step = new TNative(`step`, [],
      `rerun the layout and animate every shape whose position has changed`,
      (interpreter) => this.step(interpreter))

    for (const p of this.run(interpreter, false))
      this.remember(interpreter, p)
  }

  step(interpreter: Interpreter) {
    const dispatcher = interpreter.dispatcher
    const start = dispatcher.currentRecordingTime()
    const changed = this.run(interpreter, true).filter(p => !this.isUnchanged(interpreter, p))
    const transition = this.transition()

    // Each changed shape's animation starts at `start`, whatever the
    // previous one did to `@`. The step ends when the last of them does.
    const end = dispatcher.latestAnimationEndOf(start, () => {
      for (const p of changed) {
        dispatcher.setRecordingTime(start)
        const last = this.placed.get(p.shape)
        if (transition && last) {
          const from = this.positionAt(last.placement, p.cardinal)
          interpreter.callFunction(transition, [p.shape, from, new TPosition(p.pos)])
        }
        else {
          dispatcher.addAnimation(new MoveToAnimator(p.shape, p.cardinal, p.pos, this.animationParams()))
        }
        this.remember(interpreter, p)
      }
    })

    dispatcher.setRecordingTime(end)
    return this
  }

  // Run the layout function, returning the last placement it made for each
  // shape, in the order the shapes were first placed.
  private run(interpreter: Interpreter, intercept: boolean): LayoutPlacement[] {
    const dispatcher = interpreter.dispatcher
    const outer = dispatcher.layoutCapture
    const capture = { intercept, placements: [] as LayoutPlacement[] }

    dispatcher.layoutCapture = capture
    try {
      interpreter.callFunction(this.value, [])
    }
    finally {
      dispatcher.layoutCapture = outer
    }

    const byShape = new Map<SBase, LayoutPlacement>()
    for (const p of capture.placements)
      byShape.set(p.shape, p)
    return [...byShape.values()]
  }

  private remember(interpreter: Interpreter, placement: LayoutPlacement) {
    const positionChanges = interpreter.dispatcher.positionChangesFor(placement.shape)
    this.placed.set(placement.shape, { placement, positionChanges })
  }

  private isUnchanged(interpreter: Interpreter, p: LayoutPlacement) {
    const last = this.placed.get(p.shape)
    return !!last
      && last.positionChanges === interpreter.dispatcher.positionChangesFor(p.shape)
      && last.placement.cardinal === p.cardinal
      && last.placement.pos.x === p.pos.x
      && last.placement.pos.y === p.pos.y
  }

  // Where `placement` put the shape's `cardinal` point.
  private positionAt(placement: LayoutPlacement, cardinal: Cardinals) {
    const shape = placement.shape
    const from = shape.cardinalOffset(placement.cardinal)
    const to = shape.cardinalOffset(cardinal)
    return new TPosition({ x: placement.pos.x - from.x + to.x, y: placement.pos.y - from.y + to.y })
  }

  private transition(): TFunction | TNative | null {
    const transition = this.attrs.transition
    if (transition === undefined) return null
    if (transition instanceof TFunction || transition instanceof TNative) return transition
    throw new RTE(`a layout's transition must be a function (shape, from, to), but it is ${transition.toNative()}`)
  }

  private animationParams() {
    const params: Record<string, any> = {}
    if (this.attrs.take !== undefined) params.take = this.attrs.take.toNative()
    if (this.attrs.ease !== undefined) params.ease = this.attrs.ease.toNative()
    return params
  }

  toNative() {
    return `layout(«function»)`
  }
}
