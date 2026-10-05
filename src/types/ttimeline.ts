import { RTE } from "../runtime_error.js"
import { TBase, TA } from "./_base.js"
import { TNumber } from "./tnumber.js"
import { Timeline } from "../timeline.js"

export class TTimeline extends TBase<Timeline> {
  static override readonly displayName = `Timeline`

  // Coerce to current recording time for arithmetic
  private asNumber() { return new TNumber(this.value.now()) }

  opPlus(other: TA)    { return this.asNumber().opPlus(other) }
  opMinus(other: TA)   { return this.asNumber().opMinus(other) }
  opTimes(other: TA)   { return this.asNumber().opTimes(other) }
  opDivide(other: TA)  { return this.asNumber().opDivide(other) }

  opEqual_to(other: TA)                      { return this.asNumber().opEqual_to(other) }
  opNot_equal_to(other: TA)                  { return this.asNumber().opNot_equal_to(other) }
  opLess_than(other: TA)                     { return this.asNumber().opLess_than(other) }
  opLess_than_or_equal_to(other: TA)         { return this.asNumber().opLess_than_or_equal_to(other) }
  opGreater_than_than(other: TA)             { return this.asNumber().opGreater_than_than(other) }
  opGreater_than_than_or_equal_to(other: TA) { return this.asNumber().opGreater_than_than_or_equal_to(other) }

  handle_attr_now() {
    return new TNumber(this.value.now())
  }

  handle_attr_max_time() {
    return new TNumber(this.value.maxTime())
  }

  handle_attr_last_animation_start() {
    return new TNumber(this.value.lastAnimationStart())
  }

  handle_attr_last_animation_end() {
    return new TNumber(this.value.lastAnimationEnd())
  }

  handle_attr_start_from() {
    return new TNumber(this.value.startFrom ?? 0)
  }

  setAtAttr(name: string, value: TA) {
    switch (name) {
      case `now`:
        this.value.setAtTime(this.time(name, value))
        return this
      case `start_from`:
        this.value.startFrom = this.time(name, value)
        return this
      default:
        throw new RTE(`The assignable attributes of the timeline are "@.now" and "@.start_from"`)
    }
  }


  private time(attribute: string, value: TA) {
    if (!(value instanceof TNumber))
      throw new RTE(`@.${attribute} must be a time in seconds, but this is ${value.nameForErrors()}`)
    return value.value
  }

  toString() {
    return `@(.now=${this.value.now()})`
  }

  toNative() {
    return this.value.timeline.toArray()
  }
}



