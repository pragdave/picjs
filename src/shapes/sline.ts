import { LineLike } from "./line_like.js"
import type * as AST from "../ast.js"
import { Cardinals, CardinalFactorsFromCenter, UnitVector, XY } from "../position.js"
  
export class SLine extends LineLike {
  override shapeName = "SLine"


  // we aren't really anchored, but we can pretend 
  //
  getCardinalOffsetsFromAnchor(cardinal: Cardinals) {
    const [ fx, fy ] = CardinalFactorsFromCenter[cardinal]
    return [ fx * this.width, fy * this.height ]
  }


  get width()             { return Math.abs(this.start.x - this.end.x) }
  get height()            { return Math.abs(this.start.y - this.end.y) }
  get default_length()    { return this.params.length ?? 1              }
  get length()            {
    return Math.hypot(
      this.start.x - this.end.x, 
      this.start.y - this.end.y
    ) 
  }


  // A line given by directions (line right 2 up 1), as a syntax tree
  get _directional()      { return this.hidden._directional as AST.DirectionalWaypoint | undefined }

  getEndAndNewDirection(startAsXY: XY, direction: UnitVector) {
    // Handle directional syntax: line right 2, line right 2 up 1
    if (this._directional) {
      const waypoint = this._directional
      let dx = 0, dy = 0
      for (const comp of waypoint.components) {
        const dir = comp.direction
        const dist = this.distance(comp.distance)
        dx += dir.x * dist
        dy += dir.y * dist
      }
      const endAsXY = { x: startAsXY.x + dx, y: startAsXY.y + dy }
      // New direction is the overall direction of travel
      const len = Math.hypot(dx, dy)
      const newDirection = len > 0 ? { x: dx / len, y: dy / len } : direction
      return [endAsXY, newDirection]
    }

    const endAsXY = {
      x: startAsXY.x + this.default_length * direction.x,
      y: startAsXY.y + this.default_length * direction.y,
    }

    // direction isn't changed
    return [ endAsXY, direction ]
  }

  // Return point and tangent angle at a given fraction along the line (0.0 to 1.0)
  pointAtPercent(t: number) {
    const start = this.start
    const end = this.end

    // Linear interpolation
    const x = start.x + t * (end.x - start.x)
    const y = start.y + t * (end.y - start.y)

    // Tangent angle is the line's direction
    const tangentAngle = Math.atan2(end.y - start.y, end.x - start.x)

    // For lines, use perpendicular to tangent (pointing "up" relative to travel direction)
    // This is tangent - 90° which points to the left of travel direction
    const radiusAngle = tangentAngle - Math.PI / 2

    return { x, y, tangentAngle, radiusAngle }
  }

  // For lines, "above" means to the left of travel direction (negative perpendicular offset)
  // "below" means to the right of travel direction (positive perpendicular offset)
  isInsideDirection(side: string): number {
    // Lines don't have inside/outside, but we treat them the same as above/below
    if (side === `above` || side === `outside`) return -1
    if (side === `below` || side === `inside`) return 1
    return 0  // center
  }
}


