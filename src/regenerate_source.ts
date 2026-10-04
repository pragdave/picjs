// Turns a syntax tree back into source, so that `??` can show what it is
// inspecting. The result is equivalent to the original rather than identical:
// abbreviations are spelled out, and nested arithmetic is bracketed.

import { Visitor } from "./visitor.js"
import * as AST from "./ast.js"
import { XY } from "./position.js"

export class RegenerateSource extends Visitor {

  convert(tree: AST.Node): string {
    return this.start(tree) ?? ``
  }

  // This is only for display, so a node with no rule here is shown by its type
  // rather than failing the `??` that asked for it
  override accept(tree: AST.Node): string {
    if (!(`Visit${tree.type}` in this))
      return `«${tree.type}»`
    return super.accept(tree)
  }

  VisitArrayExpression(node: AST.ArrayExpression) {
    return `[${node.elements.map(e => this.accept(e)).join(`, `)}]`
  }

  VisitAssignment(node: AST.Assignment) {
    return `${this.accept(node.lvalue)} = ${this.accept(node.rvalue)}`
  }

  VisitBinaryExpression(node: AST.BinaryExpression) {
    return `${this.operand(node.left)} ${node.operator} ${this.operand(node.right)}`
  }

  VisitBoolean(node: AST.Boolean) {
    return node.value ? `true` : `false`
  }

  VisitColorDynamic(node: AST.ColorDynamic) {
    return `~#{${this.accept(node.expr)}}`
  }

  VisitColorLiteralString(node: AST.ColorLiteralString) {
    return node.spec.startsWith(`#`) ? node.spec : `~${node.spec}`
  }

  VisitColorLiteralWithModel(node: AST.ColorLiteralWithModel) {
    return `${node.model}(${node.params.map(p => this.accept(p)).join(`, `)})`
  }

  VisitExpressionList(node: AST.ExpressionList) {
    return this.statements(node.body)
  }

  VisitFaceAngle(node: AST.FaceAngle) {
    return `Face ${this.accept(node.angle)}`
  }

  VisitFaceCardinalDirection(node: AST.FaceCardinalDirection) {
    return `Face ${directionName(node.direction)}`
  }

  VisitFunctionExpression(node: AST.FunctionExpression) {
    const params = node.params.map(p => this.accept(p)).join(`, `)
    const body = node.body.type === `ExpressionList` ? this.block(node.body) : this.accept(node.body)
    return `(${params}) => ${body}`
  }

  VisitGetTime(_node: AST.GetTime) {
    return `@`
  }

  VisitIdentifier(node: AST.Identifier) {
    return node.name
  }

  VisitIfExpression(node: AST.IfExpression) {
    const ifPart = `if (${this.accept(node.test)}) ${this.block(node.consequent)}`
    return node.alternate ? `${ifPart} else ${this.block(node.alternate)}` : ifPart
  }

  VisitInspect(node: AST.Inspect) {
    return `?? ${this.accept(node.value)}`
  }

  VisitInterpolatedString(node: AST.InterpolatedString) {
    const parts = node.parts.map(part =>
      part.type === `String` ? (part as AST.String).value : `#{${this.accept(part)}}`)
    return `"${parts.join(``)}"`
  }

  VisitLayoutGap(node: AST.LayoutGap) {
    if (node.same) return `Gap same`
    return [ `Gap`, node.direction && directionName(node.direction), node.distance && this.accept(node.distance) ]
      .filter(Boolean).join(` `)
  }

  VisitLayoutGoto(node: AST.LayoutGoto) {
    if (node.place) return `Goto ${this.accept(node.place)}`
    return [ `Goto`, node.direction && directionName(node.direction), node.distance && this.accept(node.distance) ]
      .filter(Boolean).join(` `)
  }

  VisitNumber(node: AST.Number) {
    return node.value.toString()
  }

  VisitPosition(node: AST.Position) {
    return `(${this.accept(node.x)}, ${this.accept(node.y)})`
  }

  VisitProgram(node: AST.Program) {
    return this.accept(node.body)
  }

  VisitQualifiedLValue(node: AST.QualifiedLValue) {
    return this.qualified(node.left, node.right)
  }

  VisitQualifiedRValue(node: AST.QualifiedRValue) {
    return this.qualified(node.left, node.right)
  }

  VisitRange(node: AST.Range) {
    return `[${this.accept(node.start)}..${this.accept(node.end)}]`
  }

  VisitShape(node: AST.Shape) {
    const {
      label, _shapeLabels, _labels, _start, _end, _waypoints, _closed, _rotationCenter,
      _behind, _same, _class, line_start, line_end, line_path, ...attributes
    } = node.args

    const labels = [ ...(label ? [label] : []), ...(_shapeLabels ?? []) ]
      .map(l => this.accept(l.args.text as AST.Node))
    const lineLabels = (_labels ?? []).map(l => this.accept(l.text))
    const text = node.shape === `SLabel` ? attributes.text : undefined
    delete attributes.text

    const path = line_path && (line_path as AST.String).value
    const arrow = (line_start || line_end)
      ? `${(line_start as AST.String)?.value ?? ``}${path === `smooth` ? `~` : `-`}${(line_end as AST.String)?.value ?? ``}`
      : (path && path !== `straight` ? path : undefined)

    const constraint = node.withConstraint?.type === `WithConstraint` ? node.withConstraint : undefined

    return [
      ShapeNames[node.shape] ?? node.shape.replace(/^S/, ``),
      _class,
      arrow,
      _start && `from ${this.accept(_start)}`,
      ...(_waypoints ?? []).map(w => `then ${this.accept(w)}`),
      _end && `to ${this.accept(_end)}`,
      _closed && `close`,
      text && this.accept(text as AST.Node),
      ...labels,
      ...lineLabels,
      ...Object.entries(attributes).map(([name, value]) => `${name} ${this.accept(value as AST.Node)}`),
      _rotationCenter && `about ${this.accept(_rotationCenter)}`,
      _behind && `behind ${this.accept(_behind)}`,
      _same && `same`,
      constraint && `with .${constraint.cardinal} at ${this.accept(constraint.place)}`,
    ].filter(Boolean).join(` `)
  }

  VisitShapeDefaultGetter(node: AST.ShapeDefaultGetter) {
    return `${node.shape}.${node.attr}`
  }

  VisitShapeDefaultSetter(node: AST.ShapeDefaultSetter) {
    return `${node.shape}.${node.attr} = ${this.accept(node.value)}`
  }

  VisitShapeReference(node: AST.ShapeReference) {
    const shape = node.shape === `SBase` ? `Shape` : node.shape.slice(1)
    if (node.fromEnd)
      return node.position === 1 ? `last ${shape}` : `${ordinal(node.position)} last ${shape}`
    return `${ordinal(node.position)} ${shape}`
  }

  VisitString(node: AST.String) {
    return `"${node.value}"`
  }

  VisitUnaryExpression(node: AST.UnaryExpression) {
    return `${node.operator}${this.operand(node.argument)}`
  }

  VisitVariableValue(node: AST.VariableValue) {
    return node.name
  }

  // helpers

  private qualified(left: AST.Node, qualifier: AST.Qualifier) {
    const lv = this.accept(left)
    switch (qualifier.qtype) {
      case `attr`:  return `${lv}.${this.accept(qualifier.qvalue)}`
      case `call`:  return `${lv}(${qualifier.qvalue.map(arg => this.accept(arg)).join(`, `)})`
      case `index`: return `${lv}[${this.accept(qualifier.qvalue)}]`
      default:
        throw new Error(`Unknown qualifier type "${(qualifier as AST.Qualifier).qtype}"`)
    }
  }

  // An operand, bracketed if it is itself an operation
  private operand(node: AST.Node) {
    const source = this.accept(node)
    return node.type === `BinaryExpression` ? `(${source})` : source
  }

  private block(node: AST.Node) {
    const statements = node.type === `ExpressionList` ? node.body : [node]
    if (statements.length === 1)
      return `{ ${this.accept(statements[0])} }`
    return `{\n${statements.map(s => `  ${this.accept(s)}`).join(`\n`)}\n}`
  }

  private statements(list: AST.Node[]) {
    return list.map(statement => this.accept(statement)).join(`\n`)
  }
}

// The shape names that aren't just the class name without its S
const ShapeNames: Record<string, string> = {
  SPolyline: `Line`,
  SBase: `Shape`,
}

// The name of a direction such as { x: -1, y: -1 }: nw
function directionName(v: XY) {
  return (v.y < 0 ? `n` : v.y > 0 ? `s` : ``) + (v.x < 0 ? `w` : v.x > 0 ? `e` : ``)
}

// 1st, 2nd, 3rd, 4th, ..., 11th, 12th, 13th, ..., 21st
export function ordinal(n: number) {
  const suffix = (n % 100 >= 11 && n % 100 <= 13) ? `th` : ([`th`, `st`, `nd`, `rd`][n % 10] ?? `th`)
  return `${n}${suffix}`
}
