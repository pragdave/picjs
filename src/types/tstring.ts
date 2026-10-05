import { RTE } from "../runtime_error.js"
import { AnimationStyle, TA, TInterpolatable } from "./_base.js"
import { TBool } from "./tbool.js"
import { TList } from "../types.js"
import { TNumber } from "./tnumber.js"

export class TString extends TInterpolatable<string> {
  static override readonly displayName = `String`

  constructor(value: string) {
    super(value, AnimationStyle.crossfade)
  }

  opPlus(other: TA)   { 
    if (other instanceof TString) 
      return new TString(this.value + other.value)
    return new TString(this.value + other.asText())
  }

  // "ab" * 3 is "ababab"
  opTimes(other: TA) {
    if (other instanceof TNumber)
      return new TString(this.value.repeat(other.value))
    throw new RTE(`"*" needs a number after a string, but this is ${other.nameForErrors()}`)
  }

  // "a,b" / "," is the list ["a", "b"]
  opDivide(other: TA) {
    if (other instanceof TString)
      return new TList(this.value.split(other.value).map(part => new TString(part)))
    throw new RTE(`"/" needs a string after a string, but this is ${other.nameForErrors()}`)
  }

  opEqual_to(other: TA) {
    return this.checkAndApplyBool(other, `==`, (a, b) => a === b) 
  }

  opNot_equal_to(other: TA) {
    return this.checkAndApplyBool(other, `!=`, (a, b) => a !== b) 
  }

  opLess_than(other: TA) { 
    return this.checkAndApplyBool(other, `<`, (a, b) => a < b) 
  }

  opLess_than_or_equal_to(other: TA)         { 
    return this.checkAndApplyBool(other, `<=`, (a, b) => a <= b) 
  }

  opGreater_than_than(other: TA)             {
    return this.checkAndApplyBool(other, `>`, (a, b) => a > b) 
  }

  opGreater_than_than_or_equal_to(other: TA) {
    return this.checkAndApplyBool(other, `>=`, (a, b) => a >= b) 
  }

  handle_attr_length() {
    return new TNumber(this.value.length)
  }

  checkAndApplyBool(other: TA, op: string, opFn: (a:string, b:string) => boolean) {
    if (other instanceof TString)
      return new TBool(opFn(this.value, other.value))
    throw new RTE(
      `Cannot compare "${this.value}" using ${op} with ${other.nameForErrors()}`
    )
  }


  interpolate(other: TString, ratio: number) {
    if (ratio > 0.5)
      return other
    else
      return this
  }

  toNative() {
    return this.value
  }

  override nameForErrors() {
    return JSON.stringify(this.value)
  }
}



