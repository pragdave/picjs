import { Location } from "./location.js"
import { Cardinals, XY } from "./position.js"
import { WithConstraint } from "./shapes/_base.js"

// type Expression 
//   = Inspect
//   | ShapeDefaultSetter
//   | Shape
//   | SetTime
//   | AnimationSequence
//   | Assignment
//   | IfExpression
//   | ConditionalExpression

// type AnimationSequence = ExpressionList | Animation

// type Animation 
//   = MoveTo
//   | Rotate
//   | Set

// type ConditionalExpression 
//   = IfExpression
//   | BinaryExpression
//   | UnaryExpression
//   | FunctionExpression
//   | Primary

// type Primary
//   = Number
//   | Boolean
//   | Color
//   | Position
//   | String
//   | TimelineValue
//   | VarfiableValue
//   | ArrayOrRange
//   | ConditionalExpression

export interface Base {
  type: string
  location?: Location
}

// An animation's parameters (take, ease, followsPrevious), as expressions
export type Parameters = { [name: string]: Node }

type FormalParameterList = Identifier[] 
export type ExpressionOrBlock = ExpressionList | Node


export interface ArrayExpression extends Base {
  type: `ArrayExpression`
  elements: Node[] 
}

export interface Assignment extends Base {
  type: `Assignment`,
  lvalue: Node, 
  rvalue: Node 
}

export interface BinaryExpression extends Base {
  type: `BinaryExpression`,
  left: Node, 
  operator: string, 
  right: Node
}

// //   VisitBlockStatement(node: AST.Base) {
// export interface BlockStatement extends Base {
//   constructor(
//     location: Location, 
//     left: Node, 
//     operator: string, 
//     right: Node
//   ) {
//     super(location)
//   }
// }

export interface Boolean extends Base {
  type: `Booloean`
  value: boolean 
}

export interface ColorLiteralString extends Base {
  type: `ColorLiteralString`,
  spec: string 
}

export interface ColorLiteralWithModel extends Base {
  type: `ColorLiteralWithModel`,
  model: string, 
  params: Node[]
}

export type ColorLiteral = ColorLiteralString | ColorLiteralWithModel


export interface Draw extends Base {
  type: `Draw`
  what: Node,
  params: Parameters
}

export interface ExpressionList extends Base {
  type: `ExpressionList`
  body: Node[]
}

export interface FaceAngle extends Base {
  type: `FaceAngle`
  angle: Node
}

export interface FaceCardinalDirection extends Base {
  type: `FaceCardinalDirection`
  direction: XY    // unit vector
}


export interface SystemFont extends Base {
  type: `SystemFont`
  name: string, 
}

export interface Font extends Base {
  type: `Font`
  spec: { [attr: string]: string }
}

export interface FunctionExpression extends Base {
  type: `FunctionExpression`
  params: FormalParameterList, 
  body: ExpressionOrBlock 
}

export interface GetTime extends Base {
  type: `GetTime`
}

export interface Aside extends Base {
  type: `Aside`
  body: ExpressionList | Node
}

export interface Group extends Base {
  type: `Group`
  body: ExpressionList | Node
  args?: ShapeArgs
  withConstraint?: WithConstraint | null    // the parser gives null for none
}

export interface Identifier extends Base {
  type: `Identifier`
  name: string, 
}

export interface IfExpression extends Base {
  type: `IfExpression`
  test: Node, 
  consequent: Node, 
  alternate: Node 
}

export interface Inspect extends Base {
  type: `Inspect`
  value: Node, 
}

export interface DirectionalWaypoint extends Base {
  type: `DirectionalWaypoint`
  components: { direction: XY, distance: Node }[]
}

export interface DirectionalUntilWaypoint extends Base {
  type: `DirectionalUntilWaypoint`
  direction: XY
  target: Node
}

export interface LayoutGoto extends Base {
  type: `LayoutGoto`
  direction?: XY       // unit vector from cardinal
  distance?: Node      // expression for distance
  place?: Node         // absolute position
}

export interface LayoutGap extends Base {
  type: `LayoutGap`
  direction?: XY       // unit vector from cardinal
  distance?: Node      // expression for distance
  same?: boolean       // repeat previous Gap
}

export interface MoveTo extends Base {
  type: `MoveTo`
  what: Node,     // a shape, or a point on one (a.nw): see Interpreter.moveTarget
  place: Node,
  params: Parameters
}

export interface MoveBy extends Base {
  type: `MoveBy`
  what: Node,
  direction: { x: number, y: number },
  distance: Node,
  params: Parameters
}

export interface Number extends Base {
  type: `Number`
  value: number
}

export interface Pause extends Base {
  type: `Pause`
  message: Node | null
}

export interface Position extends Base {
  type: `Position`,
  x: Node,
  y: Node
}

export interface Program extends Base {
  type: `Program`,
  body: ExpressionList,
}

export interface QualifiedLValue extends Base {
  type: `QualifiedLValue`,
  left: Node, 
  right: Qualifier
}

export interface QualifiedRValue extends Base {
  type: `QualifiedRValue`,
  left: Node, 
  right: Qualifier
}

export interface QualifierFunctionCall  {
  qtype: `call`,
  qvalue: Node[],   // args
}

export interface QualifierIndex  {
  qtype: `index`,
  qvalue: Node   // args
}

export interface QualifierAttr  {
  qtype: `attr`,
  qvalue: Identifier
}

export type Qualifier = QualifierFunctionCall | QualifierIndex | QualifierAttr

export interface Range extends Base {
  type: `Range`
  start: Node, 
  end: Node
}

export interface Rotate extends Base {
  type: `Rotate`
  what: Node, 
  angle: Node, 
  about: Node, 
  params: Parameters
}

export interface Set extends Base {
  type: `Set`
  what: Node, 
  value: Node, 
  params: Parameters
}

export interface ShapeDefaultGetter extends Base {
  type: `ShapeDefaultGetter`
  shape: string,
  klass: string,
  attr: string,
}

// the `position`th shape of a kind drawn so far, counting from the end if `fromEnd`
export interface ShapeReference extends Base {
  type: `ShapeReference`
  shape: string,         // SBox, SLine, ..., or SBase for any shape
  position: number,      // 1 is the first (or, from the end, the last)
  fromEnd: boolean,
}

export interface SetTime extends Base {
  type: `SetTime`
  when: string | number,
}

// A label along a line, as the parser builds it
export interface LineLabel {
  text: Node,
  pathPercent: number,
  side: string | null,
  _labelArgs?: Record<string, Node>,
}

// A shape's arguments: an expression for each attribute, plus the entries the
// parser adds for labels, a line's path, and other clauses
export interface ShapeArgs {
  [attribute: string]: Node | Node[] | LineLabel[] | boolean | string | undefined
  label?: Shape,                // one label
  _shapeLabels?: Shape[],       // several labels
  _labels?: LineLabel[],        // labels along a line
  _start?: Node,                // line from
  _end?: Node,                  // line to
  _waypoints?: Node[],          // line then ... then
  _closed?: boolean,
  _rotationCenter?: Node,       // rotation ... about
  _behind?: Node,
  _same?: boolean,
  _class?: string,              // .h1
}

export interface Shape extends Base {
  type: `Shape`
  shape: string,
  args: ShapeArgs,
  withConstraint?: WithConstraint | null,   // the parser gives null for none
  isChildShape?: boolean,  // true for label shapes that shouldn't become lastShape
}

export interface ShapeDefaultSetter extends Base {
  type: `ShapeDefaultSetter`
  shape: string, 
  klass: string, 
  attr: string, 
  value: Node
}

export interface String extends Base {
  type: `String`
  value: string,
}

export interface InterpolatedString extends Base {
  type: `InterpolatedString`
  parts: Node[],   // mix of String nodes and expression nodes
}

export interface ColorDynamic extends Base {
  type: `ColorDynamic`
  expr: Node,      // expression that evaluates to a color name
}

export interface UnaryExpression extends Base {
  type: `UnaryExpression`
  operator: string, 
  argument: Node
}

export interface VariableValue extends Base {
  type: `VariableValue`,
  name: string, 
}


// `with .nw at place`, as the parser builds it
export interface ASTWithConstraint {
  type: `WithConstraint`,
  selfElement?: string,  // For "with self.element" syntax
  cardinal: Cardinals,
  place: Node

}

export type Node
  = Aside
  | ArrayExpression
  | Assignment
  | BinaryExpression
  | Boolean
  | ColorDynamic
  | ColorLiteralString
  | DirectionalUntilWaypoint
  | DirectionalWaypoint
  | ColorLiteralWithModel
  | Draw
  | ExpressionList
  | FaceAngle
  | FaceCardinalDirection
  | Font
  | FunctionExpression
  | GetTime
  | Group
  | Identifier
  | IfExpression
  | Inspect
  | LayoutGap
  | LayoutGoto
  | MoveBy
  | MoveTo
  | Number
  | Pause
  | Position
  | Program
  | QualifiedLValue
  | QualifiedRValue
  | Range
  | Rotate
  | Set
  | SetTime
  | Shape
  | ShapeDefaultGetter
  | ShapeDefaultSetter
  | ShapeReference
  | InterpolatedString
  | String
  | UnaryExpression
  | VariableValue

//   VisitWait(node: AST.Base) {
// export interface BinaryExpression extends Base {
//   constructor(
//     location: Location, 
//     left: Node, 
//     operator: string, 
//     right: Node
//   ) {
//     super(location)
//   }
// }


// export interface BinaryExpression extends Base {
//   constructor(
//     location: Location, 
//     left: Node, 
//     operator: string, 
//     right: Node
//   ) {
//     super(location)
//   }
// }


