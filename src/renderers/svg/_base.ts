import { SvgAttrs, SvgNode, svgNode } from "../../svg-node.js"
import * as Shape from "../../shapes.js"
import { RenderParameters     } from "../../types.js"

// A step or a curve needs both an x and a y component; below this the endpoints
// are effectively on one axis and the detour would just add duplicate points.
// Diagram units, where a default Box is 1 wide.
export const MIN_STEP_OFFSET = 0.05

export type LineDirection = -1 | 1

// A renderer turns a shape's parameters (Shape.Args) into an SVG element.
// convertToSVG converts the parameters to SVG's; toSvgAttrNames then makes them
// the element's attributes.
export class SvgBase {

  position: RenderParameters
  svgAttrs: SvgAttrs
  node!: SvgNode

  constructor(position: RenderParameters, attrs: Shape.Args) {
    this.position = position
    this.svgAttrs = toSvgAttrNames(this.convertToSVG(position, attrs))
  }


  rerender(position: RenderParameters, attrs: Shape.Args) {
    const id = this.node?.attrs["data-jp-id"]
    this.position = position
    this.svgAttrs = toSvgAttrNames(this.convertToSVG(position, attrs))
    this.node = svgNode(this.node.tag, this.svgAttrs)
    if (id !== undefined) this.node.attrs["data-jp-id"] = id
    return this
  }

  build(tag: string) {
    this.node = svgNode(tag, this.svgAttrs)
  }

  convertToSVG(_position: RenderParameters, _attrs: Shape.Args): Shape.Args {
    throw new Error(`renderer class is missing "convertToSVG"`)
  }

  // Apply draw animation: uses pathLength=1 so stroke-dashoffset ranges over [0,1].
  // Call this AFTER linestyle conversion and path computation.
  protected applyDrawProgress(attrs: Shape.Args) {
    const drawProgress = attrs.draw_progress
    delete attrs.draw_progress

    if (typeof drawProgress === `number` && drawProgress < 1) {
      attrs.pathLength = 1
      if (drawProgress <= 0) {
        // Zero-length dash + full gap: nothing visible, no browser rounding artifacts
        attrs[`stroke_dasharray`] = `0 1`
        attrs[`stroke_dashoffset`] = 0
      } else {
        attrs[`stroke_dasharray`] = 1
        attrs[`stroke_dashoffset`] = 1 - drawProgress
      }
    }
  }
}

// Tracks which palette slots are used in the current render pass
let _usedSlots: Set<string> = new Set()

export function resetUsedSlots() { _usedSlots = new Set() }
export function getUsedSlots(): Set<string> { return _usedSlots }
export function addUsedSlot(attr: string, slot: string) { _usedSlots.add(`${attr}:${slot}`) }

const SLOT_COLOR_ATTRS = new Set(['fill', 'stroke'])

// The element's attributes: underscores in names become hyphens, slotted
// colors become CSS classes, and internal (_) entries are dropped
export function toSvgAttrNames(attrs: Shape.Args): SvgAttrs {
  const result: SvgAttrs = {}
  const classes: string[] = []

  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('_') && k.endsWith('_slot') && typeof v === `string`) {
      const attrName = k.slice(1, -5) // _fill_slot → fill
      if (SLOT_COLOR_ATTRS.has(attrName)) {
        const cssSlot = v.replace(':', '-')
        classes.push(`pj-${attrName}-${cssSlot}`)
        _usedSlots.add(`${attrName}:${v}`)
        continue
      }
    }
    if (k.startsWith('_')) continue // strip remaining internal fields
    const value = svgValue(k, v)
    if (value !== undefined) result[k.replace(/_/g, '-')] = value
  }

  // If we have slot classes, remove the inline color and add the class
  for (const cls of classes) {
    const attr = cls.startsWith('pj-fill-') ? 'fill' : 'stroke'
    delete result[attr]
    result.class = result.class ? `${result.class} ${cls}` : cls
  }

  return result
}

// An attribute's value as SVG writes it. A list is written as SVG lists are
// (stroke-dasharray); anything else that isn't a string or number means a
// renderer passed on a parameter that isn't an SVG attribute.
function svgValue(name: string, value: unknown): string | number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === `string` || typeof value === `number`) return value
  if (Array.isArray(value) && value.every(v => typeof v === `number`)) return value.join(`,`)
  throw new Error(`internal error: the SVG attribute "${name}" can't be ${JSON.stringify(value)}`)
}

export function arrowDimensions(strokeWidth: number) {
  const ratio = strokeWidth <= 0.05 ? 2
              : strokeWidth >= 0.25 ? 0.7
              : 2 - 6.5 * (strokeWidth - 0.05)
  const width = ratio * strokeWidth * 1.5
  const length = 1.8 * width
  return { length, halfWidth: width / 2 }
}
