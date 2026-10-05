import { RTE } from "../runtime_error.js"
import { RenderParameters, TBase, TBool, TColor, TNumber, TPosition, TNative } from "../types.js"
import { DegreesToRadians } from "../geometry.js"
import { CardinalFactorsFromCenter, Cardinals, XY } from "../position.js"
import { Dispatcher } from "../dispatcher.js"
import * as AST from "../ast.js"
import { isKnownAttribute, acceptedAttributesFor } from "./attributes.js"
import { Binding } from "../binding.js"
import type { SGroup } from "./sgroup.js"  // type-only import avoids circular dependency
import type { TA } from "../types.js"
import type { TFont, OptionalFontAttributes } from "../types/tfont.js"

// A shape's attributes, once evaluated to plain values. The ones the code
// reads are typed here; any attribute can be set, so the rest are unknown.
export interface ShapeParams {
  [attribute: string]: unknown

  x?: number
  y?: number
  width?: number
  height?: number
  r?: number
  rx?: number
  ry?: number
  rotation?: number
  opacity?: number
  fill?: string
  stroke?: string
  stroke_width?: number
  linestyle?: string
  line_path?: string              // straight, smooth or stepped
  length?: number
  draw_progress?: number
  reveal_time?: number
  hide_time?: number

  text?: string
  font?: TFont | OptionalFontAttributes   // a spec, until SLabel makes it a TFont
  font_size?: number | string     // a number, or with units (12pt)
  font_family?: string
  line_height?: number
  maxwidth?: number

  start?: XY
  end?: XY
  waypoints?: XY[]
  closed?: boolean

  _fill_slot?: string             // a palette color's slot, for theming
  _stroke_slot?: string
  _parentFill?: string            // for a label inside a shape
  _parentFillSlot?: string
  _parentWidth?: number
  _parentHeight?: number
  _stackOffset?: number
}

// What a shape is made from: its evaluated attributes, plus the entries the
// interpreter adds (_shapeName, _class, and so on)
export type ShapeArgs = ShapeParams
export type ProcessedWithConstraint =  {
  type: `ProcessedWithConstraint`,
  cardinal: Cardinals,
  targetAsShapeObject: SBase,
}

// A label positioned along its line
export type LineLabelConstraint = {
  type: `LineLabelConstraint`,
  cardinal: Cardinals,
  parentShape: SBase,
  pathPercent: number,
  side: string,
}

export type WithConstraint = AST.ASTWithConstraint | ProcessedWithConstraint | LineLabelConstraint

export const CardinalAttributes = new Set([ `c`, `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw` ])

const OtherGeometryAttributes = new Set([ `x`, `y`, `width`, `height` ])

const StyleAttributes = new Set([ `thickness`, `fill`, `stroke` ])

const AbbreviatedAttrNames: { [abbrev: string]: string } = {
  ht: `height`,
  wid: `width`,
}

const ParamAliases: { [name: string]: string } = {
  thickness: `stroke_width`,
  radius: `r`,
  rad: `r`,
  ht: `height`,
  wid: `width`,
}


let sID = 1

function formatAttrs(attrs: ShapeParams) {
  const result = []
  for (const k of Object.keys(attrs).sort()) {
    const val = attrs[k]
    result.push(`${k} ${val ? String(val) : `␀`}`)
  }
  return result.join(` | `)
}

//////////////////////////////////////////////////////////////////////

export class SBase extends TBase<null> {

  // These are the SVG parameters
  public id        = `s-id-${sID++}`
  // the kind of shape, from the class: not its name, which minifying changes
  static readonly kind: string = `SBase`

  public shapeName = (this.constructor as typeof SBase).kind

  // Box, Arc
  override get typeName() {
    return this.shapeName.replace(/^S/, ``)
  }

  public params:         ShapeParams = {}
  public anchorX:        number | null = null
  public anchorY:        number | null = null
  public _hasExplicitAt = false
  public withConstraint?: WithConstraint

  protected dispatcher: Dispatcher
  protected hidden: Record<string, unknown> = {}
  protected bindingAtCreation: Binding
  protected childShape?: SBase
  parentShape?: SBase
  children: SBase[] = []

  // rotation trig values
  protected sinR = 0.0
  protected cosR = 0.0

  // dirty bits for rendering and geometry
  protected renderNeeded = false
  protected hasMoved = false
  variableDirty = false
  visible = false   // set true when CreateShape timeline entry is processed
  insideAside = false  // shapes created inside Aside blocks are not implicit connector targets

  // When true, autolayout accounts for next shape's entry edge (Gap endpoint)
  layoutAsEdge = false

  // Draw this shape before `behind` (so it appears behind it in SVG)
  behind?: SBase

  // Relative positioning within a parent group (see sgroup.ts)
  parentGroup?: SGroup
  relativeX?: number      // X offset from parent group anchor
  relativeY?: number      // Y offset from parent group anchor

  // Original AST args for re-evaluation when variables change
  astArgs?: AST.ShapeArgs

  // ---------------------------------
  //
  constructor(args: ShapeArgs, withConstraint: WithConstraint | undefined, dispatcher: Dispatcher) {
    super(null)
    this.withConstraint = withConstraint
    this.dispatcher = dispatcher
    this.bindingAtCreation = dispatcher.getCurrentBinding()
    this.setupParams(args)

    this.attrs.has = new TNative(`has`, [`attr_name`],
      `return true if this shape has the named attribute`,
      (_interpreter, attr_name) => {
        const name = String(attr_name)
        const resolved = AbbreviatedAttrNames[name] || name
        if (resolved in this.attrs) return new TBool(true)
        if (resolved in this.params) return new TBool(true)
        if (resolved in this.hidden) return new TBool(true)
        if (CardinalAttributes.has(resolved)) return new TBool(true)
        if (OtherGeometryAttributes.has(resolved)) return new TBool(true)
        if (StyleAttributes.has(resolved)) return new TBool(true)
        if ((`handle_attr_` + resolved) in this) return new TBool(true)
        return new TBool(false)
      })

    this.applyAutoColoring()
  }

  // Override in subclasses to apply automatic coloring (e.g., label text color from parent fill).
  // Called at the end of the constructor, after setupParams but before subclass field initializers.
  applyAutoColoring() {
    // Base implementation does nothing
  }

  reEvaluateArgs() {
    if (!this.astArgs) return
    const prev = this.dispatcher.currentEvaluatingShape
    this.dispatcher.currentEvaluatingShape = this
    const newArgs = this.dispatcher.evaluateArgs(this.astArgs, this.bindingAtCreation)
    this.dispatcher.currentEvaluatingShape = prev
    this.setupParams(newArgs)
  }

  valueOfTree(tree: AST.Node) {
    const prev = this.dispatcher.currentEvaluatingShape
    this.dispatcher.currentEvaluatingShape = this
    const result = this.dispatcher.valueOf(tree, this.bindingAtCreation)
    this.dispatcher.currentEvaluatingShape = prev
    return result
  }

  // Reject attributes this shape does not honour. The grammar parses most
  // options for most shapes, so without this they were stored and then quietly
  // discarded by the renderer. See shapes/attributes.ts.
  private checkAttributeIsKnown(attr: string) {
    if (isKnownAttribute(this.shapeName, attr))
      return

    throw new RTE(
      `"${this.typeName}" has no attribute "${attr}". ` +
      `It accepts: ${acceptedAttributesFor(this.shapeName).join(`, `)}`
    )
  }

  setupParams(args: ShapeArgs) {
    if (typeof args._shapeName === `string`) {
      this.shapeName = args._shapeName
    }
    this.params = this.dispatcher.getAllDefaultAttributes(
      `Shapes`,
      this.shapeName,
      typeof args._class === `string` ? args._class : `.normal`
    )

    for (const k of Object.keys(args)) {
      const val = args[k]
      if (k.endsWith(`_slot`)) {
        this.params[k] = val
      }
      else if (k.startsWith(`_`)) {
        this.hidden[k] = val
      }
      else if (k === `at`) {
        this.checkAttributeIsKnown(k)
        const { x, y } = val as XY
        this.anchorX = x
        this.anchorY = y
        this._hasExplicitAt = true
      }
      else {
        this.checkAttributeIsKnown(k)
        this.params[k] = val
        // Explicit color attribute overrides default slot
        const slotKey = `_${k}_slot`
        if (this.params[slotKey] && !args[slotKey]) {
          delete this.params[slotKey]
        }
      }
    }
    this.setRotationVector()
  }

  setRotationVector() {
    const radians = this.rotation * DegreesToRadians
    this.sinR = Math.sin(radians)
    this.cosR = Math.cos(radians)
  }


  missingDimensions() {
    return !(`width` in this.params && `height` in this.params)
  }

  calculateDimensions() {
    this.params.width  ??= 1
    this.params.height ??= 1
  }

  requiredPosition(): RenderParameters {
    const { x, y } = this.anchor

    const rc =
      this.rotationCenter
        ? this.valueOfTree(this.rotationCenter)
        : this.c

        return {
          cardinal: `c`,
          x,
          y,
          nw: this.nw,
          width: this.width,
          height: this.height,
          rotation: this.rotation,
          rotationCenter: rc,
        }
  }


  // here we deal with child nodes (for example when a shape has a text label)

  setupChildWithConstraint(child: AST.Shape) {
    child.withConstraint = this.createOverlappingWithConstraint()
    child.isChildShape = true  // Mark so geometry knows not to make this lastShape
    return child
  }

  // For line/arc labels with path-based positioning
  setupLineLabelConstraint(child: AST.Shape, pathPercent: number, side: string) {
    child.withConstraint = this.createLineLabelConstraint(pathPercent, side)
    child.isChildShape = true
    return child
  }

  // Create a constraint that positions label along path with perpendicular offset
  protected createLineLabelConstraint(pathPercent: number, side: string): LineLabelConstraint {
    return {
      type: `LineLabelConstraint`,
      cardinal: `c`,
      parentShape: this,
      pathPercent,
      side,
    }
  }

  addChild(child: SBase) {
    if (!this.childShape) {
      this.childShape = child
    }
    // Allow multiple children (for multiple line labels)
    child.parentShape = this
    this.children.push(child)
    child.params._parentWidth = this.width
    child.params._parentHeight = this.height
    // Pass fill for auto-text coloring with palette colors
    child.params._parentFill = this.params.fill
    if (this.params._fill_slot) {
      child.params._parentFillSlot = this.params._fill_slot
    }
    // Trigger auto-coloring now that parent info is available
    if (typeof child.applyAutoColoring === 'function') {
      child.applyAutoColoring()
    }
  }

  isChild() {
    return !!this.parentShape
  }

  isConnector() {
    return false
  }

  // ------------------- this part is used by the interpreter. all values are wrapped in Txxx types
  //

  handle_attr_x()         { return new TNumber(this.anchor.x)         }
  handle_attr_y()         { return new TNumber(this.anchor.y)         }
  handle_attr_wid()       { return new TNumber(this.width)            }
  handle_attr_width()     { return new TNumber(this.width)            }
  handle_attr_ht()        { return new TNumber(this.height)           }
  handle_attr_height()    { return new TNumber(this.height)           }

  handle_attr_fill()      { return this.colorAttribute(`fill`)   }
  handle_attr_stroke()    { return this.colorAttribute(`stroke`) }

  handle_attr_opacity()   { return new TNumber(this.params.opacity ?? 1) }
  handle_attr_rotation()  { return new TNumber(this.rotation)         }
  handle_attr_thickness() { return new TNumber(this.param(`stroke_width`)) }

  // cardinal points are dynamically generated based on the current center, width, and height

  handle_attr_c()         { return new TPosition(this.c)              }
  handle_attr_n()         { return new TPosition(this.n)              }
  handle_attr_ne()        { return new TPosition(this.ne)             }
  handle_attr_e()         { return new TPosition(this.e)              }
  handle_attr_se()        { return new TPosition(this.se)             }
  handle_attr_s()         { return new TPosition(this.s)              }
  handle_attr_sw()        { return new TPosition(this.sw)             }
  handle_attr_w()         { return new TPosition(this.w)              }
  handle_attr_nw()        { return new TPosition(this.nw)             }

  // we need to intercept attribute changes, because we're going to put them on the
  // timeline as well. 
  //
  // We still update the shape version of the attribute now: the repr version will
  // get updated when the timeline triggers a geometry update

  setAtAttr(name: string, value: TA) {
    if (name.startsWith(`_`)) {
      this.hidden[name.slice(1)] = value
      return this
    }

    name = AbbreviatedAttrNames[name] || name

    if (CardinalAttributes.has(name)) {
      if (!(value instanceof TPosition))
        throw new RTE(`the ".${name}" attribute needs a position, but I got ${value.toNative()}`)
      this.dispatcher.setCardinalToPoint(this, name as Cardinals, value.x, value.y)
    }
    else if (OtherGeometryAttributes.has(name)) {
      if (!(value instanceof TNumber))
        throw new RTE(`A shape's ${name} must be a number, but this is ${value.nameForErrors()}`)
      this.dispatcher.updateOtherGeometry(this, name, value)
    }
    else if (StyleAttributes.has(name)) {
      this.dispatcher.updateShapeStyle(this, name, value)
    }
    else {
      // assume no special processing for user defined attributes
    }

    if (name === `rotation`) {
      this.setRotationVector()
    }

    return super.setAtAttr(name, value)
  }


  // ------------------- this part is used by the layout. Typoes are JavaScript native

  hasNoXCoordinate() {
    return this.anchorX === null
  }

  hasNoYCoordinate() {
    return this.anchorY === null
  }

  hasExplicitPosition() {
    return this._hasExplicitAt || !!this.withConstraint
  }

  // these assume the anchor point is the center. This can be overridden
  // by particular shapes (such as text)

  get x() { return this.anchorX }
  get y() { return this.anchorY }

  // A parameter that the shape's defaults, or the geometry, always supply
  protected param<K extends keyof ShapeParams & string>(name: K): NonNullable<ShapeParams[K]> {
    const value = this.params[name]
    if (value === undefined || value === null)
      throw new Error(`internal error: a ${this.shapeName} has no ${name}`)
    return value as NonNullable<ShapeParams[K]>
  }

  // A color attribute, with its palette slot, so a copy still follows the
  // theme. Not every shape has both: a line has no fill.
  private colorAttribute(name: `fill` | `stroke`) {
    const color = this.params[name]
    if (color === undefined)
      throw new RTE(`${this.nameForErrors()} has no ${name}`)
    const result = TColor.fromString(color)
    const slot = this.params[`_${name}_slot`]
    if (typeof slot === `string`)
      result.paletteSlot = slot
    return result
  }

  // The anchor point, once the shape has been positioned
  get anchor(): XY {
    if (this.anchorX === null || this.anchorY === null)
      throw new Error(`internal error: a ${this.shapeName} was used before it was positioned`)
    return { x: this.anchorX, y: this.anchorY }
  }

  get width(): number  { return this.param(`width`) }
  get height(): number { return this.param(`height`) }

  get rotation(): number { return this.param(`rotation`) }
  get rotationCenter() { return this.hidden._rotationCenter as AST.Node | undefined }

  get nw() { return this.corner(`nw`) }
  get n() { return this.corner(`n`) }
  get ne() { return this.corner(`ne`) }
  get e() { return this.corner(`e`) }
  get se() { return this.corner(`se`) }
  get s() { return this.corner(`s`) }
  get sw() { return this.corner(`sw`) }
  get w() { return this.corner(`w`) }
  get c() { return this.corner(`c`) }


  // The axis-aligned box this shape occupies.
  //
  // This is deliberately not nw..se. A cardinal point is a point *on* the
  // shape — a circle's diagonals sit on its circumference, and a rotated
  // shape's corners turn with it — so neither is an extreme. Returns null when
  // the shape has no usable size, and the caller falls back to its anchor.
  extent(): { minX: number, minY: number, maxX: number, maxY: number } | null {
    const centre = this.c
    const w = Number(this.width)
    const h = Number(this.height)

    if (isNaN(centre.x) || isNaN(centre.y) || isNaN(w) || isNaN(h))
      return null

    const xs: number[] = []
    const ys: number[] = []

    for (const [dx, dy] of [ [-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2] ]) {
      xs.push(centre.x + dx * this.cosR - dy * this.sinR)
      ys.push(centre.y + dx * this.sinR + dy * this.cosR)
    }

    return {
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys),
    }
  }

  getCardinalOffsetsFromAnchor(cardinal: Cardinals) {
    let [fx, fy] = CardinalFactorsFromCenter[cardinal]
    fx = fx * this.width
    fy = fy * this.height
    return [
      fx * this.cosR - fy * this.sinR,
      fx * this.sinR + fy * this.cosR
    ]
  }

  corner(cardinal: Cardinals) {
    const anchor = this.anchor
    const [dx, dy] = this.getCardinalOffsetsFromAnchor(cardinal)
    let x = anchor.x + dx
    let y = anchor.y + dy

    // If this shape is in a group, transform from local to absolute coordinates
    if (this.parentGroup) {
      const group = this.parentGroup
      const gx = group.anchorX ?? 0
      const gy = group.anchorY ?? 0
      const rotation = (group.params.rotation ?? 0) * DegreesToRadians
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      // Apply group rotation then translation
      const absX = gx + x * cos - y * sin
      const absY = gy + x * sin + y * cos
      x = absX
      y = absY
    }

    return { x, y }
  }

  // animation

  getAnimatablePosition() {
    return this.handle_attr_c()
  }

  setAnimatablePosition(x: number, y: number) {
    if (this.params.x != x || this.params.y != y || this.anchorX === null) {
      this.params.x = this.anchorX = x
      this.params.y = this.anchorY = y
      this.rememberRenderNeeded(true)
      this.dispatcher.propagateDirty(this)
    }
  }

  // Crossfade animation support (for non-interpolatable attributes)
  // Subclasses can override to implement visual crossfade effects
  prepareForCrossfade(_targetValue: unknown) {}
  updateCrossFade(_ratio: number) {}
  finalizeCrossFade() {}


  getAnimatableAttr(attr: string) {
    return this.handleBuiltInAttribute(attr)
  }

  setAnimatableAttr(attr: string, newValue: TA) {
    // x and y are the anchor point: moving it moves the shape
    if (attr === `x` || attr === `y`) {
      if (!(newValue instanceof TNumber))
        throw new RTE(`A shape's ${attr} must be a number, but this is ${newValue.nameForErrors()}`)
      const anchor = this.anchor
      const value = newValue.value
      this.setAnimatablePosition(attr === `x` ? value : anchor.x, attr === `y` ? value : anchor.y)
      return
    }

    const paramName = ParamAliases[attr] || attr
    this.params[paramName] = newValue.toNative()

    // A palette color is drawn using its slot, which beats the color itself.
    // So the new color brings its own slot, or clears the old one, just as an
    // explicit color does when the shape is created.
    if (paramName === `fill` || paramName === `stroke`) {
      const slot = newValue instanceof TColor ? newValue.paletteSlot : undefined
      if (slot)
        this.params[`_${paramName}_slot`] = slot
      else
        delete this.params[`_${paramName}_slot`]
    }

    // Labels inside the shape pick their color to contrast with its fill
    if (paramName === `fill`) {
      for (const child of this.children) {
        child.params._parentFill = this.params.fill
        if (this.params._fill_slot)
          child.params._parentFillSlot = this.params._fill_slot
        else
          delete child.params._parentFillSlot
        child.applyAutoColoring()
        child.rememberRenderNeeded()
      }
    }

    if (attr === `rotation`)
      this.setRotationVector()
    this.rememberRenderNeeded()
    this.dispatcher.propagateDirty(this)
  }


  // cardinal(posn) {
  //   const { x, y } = this.cardinalOffset(posn)
  //   return new TPosition(
  //     new TNumber(this.nwx + x),
  //     new TNumber(this.nwy + y)
  //   )
  // }


  // It would be nice to optimize this, but only the renderer knows the actual
  // corners (as opposed to the BBox corners)
  cardinalOffset(corner: Cardinals) {
    const point = this[corner]
    const center = this.c

    return { x: point.x - center.x, y: point.y - center.y }
  }


  // The default is to assume a rectangular box. Individual widgets
  // can override

  cropLineTo(_: unknown, target: XY) {
    const center = this.c
    const { x, y } = this.cropLineRelative(center, target)
    return { x: x + center.x, y: y + center.y }
  }

  cropLineRelative(center: XY, target: XY) {
    const halfWidth = this.width / 2
    const halfHeight = this.height / 2
    const startX = center.x
    const startY = center.y

    const endX = target.x
    const endY = target.y

    const deltaX = endX - startX
    const deltaY = endY - startY

    let xSide, ySide

    if (deltaX < 0)
      xSide = -halfWidth
    else
      xSide = halfWidth

    if (deltaY < 0)
      ySide = -halfHeight
    else
      ySide = halfHeight

    if (Math.abs(deltaX) < 0.01)
      return { x: 0, y: ySide }

    if (Math.abs(deltaY) < 0.01)
      return { x: xSide, y: 0 }

    // now see if it intercepts the top/bottom, or the left/right
    const xRatio = xSide / deltaX
    const h = deltaY * xRatio

    if (Math.abs(h) <= Math.abs(ySide))
      return {
        x: xSide,
        y: h,
      }
      else
        return {
          x: deltaX / deltaY * ySide,
          y: ySide,
        }
  }


  toString() {
    const shapeAttrs = formatAttrs(this.params)
    return `${this.typeName}\t\tattrs: ${shapeAttrs}\n`
  }

  toNative() {
    return this
  }

  // A shape has no text of its own, so putting one in a string is a mistake
  override asText(): never {
    throw new RTE(`A string can't contain a shape, but this is ${this.nameForErrors()}`)
  }

  // a Box, an Arc
  override nameForErrors() {
    const name = this.typeName
    return `${/^[AEIOU]/.test(name) ? `an` : `a`} ${name}`
  }

  rememberRenderNeeded(moved = false) {
    this.renderNeeded = true
    this.hasMoved = moved
  }

  needsRendering() {
    return this.renderNeeded
  }

  moved() {
    return this.hasMoved
  }

  // this has to be an AST tree, because we need to evaluate it dynamically 
  // should the parent move
  createOverlappingWithConstraint(): ProcessedWithConstraint {
    return {
      type: `ProcessedWithConstraint`,
      cardinal: `c`,
      targetAsShapeObject: this,
    }
  }
}

