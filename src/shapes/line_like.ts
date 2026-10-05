import { RTE } from "../runtime_error.js"
import { SBase }from "./_base.js"
import { TNumber, TPosition } from "../types.js"
import { XY } from "../position.js"
import type * as AST from "../ast.js"

export interface PathPoint {
  x: number
  y: number
  tangentAngle: number
  radiusAngle: number  // For arcs: angle from center to point. For lines: perpendicular to tangent.
}

export abstract class LineLike extends SBase {
  // Set during the post-layout connector scan for connectors with no explicit endpoints.
  // Used by geometry.positionLine to avoid relying on stale lastShape state.
  predecessorShape?: SBase
  successorShape?:   SBase
  // What a line with neither a `from` nor a predecessor started from when it
  // was first laid out (the origin, say), so re-evaluating it starts there too
  startedFrom?: SBase
  _layoutDirection?: XY

  // The `from` and `to` clauses, as syntax trees evaluated by the geometry.
  // Without them, a line runs from the shape before it to the one after.
  get _start(): AST.Node | undefined { return this.hidden._start as AST.Node | undefined }
  get _end(): AST.Node | undefined   { return this.hidden._end as AST.Node | undefined }

  // Where the geometry has put the line's ends
  get start(): XY    { return this.param(`start`) }
  set start(val: XY) { this.params.start = val }
  get end(): XY      { return this.param(`end`) }
  set end(val: XY)   { this.params.end = val }

  get thickness(): number { return this.param(`stroke_width`) }
  get stroke(): string    { return this.param(`stroke`) }
  get line_path()         { return this.params.line_path }
  abstract get length(): number

  // A distance in a line given by directions (line right 2), evaluated
  distance(tree: AST.Node): number {
    const value = this.valueOfTree(tree)
    if (!(value instanceof TNumber))
      throw new RTE(`A line's distance must be a number, but this is ${value.nameForErrors()}`)
    return value.value
  }

  handle_attr_thickness() { return new TNumber(this.thickness) }
  handle_attr_length()    { return new TNumber(this.length) }
  handle_attr_start()     { return new TPosition(this.start) }
  handle_attr_end()       { return new TPosition(this.end) }

  handle_attr_draw_progress() {
    return new TNumber(this.params.draw_progress ?? 1)
  }

  isConnector() {
    return true
  }

  // For lines, return the endpoint closest to the target rather than
  // cropping a bounding box.  This ensures a chain of lines connects
  // end-to-end instead of hitting the middle of the bbox.
  cropLineTo(_: unknown, target: XY) {
    const dStart = Math.hypot(target.x - this.start.x, target.y - this.start.y)
    const dEnd   = Math.hypot(target.x - this.end.x,   target.y - this.end.y)
    return dStart < dEnd ? { ...this.start } : { ...this.end }
  }

  // Return point and tangent at a given fraction along the path (0.0 to 1.0)
  abstract pointAtPercent(t: number): PathPoint

  // Return direction multiplier for perpendicular offset based on side
  // -1 for above/outside, +1 for below/inside, 0 for center
  isInsideDirection(_side: string): number {
    return 0
  }
}
 

