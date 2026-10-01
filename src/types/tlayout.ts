// A layout separates "where things are" from "how they got there".
//
// `layout(fn)` takes a function that positions shapes from the current state of
// the program (for example, disks on pegs). It runs the function straight away,
// and its assignments take effect exactly as if they had been written inline.
//
// Each later `view.step()` runs the function again, but captures the position
// assignments rather than applying them, and compares them with the last time
// the layout ran:
//
// * a shape placed both times, but somewhere different, moves there
// * a shape placed only this time enters: it appears in place and fades in
// * a shape placed only last time exits: it fades out where it is
//
// All of these start at `@`, and `@` then advances to the end of the last one.
// With `view.stagger = s` (or `view.step(s)` for one step), each shape instead
// starts s seconds after the previous one, in the order the layout placed them,
// with exits last.
// Shapes the layout has never placed are never touched.
//
// A shape first placed in a step is hidden from when the layout was declared
// (or from its creation, if later) until it enters, so it doesn't flash up at
// its default position.
//
// Each of these can be replaced by setting a function on the layout. They are
// called once per shape, with `@` at that shape's start:
//
//   view.transition = (shape, from, to) => ...   from, to: positions of the
//                                                cardinal point the layout set
//   view.enter = (shape, at) => ...              shape is already visible, at `at`
//   view.exit = (shape, from) => ...

import { AnimationStyle, TA, TBase } from "./_base.js"
import { TFunction } from "./tfunction.js"
import { TNative } from "./tnative.js"
import { TNumber } from "./tnumber.js"
import { TPosition } from "./tposition.js"
import { RTE } from "../runtime_error.js"
import { MoveToAnimator, createAttributeAnimator } from "../animators/_base.js"
import type { Interpreter } from "../interpreter.js"
import type { LayoutPlacement } from "../dispatcher.js"
import type { SBase } from "../shapes.js"
import type { Cardinals } from "../position.js"

interface Placed {
  placement: LayoutPlacement
  positionChanges: number   // the shape's count when we last placed it
}

type Hook = TFunction | TNative

export class TLayout extends TBase<TFunction> {

  // The shapes placed the last time the layout ran
  private placed = new Map<SBase, Placed>()

  // Every shape the layout has ever placed, with the opacity it had then
  private managed = new Map<SBase, number>()

  private declaredAt: number

  constructor(interpreter: Interpreter, fn: TA) {
    if (!(fn instanceof TFunction))
      throw new RTE(`layout needs a function that positions shapes, but was given ${fn?.toNative?.() ?? fn}`)
    super(fn, AnimationStyle.none)

    this.declaredAt = interpreter.dispatcher.currentRecordingTime()

    this.attrs.step = new TNative(`step`, [`[stagger]`],
      `rerun the layout and animate every shape whose position has changed`,
      (interpreter, stagger) => this.step(interpreter, stagger))

    for (const p of this.run(interpreter, false)) {
      this.manage(p.shape)
      this.remember(interpreter, p)
    }
  }

  step(interpreter: Interpreter, staggerArg?: TA) {
    const dispatcher = interpreter.dispatcher
    const start = dispatcher.currentRecordingTime()
    const stagger = this.stagger(staggerArg)
    let slot = 0
    const nextSlot = () => dispatcher.setRecordingTime(start + stagger * slot++)

    const placements = this.run(interpreter, true)
    const nowPlaced = new Set(placements.map(p => p.shape))
    const exiting = [...this.placed.keys()].filter(shape => !nowPlaced.has(shape))
    const hooks = {
      transition: this.hook(`transition`, `(shape, from, to)`),
      enter: this.hook(`enter`, `(shape, at)`),
      exit: this.hook(`exit`, `(shape, from)`),
    }

    // Each shape's animation starts `stagger` after the previous one's start,
    // whatever that animation did to `@`. The step ends when the last ends.
    const end = dispatcher.latestAnimationEndOf(start, () => {
      for (const p of placements) {
        const entering = !this.placed.has(p.shape)
        if (!entering && this.isUnchanged(interpreter, p)) continue

        nextSlot()
        if (entering)
          this.enter(interpreter, p, dispatcher.currentRecordingTime(), hooks.enter)
        else
          this.transition(interpreter, p, hooks.transition)
        this.remember(interpreter, p)
      }

      for (const shape of exiting) {
        nextSlot()
        this.exit(interpreter, shape, hooks.exit)
        this.placed.delete(shape)
      }
    })

    dispatcher.setRecordingTime(end)
    return this
  }

  private transition(interpreter: Interpreter, p: LayoutPlacement, hook: Hook | null) {
    if (hook) {
      const from = this.positionAt(this.placed.get(p.shape)!.placement, p.cardinal)
      interpreter.callFunction(hook, [p.shape, from, new TPosition(p.pos)])
    }
    else {
      interpreter.dispatcher.addAnimation(new MoveToAnimator(p.shape, p.cardinal, p.pos, this.animationParams()))
    }
  }

  private enter(interpreter: Interpreter, p: LayoutPlacement, start: number, hook: Hook | null) {
    const dispatcher = interpreter.dispatcher
    const shape = p.shape

    if (!this.managed.has(shape)) {
      this.manage(shape)
      const hideFrom = Math.max(this.declaredAt, dispatcher.creationTimeOf(shape))
      if (hideFrom < start)
        dispatcher.updateShapeStyleAt(hideFrom, shape, `opacity`, new TNumber(0))
    }

    dispatcher.setCardinalToPoint(shape, p.cardinal, p.pos.x, p.pos.y)
    const opacity = new TNumber(this.managed.get(shape)!)

    if (hook) {
      dispatcher.updateShapeStyleAt(start, shape, `opacity`, opacity)
      interpreter.callFunction(hook, [shape, new TPosition(p.pos)])
    }
    else {
      dispatcher.updateShapeStyleAt(start, shape, `opacity`, new TNumber(0))
      dispatcher.addAnimation(createAttributeAnimator(shape, `opacity`, opacity, this.animationParams()))
    }
  }

  private exit(interpreter: Interpreter, shape: SBase, hook: Hook | null) {
    if (hook) {
      const last = this.placed.get(shape)!.placement
      interpreter.callFunction(hook, [shape, new TPosition(last.pos)])
    }
    else {
      interpreter.dispatcher.addAnimation(
        createAttributeAnimator(shape, `opacity`, new TNumber(0), this.animationParams()))
    }
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

  private manage(shape: SBase) {
    if (!this.managed.has(shape))
      this.managed.set(shape, shape.params.opacity ?? 1)
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

  private hook(name: string, params: string): Hook | null {
    const hook = this.attrs[name]
    if (hook === undefined) return null
    if (hook instanceof TFunction || hook instanceof TNative) return hook
    throw new RTE(`a layout's ${name} must be a function ${params}, but it is ${hook.toNative()}`)
  }

  // The stagger passed to step(), or else the layout's stagger attribute
  private stagger(arg?: TA): number {
    const value = arg ?? this.attrs.stagger
    if (value === undefined) return 0
    if (value instanceof TNumber && value.value >= 0) return value.value
    throw new RTE(`a layout's stagger must be a number of seconds, 0 or more, but it is ${value.toNative()}`)
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
