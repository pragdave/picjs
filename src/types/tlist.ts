import { RTE } from "../runtime_error.js"
import { Interpreter } from "../interpreter.js"
import { AnimationStyle, TBase, TA, BinaryOperatorMethod } from "./_base.js"
import { TNumber } from "./tnumber.js"
import { TNative } from "./tnative.js"
import { TString } from "../types.js"
import * as Iterable from "./iterable.js"


// native functions

export class TList extends TBase<TA[]> {
  static override readonly displayName = `List`

  constructor(list: TA[]) {
    super(list, AnimationStyle.none)

    this.attrs.push   = new TNative(`push`, [`item`],
                                    `add a new item to the end of a list`,
    (_: Interpreter, item: TA) => {
      this.value.push(item)
      return this
    })

    this.attrs.pop   = new TNative(`pop()`, [],
                                   `remove the last item from a list and return that item`,
    (_: Interpreter) => {
      if (this.value.length === 0) 
        throw new RTE(`Cannot pop an item from an empty list`)
      return <TA>(this.value.pop())
    })

    Iterable.addToAttrs(this)
  }

  opPlus(other: TA)   { return this.doOp(other, `opPlus`, `+`) }
  opMinus(other: TA)  { return this.doOp(other, `opMinus`, `-`) }
  opTimes(other: TA)  { return this.doOp(other, `opTimes`, `*`) }
  opDivide(other: TA) { return this.doOp(other, `opDivide`, `/`) }
  opPow(other: TA)    { return this.doOp(other, `opPow`, `^`) }


  getAtIndex(offset: TA) {
    if (offset instanceof TString) {
      return this.getAtAttr(offset.value)
    }
    return this.indexableGet(offset)
  }

  setAtIndex(index: TA, value: TA) {
    if (index instanceof TString)
      return this.setAtAttr(index.value, value)

    const i = this.indexNumber(index)
    if (i < 0) {
      throw new RTE(`List index ${i} is less than zero`)
    }

    this.value.length = Math.max(this.value.length, i + 1)
    this.value[i] = value
    return this
  }

  // computed attributes

  handle_attr_length() {
    return new TNumber(this.value.length)
  }

  // callb acks to support _Iterable_

  default_step() {
    return 1
  }

  first_index() {
    return 0
  }

  last_index() {
    return this.value.length - 1
  }

  at(n: number) {
    if (Number.isInteger(n) && n >= 0 && n < this.value.length)
      return this.value[n]

    throw new RTE(`Index "${n}" out of bounds (or is not an integer)`)
  }
  // helpers

  // Arithmetic is element by element, with another list of the same length,
  // or with a number
  doOp(other: TA, op: BinaryOperatorMethod, symbol: string) {
    if (other instanceof TList)
      return this.applyListOp(other, op, symbol)
    if (other instanceof TNumber)
      return this.applyScalarOp(other, op)

    throw new RTE(`"${symbol}" needs a number or another list with a list, but this is ${other?.toNative?.() ?? other}`)
  }

  applyListOp(other: TList, op: BinaryOperatorMethod, symbol: string) {
    if (other.value.length !== this.value.length) {
      throw new RTE(`"${symbol}" needs lists of the same length, but they have ` +
                    `${this.value.length} and ${other.value.length} items`)
    }
    return new TList(this.value.map((v, i) => v[op](other.value[i])))
  }

  applyScalarOp(other: TNumber, op: BinaryOperatorMethod) {
    return new TList(this.value.map(v => v[op](other)))
  }

  // Negative indexes count back from the end
  indexableGet(offset: TA) {
    const requested = this.indexNumber(offset)
    const len = this.value.length
    const index = requested < 0 ? len + requested : requested

    if (index < 0 || index >= len)
      throw new RTE(`List index ${requested} is outside a list of ${len} item${len === 1 ? `` : `s`}`)

    return this.value[index]
  }

  private indexNumber(index: TA) {
    if (!(index instanceof TNumber))
      throw new RTE(`A list index must be a number, but it is ${index?.toNative?.() ?? index}`)
    return index.value
  }

  toNative() {
    return this.value.map(v => v?.toNative())
  }

  toString() {
    const contents = this.value.map(v => v?.toString() ?? ``)
    return `[ ${contents.join(`, `)} ]`
  }
}


