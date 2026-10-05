import { RTE } from "./runtime_error.js"
import { TBase, TPosition } from "./types.js"
import type * as AST from "./ast.js"
import { LineLike, SArc, SBase, SGroup, SLine, SPoint, SPolyline } from "./shapes.js"
import type { LineLabelConstraint } from "./shapes/_base.js"
import { Cardinals, XY } from "./position.js"
import { Dispatcher } from "./dispatcher.js"



export const DegreesToRadians = Math.PI / 180

// Where something is, and, if it is a shape, the shape a line to it is cropped to
interface Place {
  point: XY
  cropTo?: SBase
}

function isPoint(value: unknown): value is XY {
  return typeof value === `object` && value !== null && !(value instanceof TBase) &&
    typeof (value as XY).x === `number` && typeof (value as XY).y === `number`
}

function nameForErrors(value: unknown) {
  return value instanceof TBase ? value.nameForErrors() : String(value)
}

export class Geometry {

  lastShape: SBase
  direction: XY = { x: 1, y: 0 }

  constructor(
    public dispatcher: Dispatcher,
    public width = 10,
      public height = 7
  ) {
    this.lastShape = new SPoint({ at: { x: 0, y: 0 } }, undefined, this.dispatcher)
    this.setDefaultDirection({ x: 1, y: 0 })
  }

  setDirectionFromAngle(degrees: number) {
    const radians = degrees * DegreesToRadians
    this.setDefaultDirection({ x: Math.cos(radians), y: Math.sin(radians) })
  }

  setDefaultDirection({ x, y }: XY) {
    // normalize to unit vector
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y)
      if (Math.abs(len - 1) > 0.1) {
        const factor = 1 / len
        x *= factor
        y *= factor
      }
    }
    this.direction = { x, y }
  }


  addShape(shape: SBase) {
    this.position(shape)
  }

  // Given a constraint:
  //   - make sure we don't also have attr.x or cy 
  //   - set layout.anchorX/Y from comstraint
  //
  // Otherwise, for anchorX and anchorY independently, either set the layout to the attr
  // specified, or calculate the layout value based on that previously drawn
  // shape and the current direction

  position(shape: SBase) {
    if (shape instanceof SPolyline) {
      this.positionPolyline(shape)
    }
    else if (shape instanceof SLine || shape instanceof SArc) {
      this.positionLine(shape)
    }
    else if (shape instanceof SGroup) {
      if (shape.withConstraint) {
        this.constrainedLayout(shape)
      }
      else if (shape.needsFlowLayout && shape.predecessorShape) {
        this.lastShape = shape.predecessorShape
        this.autolayout(shape)
      }
      // No repositionChildren() needed - SVG transform handles it
    }
    else {
      if (shape.missingDimensions())
        this.dispatcher.calculateDimensions(shape)

      if (shape.withConstraint) {
        this.constrainedLayout(shape)
      }
      else if (shape.hasNoXCoordinate() || shape.hasNoYCoordinate()) {
        this.autolayout(shape)
      }
    }

    if (!shape.isChild() && shape.withConstraint?.type !== `ProcessedWithConstraint`)
      this.lastShape = shape
  }


  // project a line from the center of the last line in the current direction.
  // where that intersectws the last shape is the constraint point.
  // Now set the center of the target shape to zero, and project a line back 
  // in the reciprocal of the current direction. Where is intersects the shape is the
  // offset to the center. Position the new shape at (constraint - offset)
  autolayoutCount = 0

  autolayout(shape: SBase) {
    this.autolayoutCount++
    const c = this.lastShape.c

    if (this.lastShape.width === 0 && this.lastShape.height === 0 && !this.lastShape.layoutAsEdge) {
      shape.anchorX = this.lastShape.anchor.x
      shape.anchorY = this.lastShape.anchor.y
    }
    else if (this.lastShape.width === 0 && this.lastShape.height === 0 && this.lastShape.layoutAsEdge) {
      // Gap endpoint: place next shape's entry edge at this point
      shape.anchorX = shape.anchorY = 0
      const offset = shape.cropLineTo(null, { x: -this.direction.x, y: -this.direction.y })
      shape.anchorX = this.lastShape.anchor.x - offset.x
      shape.anchorY = this.lastShape.anchor.y - offset.y
    }
    else {
      const projection = { x: c.x + this.direction.x, y: c.y + this.direction.y }
      const constraint = this.lastShape.cropLineTo(null, projection)

      shape.anchorX = shape.anchorY = 0
      const offset = shape.cropLineTo(null, { x: -this.direction.x, y: -this.direction.y })

      shape.anchorX = constraint.x - offset.x
      shape.anchorY = constraint.y - offset.y
    }
  }

  constrainedLayout(shape: SBase) {
    const constraint = shape.withConstraint
    if (constraint === undefined)
      throw new Error(`somehow got a constraint of null`)

    // Handle line label constraints specially
    if (constraint.type === `LineLabelConstraint`) {
      if (shape.missingDimensions())
        this.dispatcher.calculateDimensions(shape)
      this.positionLineLabel(shape, constraint)
      return
    }

    const myAnchorName = constraint.cardinal

    // from the "there must be a better way" department...
    // If this is a child shape, then the constraint
    // target isn't known in AST terms: it's an
    // instantiated shape. This means we have to deal with both
    // an AST target and a Shape target

    let target
    if (constraint.type !== `ProcessedWithConstraint`) {
      target = shape.valueOfTree(constraint.place)
    }
    else {
      target = constraint.targetAsShapeObject
    }

    if (target instanceof SBase) {
      this.dispatcher.recordDependency(shape, target)
      target = target.handle_attr_c()
    }
    if (!(target instanceof TPosition))
      throw new RTE(`"with ... at" needs a position or a shape, but this is ${nameForErrors(target)}`)

    // Handle "with self.element" syntax for groups
    if (constraint.type === `WithConstraint` && constraint.selfElement && shape instanceof SGroup) {
      const child = shape.attrs[constraint.selfElement]
      if (!(child instanceof SBase)) {
        throw new RTE(`self.${constraint.selfElement} is not a shape`)
      }

      // Get child's cardinal point (absolute position after group body executed)
      const childCardinal = child.corner(myAnchorName)

      // Offset from group anchor to child's cardinal
      const offsetX = childCardinal.x - shape.anchorX!
      const offsetY = childCardinal.y - shape.anchorY!

      // Position group so child's cardinal lands at target
      shape.setAnimatablePosition(target.x - offsetX, target.y - offsetY)
    }
    else {
      // Standard behavior: position shape's own cardinal at target
      Geometry.positionCardinalToPoint(shape, myAnchorName, target.x, target.y)
    }

    // Apply vertical stack offset for stacked labels with custom styling
    if (shape.params._stackOffset !== undefined) {
      shape.setAnimatablePosition(shape.anchorX!, shape.anchorY! + shape.params._stackOffset)
    }
  }

  // Position a label along a line/arc path with perpendicular offset.
  //
  // Text is always parallel to the line segment and never upside-down.
  // "above" offsets toward north (negative y in SVG), "below" toward south.
  // Offset distance = (line stroke-width + label font-size) / 2
  positionLineLabel(label: SBase, constraint: LineLabelConstraint) {
    const line = constraint.parentShape as LineLike
    const pathPercent = constraint.pathPercent ?? 0.5
    const side = constraint.side || `center`

    // Record dependency so label moves when line moves
    this.dispatcher.recordDependency(label, line)

    // Get point and tangent at the specified position along the path
    const { x, y, tangentAngle } = line.pointAtPercent(pathPercent)

    // Normalize tangent to [-π/2, π/2] so text is never upside-down
    let displayAngle = tangentAngle
    if (displayAngle > Math.PI / 2) displayAngle -= Math.PI
    if (displayAngle < -Math.PI / 2) displayAngle += Math.PI

    let targetX = x
    let targetY = y

    if (side !== `center`) {
      const strokeWidth = Number(line.params[`stroke_width`]) || 0.04
      const fontSize = Number(label.params[`font_size`]) || 0.14
      const gap = fontSize * 0.25
      const offsetDistance = strokeWidth / 2 + gap + fontSize * 0.7

      // The perpendicular at (displayAngle - π/2) points northward (negative Y)
      // because sin(displayAngle - π/2) = -cos(displayAngle) ≤ 0
      // for displayAngle ∈ [-π/2, π/2]
      const northPerpAngle = displayAngle - Math.PI / 2

      if (side === `above` || side === `outside`) {
        targetX += offsetDistance * Math.cos(northPerpAngle)
        targetY += offsetDistance * Math.sin(northPerpAngle)
      } else if (side === `below` || side === `inside`) {
        targetX -= offsetDistance * Math.cos(northPerpAngle)
        targetY -= offsetDistance * Math.sin(northPerpAngle)
      }
    }

    label.setAnimatablePosition(targetX, targetY)

    // Rotate label to match line direction (never upside-down)
    const rotationDegrees = displayAngle * (180 / Math.PI)
    label.params.rotation = rotationDegrees
    label.setRotationVector()
  }

  // Set the center of shape to make the cardinal point coincident with
  // the target
  static positionCardinalToPoint(shape: SBase, cardinal: Cardinals, targetX: number, targetY: number) {
    const [xOffset, yOffset] = shape.getCardinalOffsetsFromAnchor(cardinal)
    shape.setAnimatablePosition(targetX - xOffset, targetY - yOffset)
  }


  // Fasten your seat belt:
  //
  // Lines are drawn between two points.
  // 
  // We have a number of cases
  //
  // - neither start nor end given: we draw from the current point in a direction
  //   given by this.direction
  //
  // - an end point is given, in which case we draw from the current point to it
  //
  // - both start and end are given
  //
  // Then, to make things more interesting, when a start or end is given to us,
  // we actually receive a thunk. This thunk should evaluate to either
  // a TPosition or a TShape. If it's a position, then we just use it. If
  // it's a shape object, then the implicit target is the center, but we crop
  // the line to the shape's periphery. 
  //
  // Finally, how we do the crop depends on the line_path. If it is straight,
  // we just head for the center and crop when we hit the edge. If it is 
  // smooth or stepped, we instead always connect to one of n, e, w, or s,
  // the choice depending on the relative position of both ends.

  positionLine(line: SLine | SArc) {
    const [start, end] = this.getLineStartEnd(line)
    line.start = start
    line.end = end
    line.setAnimatablePosition(
      start.x + (end.x - start.x) / 2, 
      start.y + (end.y - start.y) / 2
    )
  }

  positionPolyline(poly: SPolyline) {
    // Resolve the start: `from`, or else the shape before the line
    let start: Place
    if (poly._start)
      start = this.endpoint(poly, poly._start)
    else if (poly.predecessorShape)    // it may have moved during animation
      start = { point: this.implicitPolylineStart(poly, poly.predecessorShape) }
    else if (poly.params.start !== undefined)
      start = { point: poly.params.start }   // resolved in the initial layout, with nothing to follow
    else
      start = { point: this.implicitPolylineStart(poly, this.lastShape) }
    let startXY = start.point

    // Resolve each waypoint
    const waypoints: Place[] = []
    const lastPoint = () => waypoints.length > 0 ? waypoints[waypoints.length - 1].point : startXY

    for (const wpThunk of poly._waypoints || []) {
      if (wpThunk.type === `DirectionalWaypoint`) {
        // Directional waypoint: resolve relative to previous point
        let { x, y } = lastPoint()
        for (const comp of wpThunk.components) {
          const dist = poly.distance(comp.distance)
          x += comp.direction.x * dist
          y += comp.direction.y * dist
        }
        waypoints.push({ point: { x, y } })
      }
      else if (wpThunk.type === `DirectionalUntilWaypoint`) {
        // "then west until even with target": go in direction until aligned
        const prev = lastPoint()
        const target = this.endpoint(poly, wpThunk.target).point
        const dir = wpThunk.direction
        if (dir.x !== 0 && dir.y === 0)        // horizontal: until x matches
          waypoints.push({ point: { x: target.x, y: prev.y } })
        else if (dir.x === 0 && dir.y !== 0)   // vertical: until y matches
          waypoints.push({ point: { x: prev.x, y: target.y } })
        else
          waypoints.push({ point: { x: target.x, y: target.y } })
      }
      else {
        waypoints.push(this.endpoint(poly, wpThunk))
      }
    }

    // Crop the start toward the first waypoint, and each waypoint that is a
    // shape toward the point before it
    if (start.cropTo && waypoints.length > 0)
      startXY = start.cropTo.cropLineTo(poly, waypoints[0].point)

    const points: XY[] = []
    waypoints.forEach((wp, i) => {
      const prev = i === 0 ? startXY : points[i - 1]
      points.push(wp.cropTo ? wp.cropTo.cropLineTo(poly, prev) : wp.point)
    })

    poly.start = startXY
    poly.waypoints = points
    poly.params.closed = poly.closed

    // Set anchor to bounding-box center (not centroid) so cardinal
    // offsets (width/2, height/2) align with the actual extents.
    const allPts = poly.allPoints
    const xs = allPts.map(p => p.x)
    const ys = allPts.map(p => p.y)
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    poly.setAnimatablePosition(cx, cy)
  }

  getLineStartEnd(line: SLine | SArc) {
    const dir = line._layoutDirection ?? this.direction
    let newDirection = dir

    // Without a `from`, start from the predecessor if there is one (set by
    // resolveImplicitConnectorDependencies), or else from what was drawn last
    // when the line was first laid out
    let start: Place
    if (line._start) {
      start = this.endpoint(line, line._start)
    }
    else {
      // lastShape is only the shape before the line during the first layout:
      // once more has been drawn it is something later
      const fromShape = line.predecessorShape ?? (line.startedFrom ??= this.lastShape)
      if (fromShape instanceof LineLike)     // a chain of lines: start where it ends
        start = { point: { ...fromShape.end } }
      else {
        const c = fromShape.c
        start = { point: fromShape.cropLineTo(line, { x: c.x + dir.x, y: c.y + dir.y }) }
      }
    }

    let end: Place
    if (line._end)
      end = this.endpoint(line, line._end)
    else if (line.successorShape)            // crop to its edge facing the start
      end = this.convertToPosition(line.successorShape)
    else {
      const [point, direction] = line.getEndAndNewDirection(start.point, dir)
      end = { point }
      newDirection = direction
    }

    const startAsXY = start.cropTo ? start.cropTo.cropLineTo(line, end.point) : start.point
    const endAsXY = end.cropTo ? end.cropTo.cropLineTo(line, startAsXY) : end.point

    // OK to use updated startAsXY because it's colinear

    if (!line._layoutDirection) {
      line._layoutDirection = dir
      this.direction = newDirection
    }

    return [startAsXY, endAsXY]
  }

  // Where a line's from, to or then is: a position, or a shape, or a point
  // already worked out. For a shape, it is the shape's center, and the line
  // is cropped to the shape's edge (cropTo).
  convertToPosition(place: unknown): Place {
    if (place instanceof TPosition)
      return { point: place.toNative() }
    if (place instanceof LineLike)
      return { point: place.end }
    if (place instanceof SBase)
      return { point: place.c, cropTo: place }
    if (isPoint(place))
      return { point: place }
    throw new RTE(`A line can only go from, to, or through a position or a shape, but this is ${nameForErrors(place)}`)
  }

  // Evaluate a line's from, to or then, following it if it is a shape
  private endpoint(line: LineLike, tree: AST.Node): Place {
    const value = line.valueOfTree(tree)
    if (value instanceof SBase)
      this.dispatcher.recordDependency(line, value)
    return this.convertToPosition(value)
  }

  // A polyline with no `from` starts where the shape before it ends: a line's
  // end, or the edge of anything else, toward its first step if that is a
  // direction, or else its center
  private implicitPolylineStart(poly: SPolyline, fromShape: SBase): XY {
    if (fromShape instanceof LineLike)
      return { ...fromShape.end }
    const c = fromShape.c
    const first = poly._waypoints?.[0]
    if (first?.type === `DirectionalWaypoint`) {
      const dir = first.components[0].direction
      return fromShape.cropLineTo(poly, { x: c.x + dir.x, y: c.y + dir.y })
    }
    return { ...c }
  }
}
