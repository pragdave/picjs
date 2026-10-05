import { RTE } from "../runtime_error.js"

// Late-bound factory for the `has()` method — avoids circular imports
// (TNative → Interpreter → TBase). Registered once from types.ts.
let _hasMethodFactory: ((host: TBase<any>) => any) | null = null
export function registerHasMethodFactory(factory: (host: TBase<any>) => any) {
  _hasMethodFactory = factory
}

export enum AnimationStyle  {
  none = `none`,
  continuous = `continuous`,
  crossfade = `crossfade`,
}

export type TA = TBase<any>

// The methods that implement the binary operators
export type BinaryOperatorMethod =
  `opPlus` | `opMinus` | `opTimes` | `opDivide` | `opModulo` | `opPow` |
  `opEqual_to` | `opNot_equal_to` | `opLess_than` | `opLess_than_or_equal_to` |
  `opGreater_than_than` | `opGreater_than_than_or_equal_to`

export class TBase<ValueType, > {
  attrs: Record<string, any>
  typeName = this.constructor.name


  constructor(public value: ValueType, public animationStyle: AnimationStyle = AnimationStyle.none) {
    this.attrs = {}
  }


  supportedAnimationStyle() {
    return this.animationStyle // none or continuous or crossfade
  }

  // The operators. A type that supports one overrides its method.

  opUnaryPlus(): TA  { return this.operatorNotSupported(`(unary) +`) }
  opUnaryMinus(): TA { return this.operatorNotSupported(`(unary) -`) }
  opNot(): TA        { return this.operatorNotSupported(`!`) }
  isTrue(): boolean  { return this.operatorNotSupported(`test if true`) }

  opPlus(_: TA): TA   { return this.operatorNotSupported(`+`) }
  opMinus(_: TA): TA  { return this.operatorNotSupported(`-`) }
  opTimes(_: TA): TA  { return this.operatorNotSupported(`*`) }
  opDivide(_: TA): TA { return this.operatorNotSupported(`/`) }
  opModulo(_: TA): TA { return this.operatorNotSupported(`%`) }
  opPow(_: TA): TA    { return this.operatorNotSupported(`^`) }

  opEqual_to(_: TA): TA                      { return this.operatorNotSupported(`==`) }
  opNot_equal_to(_: TA): TA                  { return this.operatorNotSupported(`!=`) }
  opLess_than(_: TA): TA                     { return this.operatorNotSupported(`<`) }
  opLess_than_or_equal_to(_: TA): TA         { return this.operatorNotSupported(`<=`) }
  opGreater_than_than(_: TA): TA             { return this.operatorNotSupported(`>`) }
  opGreater_than_than_or_equal_to(_: TA): TA { return this.operatorNotSupported(`>=`) }


  getUserDefinedAttribute(name: string) {
    return this.attrs[name]
  }

  getAtAttr(name: string, _args = []) {
    if (name in this.attrs) {
      return this.getUserDefinedAttribute(name)
    }
    if (name === `has` && _hasMethodFactory) {
      this.attrs.has = _hasMethodFactory(this)
      return this.attrs.has
    }
    return this.handleBuiltInAttribute(name)
  }

  setAtAttr(name: string, value: any) {
    this.attrs[name] = value
    return this
  }

  getAtIndex(index: any) {
    const key = String(index?.value ?? index)
    return this.getAtAttr(key)
  }

  setAtIndex(index: any, value: any) {
    const key = String(index?.value ?? index)
    return this.setAtAttr(key, value)
  }

  // end of the bunch of callbacks

  builtins() {
    return {}
  }


  // A built-in attribute comes from a method named handle_attr_<name>. Its
  // name is only known at run time, so this looks it up by name.
  handleBuiltInAttribute(name: string): TA {
    const handler = (this as unknown as Record<string, unknown>)[`handle_attr_${name}`]
    if (typeof handler !== `function`)
      throw new RTE(`Unknown attribute "${name}" for ${this.nameForErrors()}`)
    return handler.call(this)
  }

  // How this value is described in error messages
  nameForErrors(): string {
    return String(this.toNative())
  }

  toNative(): any {
    throw new Error(`type ${this.constructor.name} does not implement "toNative()"`)
  }


  toString() {
    return this.toNative().toString()
  }

  operatorNotSupported(op: string): never {
    throw new RTE(
      `${this.constructor.name} (${this.toNative()}) does not implement "${op}"`
    )
  }

  isSameTypeAs(other: TA) {
    return this.constructor.name === other.constructor.name
  }

  attributesAsTable() {
    const result:Record<string, any> = {}
    Object.entries(this.attrs).forEach(([k, v]) => {
      if (!(typeof v === `object` && v.constructor.name === `TNative`))
        result[k] = v
    })
    return result
  }
}

export interface Interpolatable {
  interpolate(other: TA, ratio: number): TA
}

export abstract class TInterpolatable<Type>  extends TBase<Type> implements Interpolatable { 
  abstract interpolate(other: TA, ratio: number): TA
}

export type TypeofTA = new (...args: any[]) => TA
