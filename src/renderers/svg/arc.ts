import { LineLikeRenderer } from "./line_like_renderer.js"
import { arrowDimensions } from "./_base.js"
import * as Convert from "./attribute_converters.js"
import * as Shape from "../../shapes.js"
import { RenderParameters } from "../../types.js"
import { DegreesToRadians } from "../../geometry.js"
import { arcGeometry, arcSweep } from "../../shapes/sarc.js"

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

  protected buildPath() {
    const start = this.start
    const end = this.end

    const chordX = end.x - start.x
    const chordY = end.y - start.y
    const chordAngleDeg = Math.atan2(chordY, chordX) / DegreesToRadians

    const geo = arcGeometry(start, end, arcSweep(this.params.turn))
    if (!geo) {
      return ` M ${start.x} ${start.y} L ${end.x} ${end.y}`
    }

    const { r, startAngle, endAngle } = geo
    const isCW = endAngle > startAngle
    const rx = r
    const ry = r
    const turn = isCW ? 1 : 0
    let sweep = Math.abs(endAngle - startAngle)   // less what the markers take
    const tangentOffset = isCW ? Math.PI / 2 : -Math.PI / 2

    // Markers mutate pos to the arrow base — use that as the arc endpoint
    // so the stroke meets the arrow exactly.
    const arcStart = { ...start }
    const arcEnd   = { ...end }

    if (this.params.line_start) {
      const { length: w } = arrowDimensions(this.strokeWidth)
      const baseAngle = startAngle + (isCW ? 1 : -1) * (w / r)
      sweep -= w / r
      const baseTangent = baseAngle + tangentOffset
      this.pendingMarkers.push(this.markerPath(this.params.line_start, arcStart, -1, baseTangent))
    }

    if (this.params.line_end) {
      const { length: w } = arrowDimensions(this.strokeWidth)
      const baseAngle = endAngle - (isCW ? 1 : -1) * (w / r)
      sweep -= w / r
      const baseTangent = baseAngle + tangentOffset
      this.pendingMarkers.push(this.markerPath(this.params.line_end, arcEnd, +1, baseTangent))
    }

    // past halfway round, SVG must be told to take the long way
    const largeArc = sweep > Math.PI ? 1 : 0

    return ` M ${arcStart.x} ${arcStart.y}` +
    ` A ${rx} ${ry} ${chordAngleDeg} ${largeArc} ${turn} ${arcEnd.x} ${arcEnd.y} `
  }
}
