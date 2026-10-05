import { LineDirection, SvgBase, arrowDimensions, addUsedSlot, toSvgAttrNames } from "./_base.js"
import { RenderParameters } from "../../types.js"
import * as Shape from "../../shapes.js"
import { XY } from "../../position.js"
import { SvgAttrs, SvgNode, svgNode } from "../../svg-node.js"

// Shared scaffolding for the two line-like renderers.
//
// A Line and a Polyline draw different paths, but everything around the path is
// the same: the <g> wrapper, the end markers and their geometry, and the
// re-render cycle. That code was copy-pasted between the two, and drifted —
// polylines silently lost `rotation` because only Line's buildGroup handled the
// transform that Convert.rotation produces.
//
// Subclasses supply buildPath(); markerPath() shortens the endpoint it is given
// in place, so the path builder must call it before reading the coordinates.

const PATH_PARAMS = [ `start`, `end`, `waypoints`, `closed`, `line_path`, `line_start`, `line_end`,
                      `length`, `turn`, `x`, `y`, `rx`, `ry` ]

export abstract class LineLikeRenderer extends SvgBase {

  // the shape's parameters, as convertToSVG converts them
  protected params: Shape.Args = {}
  protected pendingMarkers!: string[]
  protected hideMarkers!: boolean
  protected strokeSlot?: string

  constructor(position: RenderParameters, attrs: Shape.Args) {
    super(position, attrs)
    this.buildGroup()
  }

  /** The `d` attribute for this shape, queueing any end markers as it goes. */
  protected abstract buildPath(): string

  // What a line always has
  protected get start(): XY  { return required(this.params.start, `start`) }
  protected get end(): XY    { return required(this.params.end, `end`) }
  protected get strokeWidth(): number { return required(this.params.stroke_width, `stroke_width`) }

  // Once the path is built: what it was built from, and the shape's anchor and
  // corner radius, which mean nothing on a <path>
  protected dropPathParams() {
    for (const name of PATH_PARAMS) delete this.params[name]
  }

  // Hide the markers while the line is being drawn
  protected noteDrawProgress() {
    const progress = this.params.draw_progress
    this.hideMarkers = progress !== undefined && progress < 1
  }

  private buildGroup() {
    const id = this.node?.attrs["data-jp-id"]
    const strokeColor = String(this.svgAttrs.stroke || 'currentColor')
    const groupAttrs: SvgAttrs = {}
    if (this.svgAttrs.transform) {
      groupAttrs.transform = this.svgAttrs.transform
      delete this.svgAttrs.transform
    }
    if (this.svgAttrs.opacity !== undefined) {
      groupAttrs.opacity = this.svgAttrs.opacity
      delete this.svgAttrs.opacity
    }
    const lineNode = svgNode('path', this.svgAttrs)
    const markerNodes = this.buildMarkers(strokeColor)
    this.node = svgNode('g', groupAttrs, [lineNode, ...markerNodes])
    if (id !== undefined) this.node.attrs["data-jp-id"] = id
  }

  private buildMarkers(strokeColor: string): SvgNode[] {
    if (this.hideMarkers) { this.pendingMarkers = []; return [] }
    const nodes = this.pendingMarkers.map(d => {
      if (this.strokeSlot) {
        addUsedSlot('fill', this.strokeSlot)
        const cssSlot = this.strokeSlot.replace(':', '-')
        return svgNode('path', { d, stroke: 'none', class: `pj-fill-${cssSlot}` })
      }
      return svgNode('path', { d, fill: strokeColor, stroke: 'none' })
    })
    this.pendingMarkers = []
    return nodes
  }

  rerender(position: RenderParameters, attrs: Shape.Args) {
    this.pendingMarkers = []
    this.svgAttrs = toSvgAttrNames(this.convertToSVG(position, attrs))
    this.buildGroup()
    return this
  }

  requiredPosition() {
    return null
  }

  markerPath(type: string, pos: XY, dir: LineDirection, angle: number) {
    switch (type) {
      case `<`:
      case `>`:
        return this.arrowMarkerPath(pos, dir, angle)

      case `o`:
        return this.circleMarkerPath(pos, dir, angle)

      case `|`:
        return this.barMarkerPath(pos, dir, angle)

      default:
        throw new Error(`Invalid line end "${type}"`)
    }
  }

  arrowMarkerPath(pos: XY, dir: LineDirection, angle: number) {
    const stroke_width = this.strokeWidth
    const { length: w, halfWidth: w_2 } = arrowDimensions(stroke_width)

    const basex = pos.x - dir * w * Math.cos(angle)
    const basey = pos.y - dir * w * Math.sin(angle)

    const base1x = basex + dir * w_2 * Math.sin(angle)
    const base1y = basey - dir * w_2 * Math.cos(angle)

    const base2x = basex - dir * w_2 * Math.sin(angle)
    const base2y = basey + dir * w_2 * Math.cos(angle)

    const pointx = pos.x - dir * 1.5 * stroke_width * Math.cos(angle)
    const pointy = pos.y - dir * 1.5 * stroke_width * Math.sin(angle)

    pos.x = basex
    pos.y = basey

    return `M ${base1x} ${base1y} L ${pointx} ${pointy} L ${base2x} ${base2y} Z`
  }

  circleMarkerPath(pos: XY, dir: LineDirection, angle: number) {
    const { length: w } = arrowDimensions(this.strokeWidth)
    const radius = w / 2

    const basex = pos.x - dir * w * Math.cos(angle)
    const basey = pos.y - dir * w * Math.sin(angle)

    const ex = pos.x
    const ey = pos.y

    pos.x = basex
    pos.y = basey

    return `M ${basex} ${basey} A ${radius} ${radius} 0 1 0 ${ex} ${ey}` +
      `A ${radius} ${radius} 0 1 0 ${basex} ${basey}`
  }

  barMarkerPath(pos: XY, dir: LineDirection, angle: number) {
    const stroke_width = this.strokeWidth
    const { length: w, halfWidth: w_2 } = arrowDimensions(stroke_width)

    const basex = pos.x - dir * w * Math.cos(angle)
    const basey = pos.y - dir * w * Math.sin(angle)

    const base1x = basex + dir * w_2 * Math.sin(angle)
    const base1y = basey - dir * w_2 * Math.cos(angle)

    const base2x = basex - dir * w_2 * Math.sin(angle)
    const base2y = basey + dir * w_2 * Math.cos(angle)

    pos.x = basex
    pos.y = basey

    return `M ${base1x} ${base1y} L ${base2x} ${base2y}`
  }
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined)
    throw new Error(`internal error: a line has no ${name}`)
  return value
}
