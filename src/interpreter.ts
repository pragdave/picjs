import { RTE } from "./runtime_error.js"
import { Defaults } from "./defaults.js"
import { Binding } from "./binding.js"
import * as Shapes from "./shapes.js"
import { MoveToAnimator, MoveByAnimator, createAttributeAnimator, RotateAnimator, DrawAnimator, SetVariableAnimator } from "./animations.js"
import { Visitor } from "./visitor.js"
import { Cardinals, CardinalVectors, XY } from "./position.js"
import { Dispatcher } from "./dispatcher.js"
import  * as AST from "./ast.js"

import {
  type TA,
  type BinaryOperatorMethod,
  TBase,
  TInterpolatable,
  TBool,
  TColor,
  TFont,
  TFunction,
  TList,
  TNative,
  TNumber,
  TPosition,
  TRange,
  TString,
  TTimeline,
} from "./types.js"

import { SGroup } from "./shapes/sgroup.js"
import { isKnownAttribute, acceptedAttributesFor } from "./shapes/attributes.js"

import { RegenerateSource, ordinal } from "./regenerate_source.js"
import type { ShapeParams } from "./shapes/_base.js"
import { numberArgument } from "./types/arguments.js"


const BinOps: { [op: string]: BinaryOperatorMethod } = {
  "+": `opPlus`,
  "-": `opMinus`,
  "*": `opTimes`,
  "/": `opDivide`,
  "%": `opModulo`,
  "^": `opPow`,

  "==": `opEqual_to`,
  "!=": `opNot_equal_to`,
  "<":  `opLess_than`,
  "<=": `opLess_than_or_equal_to`,
  ">":  `opGreater_than_than`,
  ">=": `opGreater_than_than_or_equal_to`,
}

function undefinedbinop(op: string): never   {
  throw new Error(`internal error: undefined operator ${op}`)
}


//////////////////////////////////////////////////////////////////////
//
export class Interpreter extends Visitor{

  binding: Binding
  cssPrefix: string

  // Re-evaluating a shape's arguments mustn't make a shape again: it gets the
  // one this syntax tree node last made
  private lastShapeMadeBy = new WeakMap<AST.Shape, Shapes.SBase>()
  stylesheets: string[]

  constructor(
    public dispatcher: Dispatcher, 
    public runNumber: number
  ) {
    super()
    this.binding = new Binding()
    // Before anything makes a shape: the geometry makes one as it starts
    this.binding.bulkSetDefaults(Defaults)
    this.stylesheets = []
    this.cssPrefix = `_myopic-${runNumber}`
  }

  dispatcherIsReady() {
    if (this.binding.isToplevel()) {
      this.binding.set_variable(`@`, new TTimeline(this.dispatcher.getTimeline()))
      this.binding.addBuiltinFunctions()
    }
  }

  getAllDefaultAttributes(category: string, base: string, klass: string) {
    return this.binding.getAllDefaultAttributes(category, base, klass)
  }

  getCurrentBinding() {
    return this.binding
  }

  // Interpreters nest (re-evaluating a shape's arguments runs one), so an
  // error ripples up through each, and each adds a frame to its backtrace
  override start(tree: AST.Node) {
    try {
      return super.start(tree)
    }
    catch (e) {
      const loc = this.lastLocation
      if ((e instanceof RTE) && loc) {
        e.context ??= []
        e.context.push({ loc, interpreter: this })
      }
      throw e
    }
  }

  VisitArrayExpression(node: AST.ArrayExpression) {
    return new TList(node.elements.map((n: AST.Node) => this.accept(n)))
  }

  VisitAssignment(node: AST.Assignment) {
    const rv = this.accept(node.rvalue)
    if (node.lvalue.type === `Identifier`) {
      this.binding.set_variable(this.accept(node.lvalue), rv)
    }

    else if (node.lvalue.type  === `QualifiedLValue`) {
      // left is the expression excluding the last qualifier

      const lvalue = this.accept((node.lvalue as AST.QualifiedLValue).left)
      const last = (node.lvalue as AST.QualifiedLValue).right

      switch (last.qtype) {
        case `attr`:
          lvalue.setAtAttr(this.accept(last.qvalue), rv)
          break
        case `index`:
          lvalue.setAtIndex(this.accept(last.qvalue), rv)
          break
        default:
          throw new RTE(`The left hand side of an expression cannot end with a ${last.qtype}`)
      }
    }

    else {
      throw new RTE(`The left hand side of an assignment can only be a variable ` +
                    `with an optional list of attributes, indexes, or calls `)
    }
    return rv
  }

  VisitBinaryExpression(node: AST.BinaryExpression) {
    const op = node.operator

    // && and || short-circuit, so they cannot go through the table below —
    // that evaluates both sides first, and evaluating an expression in picjs
    // can have side effects (creating shapes, assigning variables).
    if (op === `&&` || op === `||`)
      return this.shortCircuit(node, op)

    const lv = this.accept(node.left)
    const rv = this.accept(node.right)
    const fn = BinOps[op] || undefinedbinop(op)
    return lv[fn](rv)
  }

  // `&&` and `||` take boolean operands only and yield a boolean. The right
  // side is evaluated only when the left does not already decide the result.
  private shortCircuit(node: AST.BinaryExpression, op: string) {
    const left = this.booleanOperand(this.accept(node.left), op)

    if (op === `&&` && !left) return new TBool(false)
    if (op === `||` && left)  return new TBool(true)

    return new TBool(this.booleanOperand(this.accept(node.right), op))
  }

  private booleanOperand(value: TA, op: string): boolean {
    if (value instanceof TBool)
      return value.value
    throw new RTE(
      `"${op}" needs boolean operands, but was given ${value.nameForErrors()}`
    )
  }

  VisitBlockStatement(node: AST.ExpressionList) {
    return this.visitListOfStatements(node.body)
  }

  VisitBoolean(node: AST.Boolean) {
    return new TBool(node.value)
  }

  VisitColorDynamic(node: AST.ColorDynamic) {
    const name = this.accept(node.expr)
    return TColor.fromString(name.toString())
  }

  VisitColorLiteralString(node: AST.ColorLiteralString) {
    return TColor.fromString(node.spec)
  }

  VisitColorLiteralWithModel(node: AST.ColorLiteralWithModel) {
    const args = node.params.map((n: AST.Node, i) =>
      numberArgument(node.model, `${ordinal(i + 1)} value`, this.accept(n)))
    return TColor.fromColorModel(node.model, args)
  }

  // VisitDirectiveStyle(node: AST.Node) {
  //   this.stylesheets.push(addCssPrefix(node.style, this.cssPrefix))
  //   return new TString(node.style)
  // }

  VisitFaceAngle(node: AST.FaceAngle) {
    const angle = this.accept(node.angle)
    if (angle instanceof TNumber)
      this.dispatcher.setDirectionFromAngle(angle.toNative())
    else if (angle instanceof TString) {
      const unitVector = CardinalVectors[angle.value as Cardinals]
      if (unitVector)
        this.dispatcher.setDefaultDirection(unitVector)
      else
        throw new RTE(`"${node.angle}" is not a cardinal direction. Should be nw, n, ne, …`)
    }
    else
      throw new RTE(`"Face" takes either a cardinal direction (n, sw, …) or an angle`)
  }

  VisitFaceCardinalDirection(node: AST.FaceCardinalDirection) {
    this.dispatcher.setDefaultDirection(node.direction)
  }

  private lastGap: { direction: XY, distance: number } | null = null

  // Gap: invisible line — exits last shape's edge, next shape's entry edge starts there
  VisitLayoutGap(node: AST.LayoutGap) {
    let direction: XY
    let distance: number

    if (node.same && this.lastGap) {
      direction = this.lastGap.direction
      distance = this.lastGap.distance
    } else {
      direction = node.direction ?? this.dispatcher.getDirection()
      distance = 1
      if (node.distance) {
        const d = this.accept(node.distance)
        distance = d.toNative()
      }
    }

    if (node.direction) {
      this.dispatcher.setDefaultDirection(node.direction)
    }

    this.lastGap = { direction, distance }

    // Start from exit edge of last shape
    const lastShape = this.dispatcher.getLastShape()
    let startX: number, startY: number

    if (lastShape.width === 0 && lastShape.height === 0) {
      startX = lastShape.anchor.x
      startY = lastShape.anchor.y
    } else {
      const c = lastShape.c
      const projection = { x: c.x + direction.x, y: c.y + direction.y }
      const exitPoint = lastShape.cropLineTo(null, projection)
      startX = exitPoint.x
      startY = exitPoint.y
    }

    const at = {
      x: startX + direction.x * distance,
      y: startY + direction.y * distance,
    }

    const shape = this.dispatcher.addShape('SPoint', undefined, { at })
    shape.visible = false
    shape.layoutAsEdge = true  // next shape aligns by entry edge, not center
    this.addShapeToGeometry(shape)
    return shape
  }

  // Goto: position cursor; next shape centers there
  VisitLayoutGoto(node: AST.LayoutGoto) {
    // `Goto <place>` and `Goto <distance>` are the same expression to the
    // grammar, so a bare number arrives here as a place. Only its value tells
    // the two apart.
    const placeValue = node.place ? this.accept(node.place) : null

    if (placeValue instanceof Shapes.SBase) {
      this.dispatcher.setLastShape(placeValue)
      return placeValue
    }

    if (placeValue !== null && !(placeValue instanceof TNumber)) {
      return this.gotoPoint(placeValue.toNative())
    }

    const direction = node.direction ?? this.dispatcher.getDirection()

    const distance = (placeValue instanceof TNumber) ? placeValue.toNative()
                   : node.distance                   ? this.accept(node.distance).toNative()
                   :                                   1

    if (node.direction) {
      this.dispatcher.setDefaultDirection(node.direction)
    }

    const last = this.dispatcher.getLastShape().c
    return this.gotoPoint({
      x: last.x + direction.x * distance,
      y: last.y + direction.y * distance,
    })
  }

  // Move the layout position without drawing anything.
  private gotoPoint(at: XY) {
    const shape = this.dispatcher.addShape('SPoint', undefined, { at })
    shape.visible = false
    this.addShapeToGeometry(shape)
    return shape
  }

  VisitFont(node: AST.Font) {   // this is for literal CSS-style font specs
    return new TFont(node.spec)
  }

  VisitFunctionExpression(node: AST.FunctionExpression) {
    return new TFunction(node.params, node.body, this.binding)
  }

  VisitGetTime(_node: AST.GetTime) {
    return new TNumber(this.dispatcher.currentRecordingTime())
  }

  VisitAside(node: AST.Aside) {
    const savedLastShape = this.dispatcher.getLastShape()
    const savedDirection = this.dispatcher.getDirection()
    this.dispatcher.asideDepth++
    const result = this.accept(node.body)
    this.dispatcher.asideDepth--
    this.dispatcher.setLastShape(savedLastShape)
    this.dispatcher.restoreDirection(savedDirection)
    return result
  }

  VisitGroup(node: AST.Group) {
    // 1. Push binding scope (scopes defaults and variables)
    const outerBinding = this.binding
    this.binding = this.binding.push()

    // 2. Save geometry state
    const savedDirection = this.dispatcher.getDirection()
    const predecessorShape = this.dispatcher.getLastShape()

    // 3. Track shapes created before the body
    const shapesBefore = this.dispatcher.shapes().length

    // 4. Bind `self` so the body can export attributes via self.name = value
    const selfCollector = new TBase(null)
    selfCollector.toNative = () => selfCollector
    selfCollector.toString = () => `<self>`
    this.binding.set_local_variable(`self`, selfCollector)

    // 5. Execute body
    const autolayoutBefore = this.dispatcher.getAutolayoutCount()
    this.accept(node.body)
    const bodyUsedAutolayout = this.dispatcher.getAutolayoutCount() > autolayoutBefore

    // 6. Collect shapes created by the body
    const allShapes = this.dispatcher.shapes()
    const newShapes = allShapes.slice(shapesBefore)

    // 7. Pop binding scope (before creating group shape, so it lives in outer scope)
    this.binding = outerBinding

    // 8. Evaluate group attributes (opacity, etc.)
    const groupArgs: ShapeParams = {}
    const behindAST = node.args?._behind
    if (node.args) {
      const argsForEval = { ...node.args }
      delete argsForEval._behind
      Object.assign(groupArgs, this.visit_object(argsForEval))
    }

    // 9. Create the SGroup shape
    const group = this.dispatcher.addShape(
      'SGroup',
      undefined,
      groupArgs,
      node.withConstraint,
    ) as SGroup

    // 10. Register group children and compute bounding box
    for (const child of newShapes) {
      group.groupChildren.push(child)
    }

    // 11. Copy self-assigned attributes to the group
    Object.assign(group.attrs, selfCollector.attrs)

    group.computeBoundingBox()
    group.predecessorShape = predecessorShape
    group.needsFlowLayout = bodyUsedAutolayout

    // Register children as depending on the group so dirty propagation works
    for (const child of group.groupChildren) {
      this.dispatcher.recordDependency(child, group)
    }

    // 12. Handle behind constraint
    if (behindAST) {
      const target = this.accept(behindAST)
      if (!(target instanceof Shapes.SBase))
        throw new RTE(`"behind" expects a shape, but got ${target}`)
      group.behind = target
    }

    // 13. Restore direction before positioning so the group flows correctly
    this.dispatcher.restoreDirection(savedDirection)

    // 14. Position and add to timeline
    this.addShapeToGeometry(group)
    this.addCreateShapeToTimeline(group)

    return group
  }

  VisitIdentifier(node: AST.Identifier) {
    return node.name
  }

  VisitIfExpression(node: AST.IfExpression) {
    const pred = this.accept(node.test)
    if (pred.isTrue()) {
      return this.accept(node.consequent)
    }
    return this.accept(node.alternate)
  }

  VisitInspect(node: AST.Inspect) {
    const result = this.accept(node.value)
    const loc = this.lastLocation
    if (node.value.type === "String") {
      this.dispatcher.log(loc, (node.value as AST.String).value)
    }
    else {
      const src = new RegenerateSource().convert(node.value)
      this.dispatcher.log(loc, result.toString(), src)
    }
    return result
  }

  VisitMoveTo(node: AST.MoveTo) {
    const { shape, cardinal } = this.moveTarget(node.what)

    const mover = new MoveToAnimator(
      shape,
      cardinal,
      this.accept(node.place), 
      this.visit_object(node.params)
    )
    this.dispatcher.addAnimation(mover)
    return shape
  }

  VisitMoveBy(node: AST.MoveBy) {
    const { shape } = this.moveTarget(node.what)

    const distance = this.accept(node.distance).toNative()
    const dx = node.direction.x * distance
    const dy = node.direction.y * distance

    const mover = new MoveByAnimator(
      shape,
      dx,
      dy,
      this.visit_object(node.params)
    )
    this.dispatcher.addAnimation(mover)
    return shape
  }

  // What `move` moves: a whole shape, or one of its points (`a.nw`). The
  // point is named by an lvalue rather than evaluated, which is less
  // consistent than the rest of the language, but reads more naturally than
  // something like `move a so that .s is at (1, 2)`.
  private moveTarget(what: AST.Node): { shape: Shapes.SBase, cardinal: Cardinals } {
    let shape, cardinal = `c`

    if (isWholeShape(what)) {
      shape = this.accept(what)
    }
    else if (what.type === `QualifiedLValue` && what.right.qtype === `attr`) {
      shape = this.accept(what.left)
      cardinal = this.accept(what.right.qvalue)
      if (!Shapes.CardinalAttributes.has(cardinal))
        throw new RTE(`"${cardinal}" is not a point on the shape: use one of ${[...Shapes.CardinalAttributes].join(`, `)}`)
    }

    if (!(shape instanceof Shapes.SBase))
      throw new RTE(`"move" needs a shape, or a point on one such as a.nw`)

    return { shape, cardinal: cardinal as Cardinals }
  }

  VisitNumber(node: AST.Number) {
    return new TNumber(node.value)
  }

  VisitPosition(node: AST.Position) {
    const result =  new TPosition(this.accept(node.x), this.accept(node.y))
    return result
  }

  // VisitPositionValue(node: AST.PositionValue) {
  //   const pos = this.accept(node.position)
  //   return pos
  // }

  VisitDraw(node: AST.Draw) {
    const shape = this.accept(node.what)
    if (!(shape instanceof Shapes.SBase)) {
      throw new RTE(`The first argument to "draw" should be a shape value`)
    }
    const animator = new DrawAnimator(
      shape,
      this.visit_object(node.params)
    )
    this.dispatcher.addAnimation(animator)
    return shape
  }

  VisitExpressionList(node: AST.ExpressionList) {
    return this.visitListOfStatements(node.body)
  }

  VisitProgram(node: AST.Program) {
    return this.accept(node.body)
  }

  // A qualified lvalue that is evaluated rather than assigned to (the `a.b`
  // in `a.b.c = 1`) means the same as the rvalue. VisitAssignment deals with
  // the qualifier that is assigned to.
  VisitQualifiedLValue(node: AST.QualifiedLValue) {
    return this.applyQualifier(this.accept(node.left), node.right)
  }

  VisitQualifiedRValue(node: AST.QualifiedRValue) {
    return this.applyQualifier(this.accept(node.left), node.right)
  }

  private applyQualifier(value: TA, qualifier: AST.Qualifier) {
    switch (qualifier.qtype) {
      case `attr`:  return value.getAtAttr(this.accept(qualifier.qvalue))
      case `call`:  return this.callFunction(value, qualifier.qvalue.map(arg => this.accept(arg)))
      case `index`: return value.getAtIndex(this.accept(qualifier.qvalue))
      default:
        throw new Error(`Unknown qualifier type "${(qualifier as AST.Qualifier).qtype}"`)
    }
  }

  VisitRange(node: AST.Range) {
    const start = this.accept(node.start)
    const end   = this.accept(node.end)

    if (start.isSameTypeAs(end)) {
      if (start instanceof TInterpolatable) {
        return new TRange(start, end)
      }
      throw new RTE(`the limits of a range must be interpolatable (numbers, colors, ...)`)
    }

    throw new RTE(`the start and end of a range must be the same type`)
  }


  VisitRotate(node: AST.Rotate) {
    const what = this.accept(node.what)
    if (!(what instanceof Shapes.SBase)) {
      throw new RTE(`The first argument to "rotate" should be a shape value`)
    }
    const angle = this.accept(node.angle)
    const about = this.accept(node.about)
    const rotater = new RotateAnimator(
      what,
      angle,
      about,
      this.visit_object(node.params)
    )

    this.dispatcher.addAnimation(rotater)
    return what
  }

  VisitSet(node: AST.Set) {
    const what = node.what

    if (what.type === `Identifier`) {
      const varName = what.name
      const value = this.accept(node.value)
      const animator = new SetVariableAnimator(this.binding, this.dispatcher, varName, value)
      this.dispatcher.addAnimation(animator)
      return value
    }

    if (what.type !== `QualifiedLValue`)
      throw new RTE(`The first argument to "set" should be a variable name or "shape.attribute"`)

    if (what.right.qtype !== `attr`)
      throw new RTE(`You can only set a shape's attribute`)

    const setter = createAttributeAnimator(
      this.accept(what.left),
      this.accept(what.right.qvalue),
      this.accept(node.value),
      this.visit_object(node.params)
    )
    this.dispatcher.addAnimation(setter)
    return this.accept(what.left)
  }

  VisitSetTime(_node: AST.Node) {
    this.dispatcher.setRecordingTime(`now`)
    return new TNumber(this.dispatcher.currentRecordingTime())
  }

  VisitPause(node: AST.Pause) {
    const message = node.message ? String(this.accept(node.message)) : null
    this.dispatcher.addPause(message)
    return new TNumber(0)
  }


  VisitShape(node: AST.Shape) {
    const memoized = this.lastShapeMadeBy.get(node)
    if (this.dispatcher.isReEvaluating && memoized)
      return memoized

    const { label, _shapeLabels: shapeLabels, _labels: lineLabels, _behind: behindAST, _same: hasSame } = node.args

    // Work on a copy to avoid mutating the shared AST (breaks when functions
    // call the same shape node multiple times).
    const argsForEval = { ...node.args }
    delete argsForEval.label
    delete argsForEval._shapeLabels
    delete argsForEval._labels
    delete argsForEval._behind
    delete argsForEval._same

    let evaluatedArgs = this.visit_object(argsForEval)

    if (hasSame) {
      const prev = this.dispatcher.findLastShapeOfType(node.shape)
      if (prev) {
        evaluatedArgs = { ...prev.params, ...evaluatedArgs }
      }
    }

    const shape = this.dispatcher.addShape(
      node.shape,
      argsForEval,                 // clean copy for re-evaluation (label/behind/same stripped)
      evaluatedArgs,
      node.withConstraint,   // defer evaluation
    )

    if (behindAST) {
      const target = this.accept(behindAST)
      if (!(target instanceof Shapes.SBase))
        throw new RTE(`"behind" expects a shape, but got ${target}`)
      shape.behind = target
    }

    // position it
    this.addShapeToGeometry(shape)

    // and arrange for it to be created at @now
    this.addCreateShapeToTimeline(shape)

    // Handle single label (for non-line shapes)
    if (label) {
      const child = shape.setupChildWithConstraint(label)
      const slabel = this.dispatcher.addShape(
        child.shape,
        child.args,
        this.visit_object(child.args),
        child.withConstraint
      )
      // Mark as child BEFORE adding to geometry so it doesn't become lastShape
      shape.addChild(slabel)
      this.addShapeToGeometry(slabel)
      this.addCreateShapeToTimeline(slabel)
    }

    // Handle multiple labels (stacked vertically, centered)
    if (shapeLabels && shapeLabels.length > 0) {
      this.createStackedLabels(shape, shapeLabels)
    }

    // Size to the labels once they all exist. Line labels are excluded: they
    // sit along the path rather than inside the shape.
    this.fitShapeToLabels(shape)

    // Handle line labels with above/below positioning
    if (lineLabels && lineLabels.length > 0) {
      this.createLineLabels(shape, lineLabels)
    }

    this.lastShapeMadeBy.set(node, shape)
    return shape
  }

  // `fit` sizes a shape to its labels, shrinking as well as growing. The size
  // is derived from all the labels every time rather than accumulated: growing
  // only would never shrink, and using just the latest label would let the last
  // one win instead of the widest.
  private fitShapeToLabels(shape: Shapes.SBase) {
    if (!shape.params.fit || shape.children.length === 0)
      return

    let width = 0
    let height = 0

    for (const child of shape.children) {
      const padding = Number(child.params.font_size) || 0.14
      width  = Math.max(width,  (Number(child.width)  || 0) + padding * 2)
      height = Math.max(height, (Number(child.height) || 0) + padding * 2)
    }

    shape.params.width  = width
    shape.params.height = height
  }

  // Check if a label AST has any styling attributes beyond just text
  private labelHasStyling(labelArgs: AST.ShapeArgs): boolean {
    const stylingKeys = Object.keys(labelArgs).filter(k => k !== 'text' && !k.startsWith('_'))
    return stylingKeys.length > 0
  }

  // Create labels from multiple label ASTs, stacking them vertically
  private createStackedLabels(parent: Shapes.SBase, labels: AST.Shape[]) {
    // Check if any label has custom styling - if so, create separate labels
    const hasCustomStyling = labels.some(label => this.labelHasStyling(label.args))

    if (hasCustomStyling) {
      this.createSeparateLabels(parent, labels)
    } else {
      this.createCombinedLabel(parent, labels)
    }
  }

  // Create separate label children when styling differs between labels
  private createSeparateLabels(parent: Shapes.SBase, labels: AST.Shape[]) {
    const totalLabels = labels.length
    const fontSize = 0.14  // default font size
    const lineHeight = fontSize * 1.2
    const totalHeight = totalLabels * lineHeight
    const startY = -(totalHeight / 2) + (lineHeight / 2)

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]
      const evaluated = this.visit_object(label.args)
      const yOffset = startY + i * lineHeight

      const child = parent.setupChildWithConstraint(label)
      const slabel = this.dispatcher.addShape(
        child.shape,
        child.args,
        evaluated,
        child.withConstraint
      )
      // Apply vertical offset for stacking
      slabel.params._stackOffset = yOffset
      parent.addChild(slabel)
      this.addShapeToGeometry(slabel)
      this.addCreateShapeToTimeline(slabel)
    }
  }

  // Create a single combined label when all labels have the same (default) styling
  private createCombinedLabel(parent: Shapes.SBase, labels: AST.Shape[]) {
    // Evaluate each label's text
    const texts: string[] = []
    let firstEvaluatedArgs: ShapeParams | null = null

    for (const label of labels) {
      const evaluated = this.visit_object(label.args)
      texts.push(String(evaluated.text))
      if (!firstEvaluatedArgs) firstEvaluatedArgs = evaluated
    }

    // Build a single label with joined text, using first label's styling
    // Use double-newline so each label is a separate paragraph (won't be reflowed to a single line)
    const joinedText = texts.join('\n\n')
    const evaluatedArgs = { ...firstEvaluatedArgs!, text: joinedText }

    // AST node for re-evaluation (e.g., during animation)
    const combinedAst: AST.Shape = {
      type: `Shape`,
      shape: `SLabel`,
      args: { ...labels[0].args },
    }

    const child = parent.setupChildWithConstraint(combinedAst)
    const slabel = this.dispatcher.addShape(
      child.shape,
      child.args,
      evaluatedArgs,
      child.withConstraint
    )
    parent.addChild(slabel)
    this.addShapeToGeometry(slabel)
    this.addCreateShapeToTimeline(slabel)

  }

  // Create labels for lines/arcs with path-based positioning
  private createLineLabels(line: Shapes.SBase, labels: AST.LineLabel[]) {
    // Resolve default sides for labels without explicit positioning
    const resolvedLabels = this.resolveLineLabelSides(labels)

    for (const labelDef of resolvedLabels) {
      // Create the label AST node, merging any rich label attrs (font, align, etc.)
      const args: AST.ShapeArgs = { text: labelDef.text }
      if (labelDef._labelArgs) {
        Object.assign(args, labelDef._labelArgs)
      }
      const labelAst: AST.Shape = {
        type: `Shape`,
        shape: `SLabel`,
        args,
      }

      // Setup constraint with path percent and side
      const child = line.setupLineLabelConstraint(labelAst, labelDef.pathPercent, labelDef.side)
      const slabel = this.dispatcher.addShape(
        child.shape,
        child.args,
        this.visit_object(child.args),
        child.withConstraint
      )

      line.addChild(slabel)
      this.addShapeToGeometry(slabel)
      this.addCreateShapeToTimeline(slabel)
    }
  }

  // Resolve default sides for labels:
  // - 1 label with no side: center (or outside for arcs)
  // - 2 labels with no sides: above/below
  // - explicit sides are preserved
  private resolveLineLabelSides(labels: AST.LineLabel[]): (AST.LineLabel & { side: string })[] {
    const n = labels.length

    if (n === 1 && !labels[0].side) {
      return [{ ...labels[0], side: `above` }]
    }

    if (n === 2 && !labels[0].side && !labels[1].side) {
      return [
        { ...labels[0], side: `above` },
        { ...labels[1], side: `below` },
      ]
    }

    return labels.map(l => ({ ...l, side: l.side || `center` }))
  }

  // Map user-facing attribute names to the internal names used by renderers.
  // This must match the mappings in the PEG grammar's inline shape args.
  // A default setter takes its attribute name from the grammar's AttrName rule,
  // which returns the text the user typed — so `Box.wid = 3` arrives as `wid`.
  // Inline attributes do not have this problem, because there the matching
  // rule's own return value is used. Documented abbreviations must therefore be
  // resolved here, or the default is stored under a name nothing ever reads.
  static readonly DefaultAttrAliases: Record<string, string[]> = {
    thickness: [ `stroke_width` ],
    thick:     [ `stroke_width` ],
    wid:       [ `width` ],
    ht:        [ `height` ],
    rot:       [ `rotation` ],
    len:       [ `length` ],
    pad:       [ `padding` ],
  }

  // `radius` is not one attribute: a circle has a single radius, everything
  // else has a pair of corner radii.
  static readonly RadiusAliases: Record<string, string[]> = {
    SCircle: [ `r` ],
  }

  private defaultAttrNames(shape: string, attr: string): string[] {
    if (attr === `radius` || attr === `rad`)
      return Interpreter.RadiusAliases[shape] ?? [ `rx`, `ry` ]

    return Interpreter.DefaultAttrAliases[attr] ?? [ attr ]
  }

  // The user writes `Line` for both straight lines and polylines,
  // so defaults set on SLine should also apply to SPolyline.
  static readonly DefaultShapeAliases: Record<string, string[]> = {
    SLine: [`SLine`, `SPolyline`],
  }

  VisitShapeReference(node: AST.ShapeReference) {
    const shapes = this.dispatcher.shapesOfKindDrawnSoFar(node.shape)
    const index = node.fromEnd ? shapes.length - node.position : node.position - 1
    if (index < 0 || index >= shapes.length)
      throw new RTE(shapeReferenceError(node, shapes.length))

    // A shape positioned relative to this one must follow it when it moves
    const shape = shapes[index]
    const dependent = this.dispatcher.currentEvaluatingShape
    if (dependent) this.dispatcher.recordDependency(dependent, shape)
    return shape
  }

  VisitShapeDefaultGetter(node: AST.ShapeDefaultGetter) {
    const shape = (Interpreter.DefaultShapeAliases[node.shape] || [node.shape])[0]
    const attr = this.defaultAttrNames(shape, node.attr)[0]
    const defaults = this.binding.getAllDefaultAttributes(`Shapes`, shape, node.klass)
    const value = defaults[attr]
    if (value === undefined)
      throw new RTE(`${node.shape}.${node.attr} is not defined`)
    if (value instanceof TBase)
      return value
    if (typeof value === `number`)
      return new TNumber(value)
    if (typeof value === `string`)
      return value.startsWith(`#`) ? TColor.fromString(value) : new TString(value)
    return value
  }

  VisitShapeDefaultSetter(node: AST.ShapeDefaultSetter) {
    const value = this.accept(node.value)
    const shapes = Interpreter.DefaultShapeAliases[node.shape] || [node.shape]

    // Defaults bypass SBase.setupParams, so they need the same check: setting
    // `Box.align` would otherwise be stored and never looked at.
    //
    // A name may cover more than one shape — the user writes `Line` for both
    // lines and polylines — so the attribute need only be valid for one of
    // them. `Line.rx` rounds polyline corners; `Line.length` sets a line's
    // length. Neither is valid for both.
    const attrs = this.defaultAttrNames(shapes[0], node.attr)

    if (!attrs.every(a => shapes.some((s: string) => isKnownAttribute(s, a)))) {
      const name = shapes[0].replace(/^S/, ``)
      throw new RTE(
        `"${name}" has no attribute "${node.attr}". ` +
        `It accepts: ${acceptedAttributesFor(shapes[0]).join(`, `)}`
      )
    }

    // Shape params hold native values: built-in defaults are plain strings and
    // numbers, and inline attributes are converted by visit_object. Store user
    // defaults the same way, or consumers that expect a native value (such as
    // Palette.getForegroundFor, via a label's _parentFill) receive a TBase.
    const nativeValue = value instanceof TBase ? value.toNative() : value
    for (const shape of shapes) {
      for (const attr of attrs) {
        this.binding.setDefault(`Shapes`, shape, node.klass, attr, nativeValue)

        const slotKey = `_${attr}_slot`
        if (value instanceof TColor && value.paletteSlot) {
          this.binding.setDefault(`Shapes`, shape, node.klass, slotKey, value.paletteSlot)
        } else {
          this.binding.setDefault(`Shapes`, shape, node.klass, slotKey, undefined)
        }
      }
    }
    return value
  }

  VisitInterpolatedString(node: AST.InterpolatedString) {
    const result = node.parts.map(part => {
      const val = this.accept(part)
      return val.asText()
    }).join(``)
    return new TString(result)
  }

  VisitString(node: AST.String) {
    return new TString(node.value)
  }

  VisitUnaryExpression(node: AST.UnaryExpression) {
    const val = this.accept(node.argument)

    switch (node.operator) {
      case `+`:
        return val.opUnaryPlus()
      case `-`:
        return val.opUnaryMinus()
      case `!`:
        return val.opNot()
    }

    throw new Error(`Invalid unary operator "${node.operator}"`)
  }

  VisitVariableValue(node: AST.VariableValue) {
    const shape = this.dispatcher.currentEvaluatingShape
    if (shape) this.dispatcher.recordVariableDependency(shape, node.name)
    return this.binding.get_variable_value(node.name)
  }

  // VisitWait(node: AST.Wait) {
  //   const until = node.until
  //   const waiter = new WaitAnimator(
  //     until.type,
  //     node.signedOffset.sign,
  //     this.accept(node.signedOffset.offset),
  //   )
  //   this.timeline.addAnimator(waiter)
  //   return new TNumber(waiter.endTime)
  // }

  valueOf(tree: AST.Node, binding: Binding) {
    if (!binding)
      throw new Error(`Missing binding on call to valueOf`)
    const saveBinding = this.binding
    this.binding = binding
    const result = this.accept(tree)
    this.binding = saveBinding
    return result
  }

  evaluateArgs(astArgs: AST.ShapeArgs, binding: Binding): ShapeParams {
    const saveBinding = this.binding
    this.binding = binding
    const result = this.visit_object(astArgs)
    this.binding = saveBinding
    return result
  }


  addShapeToGeometry(shape: Shapes.SBase) {
    this.dispatcher.addShapeToGeometry(shape)
  }

  addCreateShapeToTimeline(shape: Shapes.SBase) {
    this.dispatcher.addCreateShapeToTimeline(shape)
  }


  callFunction(callee: TA, args: TA[]) {
    if (callee instanceof TFunction)
      return this.callUserFunction(callee, args)

    if (callee instanceof TNative) {
      callee.acceptableParameters(args)
      return callee.value(this, ...args)
    }

    throw new RTE(`You can only call a function, but this is ${callee?.toNative?.() ?? callee}`)
  }

  private callUserFunction(callee: TFunction, args: TA[]) {
    if (args.length < callee.formals.length) {
      throw new RTE(`function called with ${args.length} parameters, ` +
                    `but it takes ${callee.formals.length} parameter`)
    }

    const callersBinding = this.binding
    this.binding = callee.binding.push()
    try {
      callee.formals.forEach((name, i) => {
        this.binding.set_local_variable(name.name, args[i])
      })
      return this.accept(callee.body)
    }
    finally {
      this.binding = callersBinding
    }
  }

  // Evaluate each attribute's expression to a plain value; a palette color
  // brings its slot too. Entries starting with _ are kept as they are: some,
  // such as a line's ends, are evaluated later, by the geometry.
  visit_object(obj: AST.ShapeArgs | AST.Parameters): ShapeParams {
    const result: ShapeParams = {}
    for (const k of Object.keys(obj)) {
      if (k.startsWith(`_`))
        result[k] = obj[k]
      else {
        const value = this.accept(obj[k] as AST.Node)
        result[k] = value.toNative()
        if (value instanceof TColor && value.paletteSlot) {
          result[`_${k}_slot`] = value.paletteSlot
        }
      }
    }
    return result
  }

  visitListOfStatements(list: AST.Node[]) {
    return list.reduce((_, s) => this.accept(s), null)
  }

  bindingAsTable() {
    return this.binding.dumpAsTable()
  }
}


// `move` targets either a whole shape (a variable, or a reference such as
// `last box`) or one of its points (`a.nw`)
function isWholeShape(node: AST.Node) {
  return node.type === `VariableValue` || node.type === `ShapeReference`
}

const ShapeReferenceNouns: Record<string, string> = {
  SArc: `arc`, SBox: `box`, SCircle: `circle`, SEllipse: `ellipse`, SOval: `oval`,
  SLine: `line`, SLabel: `label`, SGroup: `group`, SBase: `shape`,
}

function plural(count: number, noun: string) {
  const s = noun.endsWith(`x`) ? `es` : `s`
  return count === 1 ? `1 ${noun}` : `${count} ${noun}${s}`
}

// e.g. `there is no 4th box: only 3 boxes have been drawn so far`
function shapeReferenceError(node: AST.ShapeReference, count: number) {
  const noun = ShapeReferenceNouns[node.shape] ?? `shape`
  const ref = node.fromEnd
    ? (node.position === 1 ? `last ${noun}` : `${ordinal(node.position)} last ${noun}`)
    : `${ordinal(node.position)} ${noun}`
  const drawn = count === 0
    ? `no ${plural(2, noun).slice(2)} have been drawn so far`
    : `only ${plural(count, noun)} ${count === 1 ? `has` : `have`} been drawn so far`
  return `there is no ${ref}: ${drawn}`
}
