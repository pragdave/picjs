import { RTE } from "../runtime_error.js"
import { AnimationStyle, TBase, TA } from "./_base.js"

export class TBool extends TBase<boolean> {
  static override readonly displayName = `Boolean`
  constructor(value: boolean) {
    super(!!value, AnimationStyle.none)
  }

  isTrue()                  { return this.value }
  opEqual_to(other: TA)     { return this.checkAndApply(other, `==`, (a, b) => a === b) }
  opNot_equal_to(other: TA) { return this.checkAndApply(other, `!=`, (a, b) => a !== b) }

  opNot() {
    return new TBool(!this.value)
  }

  checkAndApply(other: TA, op: string, opFn: (a:boolean, b:boolean) => boolean) {
    if (other instanceof TBool)
      return new TBool(opFn(this.value, other.value))
    throw new RTE(
      `Cannot execute "${this.value} ${op} ${other.nameForErrors()}"`
    )
  }


  toNative() {
    return this.value
  }
}



