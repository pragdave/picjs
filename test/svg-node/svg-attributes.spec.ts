// A renderer turns a shape's parameters into SVG attributes. Parameters that
// aren't SVG (fit, a polyline's corner radius, a circle's anchor) must not be
// passed through: browsers ignore them, but they are noise in the output, and
// a non-SVG value such as fit="true" is a sign something was forgotten.

import { readdirSync, readFileSync } from "fs"
import { resolve } from "path"
import { renderToString } from "../../src/index.js"

const PRESENTATION = [`class`, `fill`, `opacity`, `stroke`, `stroke-dasharray`, `stroke-dashoffset`,
                      `stroke-width`, `transform`, `data-jp-id`, `id`]

const ALLOWED: Record<string, string[]> = {
  svg:     [`xmlns`, `viewBox`, `class`, `width`, `height`, `style`],
  g:       PRESENTATION,
  rect:    [...PRESENTATION, `x`, `y`, `width`, `height`, `rx`, `ry`],
  circle:  [...PRESENTATION, `cx`, `cy`, `r`],
  ellipse: [...PRESENTATION, `cx`, `cy`, `rx`, `ry`],
  path:    [...PRESENTATION, `d`, `pathLength`],
  text:    [...PRESENTATION, `x`, `y`, `dominant-baseline`, `text-anchor`, `font-family`, `font-size`,
            `font-stretch`, `font-style`, `font-variant`, `font-weight`],
  tspan:   [`x`, `dy`, `font-weight`, `font-style`],
  a:       [`href`],
}

const examples = resolve(process.cwd(), `examples`)
const programs: [string, string][] = [
  ...readdirSync(examples).filter(f => f.endsWith(`.picjs`)).sort()
    .map((f): [string, string] => [f, readFileSync(resolve(examples, f), `utf8`)]),
  [`a box that fits its label`,  `Box "hello there friends" fit`],
  [`a rounded polyline`,         `Line from (0, 0) then to (1, 0) then to (1, 1) rx 0.2`],
  [`an arc`,                     `Arc cw "label"`],
  [`a dotted circle`,            `Circle radius 0.3 opacity 0.5 dotted`],
  [`an ellipse`,                 `Ellipse`],
  [`a label`,                    `Label "**bold** [link](https://example.com)" maxwidth 2 align .w`],
]

describe(`rendered elements`, () => {
  it.each(programs)(`have only SVG attributes: %s`, (_name, src) => {
    const { svg, error } = renderToString(src, { includeSource: false })
    expect(error).toBeUndefined()
    const stray: string[] = []
    for (const [, tag, attrs] of svg.matchAll(/<(\w+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g)) {
      for (const [, name] of attrs.matchAll(/\s([\w:-]+)=/g))
        if (!(ALLOWED[tag] ?? []).includes(name)) stray.push(`<${tag} ${name}>`)
    }
    expect([...new Set(stray)]).toEqual([])
  })
})
