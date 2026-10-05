// A shape's arguments may continue onto the following lines, so where they
// end matters: they must not run on into the statements after them.

import { newDispatcher } from "../helpers/eval.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse } from "../../src/peg_parser/jp.js"

function variables(src: string, ...names: string[]) {
  const parsed = parseToAST(parse, src, `Start`, false)
  if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
  const dispatcher = newDispatcher()
  dispatcher.start(parsed.ast)
  const binding = dispatcher.getCurrentBinding()
  return names.map(name => binding.get_variable_value(name).toNative())
}

describe(`a shape's size, width x height`, () => {
  it.each([
    [`Box 2 x 3`,      `b = Box 2 x 3`],
    [`Box 2x3`,        `b = Box 2x3`],
    [`Box 2 × 3`,      `b = Box 2 × 3`],
    [`Box w x h`,      `w = 2\nh = 3\nb = Box w x h`],
    [`Box w*1 x h+0`,  `w = 2\nh = 3\nb = Box w*1 x h+0`],
  ])(`%s sets the width and height`, (_name, src) => {
    expect(variables(`${src}\nwd = b.width\nht = b.height`, `wd`, `ht`)).toEqual([2, 3])
  })

  it.each([
    [`a shape, then a line starting with x`,   `a = Box\nb = Box\nxs = 100`],
    [`a value, then a line starting with x`,   `a = Box\nb = 3\nxs = 100`],
  ])(`doesn't take %s`, (_name, src) => {
    expect(variables(src, `b`, `xs`)[1]).toBe(100)
  })

  it(`still lets a shape's arguments continue on the next line`, () => {
    expect(variables(`b = Box\n  wid 2\n  ht 3\nwd = b.width\nht = b.height`, `wd`, `ht`)).toEqual([2, 3])
  })
})

describe(`a label's font family`, () => {
  const font = (spec: string, after = ``) =>
    variables(`l = Label "x" font ${spec}\n${after}\nfam = l.font.family`, `fam`)[0]

  it.each([
    [`one word`,             `24pt Georgia`,                 `Georgia`],
    [`several words`,        `24pt Times New Roman`,         `Times New Roman`],
    [`a list`,               `24pt Georgia, serif`,          `Georgia, serif`],
    [`a quoted name`,        `24pt "Times New Roman"`,       `"Times New Roman"`],
    [`after style and size`, `italic bold 24pt/2 Georgia`,   `Georgia`],
  ])(`can be %s`, (_name, spec, family) => {
    expect(font(spec)).toBe(family)
  })

  it(`ends at the next attribute`, () => {
    const [family, fill] = variables(
      `l = Label "x" font italic 24pt Georgia fill ~red\nfam = l.font.family\nf = l.fill`, `fam`, `f`)
    expect(family).toBe(`Georgia`)
    expect(String(fill)).toMatch(/ff0000|red/)
  })

  it(`ends at the end of the line`, () => {
    expect(variables(`l = Label "x" font 24pt Georgia\nserif = 3\nfam = l.font.family`, `fam`, `serif`))
      .toEqual([`Georgia`, 3])
  })
})
