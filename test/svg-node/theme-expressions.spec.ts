import { applyArithmetic, evaluateThemeExpression, Defaults, getThemeValue } from "../../src/defaults.js"

// Theme expressions such as `=FS*4.5` used to be evaluated with Function(),
// which throws on import under a Content-Security-Policy without
// 'unsafe-eval'. They now go through a tiny left-to-right evaluator.

describe(`applyArithmetic`, () => {
  it.each([
    [`*4.5`, 0.14 * 4.5],
    [`*3`,   0.14 * 3],
    [`*2`,   0.14 * 2],
    [`*1.5`, 0.14 * 1.5],
    [`*0.5`, 0.14 * 0.5],
  ])(`evaluates the default expression %s`, (tail, expected) => {
    expect(applyArithmetic(0.14, tail)).toBe(expected)
  })

  it(`handles each operator`, () => {
    expect(applyArithmetic(10, `+2`)).toBe(12)
    expect(applyArithmetic(10, `-2`)).toBe(8)
    expect(applyArithmetic(10, `*2`)).toBe(20)
    expect(applyArithmetic(10, `/4`)).toBe(2.5)
  })

  it(`chains terms left to right`, () => {
    expect(applyArithmetic(1, `+2*3`)).toBe(9)
    expect(applyArithmetic(10, `/2-1*4`)).toBe(16)
    expect(applyArithmetic(1, ` * 2 + .5 `)).toBe(2.5)
  })

  it(`returns the base unchanged for an empty tail`, () => {
    expect(applyArithmetic(0.14, ``)).toBe(0.14)
    expect(applyArithmetic(0.14, `  `)).toBe(0.14)
  })

  it.each([
    `4.5`,           // no operator
    `*`,             // no operand
    `**2`,           // doubled operator
    `*2x`,           // trailing junk
    `*(2)`,          // parentheses
    `*2;alert(1)`,   // code
    `%2`,            // unsupported operator
  ])(`throws on malformed tail %p`, tail => {
    expect(() => applyArithmetic(1, tail)).toThrow(/Invalid theme expression/)
  })
})

describe(`evaluateThemeExpression`, () => {
  it(`keeps the base value's unit suffix`, () => {
    expect(evaluateThemeExpression(`2em`, `*3`)).toBe(`6em`)
    expect(evaluateThemeExpression(`-1.5px`, `*2`)).toBe(`-3px`)
  })

  it(`works on bare numbers`, () => {
    expect(evaluateThemeExpression(1, `*0.5`)).toBe(`0.5`)
    expect(evaluateThemeExpression(1, ``)).toBe(`1`)
  })

  it(`throws when the base has no number`, () => {
    expect(() => evaluateThemeExpression(`auto`, `*2`)).toThrow(/can't find a number/)
  })
})

describe(`built-in shape defaults`, () => {
  it(`resolve their theme expressions`, () => {
    const fs = getThemeValue(`FS`) as number
    const labels = Defaults.Shapes.SLabel
    expect(labels[`.h1`].font_size).toBe(`${fs * 4.5}`)
    expect(labels[`.h2`].font_size).toBe(`${fs * 3}`)
    expect(labels[`.h3`].font_size).toBe(`${fs * 2}`)
    expect(labels[`.h4`].font_size).toBe(`${fs * 1.5}`)

    const ellipse = Defaults.Shapes.SEllipse[`.normal`]
    expect(ellipse.rx).toBe(`${(getThemeValue(`ShapeWidth`) as number) * 0.5}`)
    expect(ellipse.ry).toBe(`${(getThemeValue(`ShapeHeight`) as number) * 0.5}`)
  })
})
