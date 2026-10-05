import { Cardinals, XY } from "../position.js"
import { Timeline } from "../timeline.js"
import { SBase } from "../shapes.js"
import { AnimatorBase } from "../animators/_base.js"
import type { TA } from "../types.js"

export const BigNumber = 0x40000000

let entryCounter = 0
const Incr = 1/65536   // power of two, so exact repr.

// Something to do at a time: create a shape, start an animation, and so on.
// `thing` is what it acts on.
export abstract class TLEntry<Thing = unknown> {

  key: number

  constructor(
    public thing: Thing,
    public start: number, 
    public end = BigNumber
  ) {
    this.key = start + (entryCounter += Incr)  // ensure order is stable
  }

  abstract process(timeline: Timeline): void  

  interval() {
    return [ this.start, this.end ]
  }

  dump() {
    const end = this.end === BigNumber ? `∞` : this.end.toPrecision(5)
    const start = this.start.toPrecision(5)
    console.log(`[${start}…${end}]\t${this.name()}\t${this.thingName()}`)
  }

  toHash() {
    const end = this.end === BigNumber ? `∞` : this.end.toPrecision(5)
    return {
      start: this.start,
      end,
      entryType: this.constructor.name,
      updates: this.thingName()
    }
  }

  // What the entry acts on, for showing: a shape's name, or the kind of thing
  thingName(): string {
    const thing: unknown = this.thing
    if (thing instanceof SBase) return thing.shapeName
    if (thing === null || thing === undefined) return String(thing)
    return (thing as object).constructor.name
  }
 
  name() {
    return this.constructor.name
  }
}

export class CreateShape extends TLEntry<SBase> {
  constructor(shape: SBase, start: number) {
    super(shape, start, start)  // instantaneous — end = start
  }

  process(_timeline: Timeline) {
    const revealTime = this.thing.params.reveal_time
    if (revealTime && revealTime > 0 && this.start > 0) {
      this.thing.params.opacity = 0
    }
    this.thing.visible = true
    this.thing.rememberRenderNeeded()
  }
}

export class UpdateShapeNoAnimation extends TLEntry<SBase> {

  constructor(
    shape: SBase, 
    start: number, 
    public attr_name: string, 
    public attr_value: TA
  ) {
    super(shape, start)
  }

  process(_timeline: Timeline) {
    this.thing.setAnimatableAttr(this.attr_name, this.attr_value)
  }

  name() {
    return `UpdateImmediate`
  }
}

export class PositionShapeNoAnimation extends TLEntry<SBase> {

  constructor(
    shape: SBase, 
    start: number, 
    public cardinal: Cardinals,
    public pos: XY
  ) {
    super(shape, start)
  }

  process(_timeline: Timeline) {
    const pos = this.pos
    const shape = this.thing
    const offset = shape.cardinalOffset(this.cardinal)
    shape.setAnimatablePosition(pos.x - offset.x, pos.y - offset.y)
  }

  name() {
    return `PositionImmediate`
  }
}


export class Pause extends TLEntry<string | null> {
  constructor(public message: string | null, start: number) {
    super(message, start, start)  // instantaneous
  }

  process(timeline: Timeline) {
    timeline.pauseRequested = true
    timeline.pauseMessage = this.message
  }

  name() { return `Pause` }
}

export class Animation extends TLEntry<AnimatorBase> {
  constructor(animation: AnimatorBase, start: number) {
    super(animation, start, start + animation.duration())   // the animator checks its duration
  }

  process(timeline: Timeline) {
    timeline.processAnimationShouldBeRun(this)
  }

  name() {
    return `Animate`
  }
}


