// RegenerateSource turns a syntax tree back into source, for `??` to show
// what it is inspecting.

import { ParseStatus } from "../../src/parser.js"
import { parseToMockAST } from "../helpers/ast.js"
import { RegenerateSource } from "../../src/regenerate_source.js"

// `??` regenerates a single expression; `rule` = `Program` for a whole program
function regenerate(src: string, rule = `Expression`) {
  const parsed = parseToMockAST(rule, src)
  if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
  return new RegenerateSource().convert(parsed.ast)
}

describe(`regenerating source`, () => {
  it.each([
    [`a + 1`,                   `a + 1`],
    [`(a + b) * c`,             `(a + b) * c`],
    [`a + b * c`,               `a + (b * c)`],
    [`-a`,                      `-a`],
    [`if (a) { 1 } else { 2 }`, `if (a) { 1 } else { 2 }`],
    [`(x) => x + 1`,            `(x) => x + 1`],
    [`?? a`,                    `?? a`],
    [`a.n`,                     `a.n`],
    [`f(1, 2)`,                 `f(1, 2)`],
    [`last box.n`,              `last Box.n`],
  ])(`of an expression: %s`, (src, expected) => {
    expect(regenerate(src)).toBe(expected)
  })

  it.each([
    [`~red`,                    `~red`],
    [`#336699`,                 `#336699`],
    [`rgb(1, 2, 3)`,            `rgb(1, 2, 3)`],
  ])(`of a color: %s`, (src, expected) => {
    expect(regenerate(src)).toBe(expected)
  })

  it.each([
    [`Box`,                     `Box`],
    [`Box fill ~red`,           `Box fill ~red`],
    [`Box "Hi" fill ~red`,      `Box "Hi" fill ~red`],
    [`Box ("A") ("B")`,         `Box "A" "B"`],
    [`Box same`,                `Box same`],
    [`Box behind b`,            `Box behind b`],
    [`line from a to b "mid"`,  `Line from a to b "mid"`],
    [`line -> from a to b`,     `Line -> from a to b`],
    [`line <~ from a to b`,     `Line <~ from a to b`],
    [`line from a then b then c`, `Line from a then b then c`],
    [`Box wid 2 at (1, 1)`,     `Box width 2 at (1, 1)`],
    [`Box with .nw at a.se`,    `Box with .nw at a.se`],
    [`Label "x" .h1`,           `Label .h1 "x"`],
  ])(`of a shape: %s`, (src, expected) => {
    expect(regenerate(src)).toBe(expected)
  })

  it(`of a block keeps every statement`, () => {
    expect(regenerate(`f = (a) => { b = a\n b + 1 }`)).toBe(`f = (a) => {\n  b = a\n  b + 1\n}`)
  })

  it(`shows what it has no rule for, rather than failing`, () => {
    expect(regenerate(`move a to (1, 2)`)).toBe(`«MoveTo»`)
  })

  it(`of a program`, () => {
    expect(regenerate(`a = 1\nb = 2`, `Program`)).toBe(`a = 1\nb = 2`)
  })
})
