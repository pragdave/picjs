import { RTE } from "../runtime_error.js"
import { AnimationStyle, TInterpolatable, TA } from "./_base.js"
import { TList } from "./tlist.js"
import { TNumber } from "./tnumber.js"
import { XY } from "../position.js"


type ScalarOp = (a: number, b: number) => number

const ScalarFn: Record<string, ScalarOp> = {
  plus:   (a: number, b: number) => a + b,
  minus:  (a: number, b: number) => a - b,
  times:  (a: number, b: number) => a * b,
  divide: (a: number, b: number) => a / b,
}

function notSupported(op: string) {
  throw new RTE(`Operator ${op} is not supported by positions`)
}

export class TPosition extends TInterpolatable<XY> {
  static override readonly displayName = `Position`

  constructor(pos: XY | TNumber | number, y?: TNumber | number);
  constructor(x: XY | TNumber | number, y: TNumber | number) {
    if (x instanceof TNumber) x = x.toNative()
    if (y instanceof TNumber) y = y.toNative()

    if (typeof x === `number` && typeof y === `number`)
      super({ x, y }, AnimationStyle.continuous)
    else if (typeof x === `object`)
      super(x, AnimationStyle.continuous)
    else
      throw new Error(`bad parameter to Position: ${JSON.stringify(x)}`)

  }

  opPlus(other: TA)   { return this.doOp(other, `plus`) }
  opMinus(other: TA)  { return this.doOp(other, `minus`) }
  opTimes(other: TA)  { return this.doOp(other, `times`) }
  opDivide(other: TA)  { return this.doOp(other, `divide`) }

  handle_attr_length() {
    return new TNumber(2)
  }

  handle_attr_x() {
    return new TNumber(this.value.x)
  }

  handle_attr_y() {
    return new TNumber(this.value.y)
  }

  getAtIndex(offset: TA) {
    if (!(offset instanceof TNumber)) {
      throw `attempt to index with ${offset.value}`
    }
    let index = offset.value
    const len = 2

    if (index < 0)
      index = len + index

    if (index < 0 || index >= len)
      throw `index ${index} outside list bounds (0..${len - 1})`

    return new TNumber(([ this.value.x, this.value.y])[index])
  }

  interpolate(other: TPosition, ratio: number) {
    const tx = this.value.x, ty = this.value.y,
      ox = other.value.x, oy = other.value.y

    return new TPosition(
      tx + ratio * (ox - tx),
      ty + ratio * (oy - ty)
    )
  }

  toString() {
    return `(${this.value.x}, ${this.value.y})`
  }

  toNative() {
    return { x: this.value.x, y: this.value.y }
  }

  get x() { return this.value.x }
  get y() { return this.value.y }

  setAtAttr(name: string, value: TA) {
    if (name === `x` || name === `y`) {
      if (!(value instanceof TNumber))
        throw new RTE(`A position's ${name} must be a number, but this is ${value.nameForErrors()}`)
      this.value[name] = value.value
      return this
    }
    return super.setAtAttr(name, value)
  }

  // helpers

  doOp(other: TA, op: string) {
    if (other instanceof TPosition)
      return this.applyPositionOp(other, op)
    if (other instanceof TList)
      return this.applyListOp(other, op)

    if (other instanceof TNumber)
      return this.applyScalarOp(other, op)

    throw `incompatible types: ${this.value} ${op} ${other.value}`
  }

  applyPositionOp(other: TPosition, op: string) {
    return this.applyXY(other.x, other.y, op)
  }

  applyListOp(other: TList, op: string) {
    if (other.value.length !== 2) {
      throw new RTE(`A position can only be combined with a list of two numbers, ` +
                    `but this list has ${other.value.length}`)
    }
    const [ x, y ] = other.value
    if (!(x instanceof TNumber) || !(y instanceof TNumber))
      throw new RTE(`A position can only be combined with a list of two numbers`)
    return this.applyXY(x.value, y.value, op)
  }


  applyScalarOp(other: TNumber, op: string) {
    return this.applyXY(other.value, other.value, op)
  }

  applyXY(x: number, y: number, op: string) {
    const opFn = ScalarFn[op] || notSupported(op)
    const newX = opFn(this.x, x)
    const newY = opFn(this.y, y)
    return  new TPosition(newX, newY)
  }
}



