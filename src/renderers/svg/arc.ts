import { LineLikeRenderer } from "./line_like_renderer.js"
import { arrowDimensions } from "./_base.js"
import * as Convert from "./attribute_converters.js"
import * as Shape from "../../shapes.js"
import { XY } from "../../position.js"
import { RenderParameters } from "../../types.js"
import { DegreesToRadians } from "../../geometry.js"


const two_cos_45 = 2.0 * Math.cos(Math.PI / 4.0)

export class Arc extends LineLikeRenderer {

  cropped = false

  convertToSVG(position: RenderParameters, attrs: Shape.Args) {
    this.pendingMarkers = []
    this.strokeSlot = attrs._stroke_slot
    this.params = Convert.run(position, attrs, [
      Convert.rotation,
      Convert.linestyle,
    ])
    this.params.d = this.buildPath()
    this.params.fill = `none`
    this.noteDrawProgress()
    this.applyDrawProgress(this.params)
    this.dropPathParams()
    return this.params
  }

  private arcGeometry(start: XY, end: XY) {
    const chordX = end.x - start.x
    const chordY = end.y - start.y
    const chord = Math.hypot(chordX, chordY)
    if (chord < 1e-6) return null

    const isCW = this.params.turn === `cw`

    const r = chord / two_cos_45
    const ux = chordX / chord
    const uy = chordY / chord
    const px = -uy
    const py = ux
    const halfChord = chord / 2
    const d = Math.sqrt(r * r - halfChord * halfChord)
    const sign = isCW ? 1 : -1
    const cx = (start.x + end.x) / 2 + sign * px * d
    const cy = (start.y + end.y) / 2 + sign * py * d

    const startAngle = Math.atan2(start.y - cy, start.x - cx)
    let endAngle   = Math.atan2(end.y - cy, end.x - cx)
    if (isCW) {
      while (endAngle < startAngle) endAngle += 2 * Math.PI
    } else {
      while (endAngle > startAngle) endAngle -= 2 * Math.PI
    }

    return { cx, cy, r, startAngle, endAngle, isCW }
  }

  protected buildPath() {
    const start = this.start
    const end = this.end

    const chordX = end.x - start.x
    const chordY = end.y - start.y
    const chordAngleDeg = Math.atan2(chordY, chordX) / DegreesToRadians

    const geo = this.arcGeometry(start, end)
    if (!geo) {
      return ` M ${start.x} ${start.y} L ${end.x} ${end.y}`
    }

    const { r, startAngle, endAngle, isCW } = geo
    const rx = r
    const ry = r
    const turn = isCW ? 1 : 0
    const tangentOffset = isCW ? Math.PI / 2 : -Math.PI / 2

    // Markers mutate pos to the arrow base — use that as the arc endpoint
    // so the stroke meets the arrow exactly.
    const arcStart = { ...start }
    const arcEnd   = { ...end }

    if (this.params.line_start) {
      const { length: w } = arrowDimensions(this.strokeWidth)
      const baseAngle = startAngle + (isCW ? 1 : -1) * (w / r)
      const baseTangent = baseAngle + tangentOffset
      this.pendingMarkers.push(this.markerPath(this.params.line_start, arcStart, -1, baseTangent))
    }

    if (this.params.line_end) {
      const { length: w } = arrowDimensions(this.strokeWidth)
      const baseAngle = endAngle - (isCW ? 1 : -1) * (w / r)
      const baseTangent = baseAngle + tangentOffset
      this.pendingMarkers.push(this.markerPath(this.params.line_end, arcEnd, +1, baseTangent))
    }

    return ` M ${arcStart.x} ${arcStart.y}` +
    ` A ${rx} ${ry} ${chordAngleDeg} 0 ${turn} ${arcEnd.x} ${arcEnd.y} `
  }
}
