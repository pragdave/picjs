import { LineLike, PathPoint } from "./line_like.js"
import { Cardinals, CardinalFactorsFromCenter, UnitVector, XY } from "../position.js"
import { RTE } from "../runtime_error.js"

// A bare arc's radius
const DefaultLength = 0.625

// How far an arc turns, in degrees: positive is clockwise on screen, as Face's
// angles are. cw and ccw are a quarter turn either way.
export function arcSweep(turn: unknown): number {
  if (turn === `cw` || turn === undefined) return 90
  if (turn === `ccw`) return -90
  if (typeof turn === `number` && turn !== 0 && Math.abs(turn) < 360) return turn
  const given = typeof turn === `string` ? `"${turn}"` : String(turn)
  throw new RTE(`An arc's turn must be cw, ccw, or an angle between -360 and 360 other than 0, but this is ${given}`)
}

export interface ArcGeometry {
  cx: number
  cy: number
  r: number
  startAngle: number      // radians, from the center; endAngle - startAngle is the sweep
  endAngle: number
}

// The circle an arc from start to end lies on, turning through sweep degrees.
// Null when the ends are too close together to be an arc.
export function arcGeometry(start: XY, end: XY, sweep: number): ArcGeometry | null {
  const chordX = end.x - start.x
  const chordY = end.y - start.y
  const chord = Math.hypot(chordX, chordY)
  if (chord < 1e-6) return null

  const theta = sweep * Math.PI / 180
  const half = Math.abs(theta) / 2
  const r = chord / (2 * Math.sin(half))
  // from the chord's middle to the center, which is past the chord once the
  // arc turns more than halfway round
  const d = r * Math.cos(half)
  const sign = theta > 0 ? 1 : -1
  const cx = (start.x + end.x) / 2 - sign * (chordY / chord) * d
  const cy = (start.y + end.y) / 2 + sign * (chordX / chord) * d

  const startAngle = Math.atan2(start.y - cy, start.x - cx)
  return { cx, cy, r, startAngle, endAngle: startAngle + theta }
}

export class SArc extends LineLike {
  static override readonly kind = "SArc"

  getCardinalOffsetsFromAnchor(cardinal: Cardinals) {
    const [ fx, fy ] = CardinalFactorsFromCenter[cardinal]
    return [ fx * this.width, fy * this.height ]
  }


  get sweep(): number  { return arcSweep(this.params.turn) }
  get width()          { return Math.abs(this.start.x - this.end.x) }
  get height()         { return Math.abs(this.start.y - this.end.y) }
  get default_length() { return DefaultLength }
  get length()         { 
    return Math.hypot(
      this.start.x - this.end.x, 
      this.start.y - this.end.y
    ) 
  }


  // A bare arc: it leaves along the current direction, curves round a circle
  // of the default radius, and leaves the direction turned as far as it did
  getEndAndNewDirection(startAsXY: XY, direction: UnitVector) {
    const theta = this.sweep * Math.PI / 180
    const sign = theta > 0 ? 1 : -1
    const r = this.default_length
    const { x: dx, y: dy } = direction

    // the center is a radius away, on the side the arc turns toward
    const cx = startAsXY.x - sign * r * dy
    const cy = startAsXY.y + sign * r * dx
    const startAngle = Math.atan2(startAsXY.y - cy, startAsXY.x - cx)
    const end = { x: cx + r * Math.cos(startAngle + theta), y: cy + r * Math.sin(startAngle + theta) }

    const cos = Math.cos(theta), sin = Math.sin(theta)
    return [ end, { x: dx * cos - dy * sin, y: dx * sin + dy * cos } ]
  }

  cropLineRelative(center: XY, _target: unknown) {
    // regardless, we always line to the end of the line.
    return { x: this.end.x - center.x, y: this.end.y - center.y }
  }
  
  private arcGeometry() {
    return arcGeometry(this.start, this.end, this.sweep)
  }

  override get nw() {
    const bb = this.arcBounds()
    return { x: bb.minX, y: bb.minY }
  }

  override get se() {
    const bb = this.arcBounds()
    return { x: bb.maxX, y: bb.maxY }
  }

  // The canvas must hold the whole curve, which bulges past the box around
  // its ends: a half turn between two points on a level has no height there
  override extent() {
    const { minX, minY, maxX, maxY } = this.arcBounds()
    const { x: cx, y: cy } = this.c
    const xs: number[] = []
    const ys: number[] = []
    for (const [x, y] of [ [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY] ]) {
      const dx = x - cx, dy = y - cy
      xs.push(cx + dx * this.cosR - dy * this.sinR)
      ys.push(cy + dx * this.sinR + dy * this.cosR)
    }
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
  }

  private arcBounds() {
    const start = this.start
    const end = this.end
    const geo = this.arcGeometry()

    if (!geo) {
      return { minX: start.x, minY: start.y, maxX: start.x, maxY: start.y }
    }

    const { cx, cy, r, startAngle, endAngle } = geo
    let minX = Math.min(start.x, end.x)
    let maxX = Math.max(start.x, end.x)
    let minY = Math.min(start.y, end.y)
    let maxY = Math.max(start.y, end.y)

    const cardinalAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2]
    const lo = Math.min(startAngle, endAngle)
    const hi = Math.max(startAngle, endAngle)
    for (const base of cardinalAngles) {
      for (let a = base - 4 * Math.PI; a <= base + 4 * Math.PI; a += 2 * Math.PI) {
        if (a >= lo && a <= hi) {
          const px = cx + r * Math.cos(a)
          const py = cy + r * Math.sin(a)
          minX = Math.min(minX, px)
          maxX = Math.max(maxX, px)
          minY = Math.min(minY, py)
          maxY = Math.max(maxY, py)
        }
      }
    }
    return { minX, minY, maxX, maxY }
  }

  // Return point and tangent angle at a given fraction along the arc (0.0 to 1.0)
  pointAtPercent(t: number): PathPoint {
    const geo = this.arcGeometry()

    // Too short to be an arc: treat it as a point on a horizontal line
    if (!geo) {
      return { x: this.start.x, y: this.start.y, tangentAngle: 0, radiusAngle: -Math.PI / 2 }
    }

    const { cx, cy, r, startAngle, endAngle } = geo
    const angle = startAngle + t * (endAngle - startAngle)
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)

    // Tangent is perpendicular to radius, in direction of travel
    const tangentAngle = angle + (this.sweep > 0 ? 1 : -1) * Math.PI / 2

    // Also return the radius angle (from center to point) for offset calculations
    return { x, y, tangentAngle, radiusAngle: angle }
  }

  // For arcs, "inside" means toward arc center, "outside" means away from center
  isInsideDirection(side: string): number {
    // Return +1 for inside (toward center), -1 for outside (away from center)
    if (side === `inside`) return 1
    if (side === `outside`) return -1
    if (side === `above`) return -1  // treat above as outside for consistency
    if (side === `below`) return 1   // treat below as inside
    return 0  // center
  }
}




