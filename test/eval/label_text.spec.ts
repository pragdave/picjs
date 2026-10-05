// A label's text can be any value that a string can hold, given in the label
// (`Box (n)`) or assigned later (`l.text = n`). It reads as it would in a
// string, "#{n}".

import { renderToString } from "../../src/index.js"

const render = (src: string) => {
  const result = renderToString(src, { includeSource: false })
  if (result.error) throw new Error(result.error)
  return result.svg
}

describe(`a label's text`, () => {
  it.each([
    [`a number`,         `Box (3)`,                    `Box ("3")`],
    [`a variable`,       `w = 3\nBox (w)`,             `Box ("3")`],
    [`a position`,       `Box ((1, 2))`,               `Box ("(1, 2)")`],
    [`a list`,           `Box ([1, "a"])`,             `Box ("[ 1, a ]")`],
    [`a number, with a size`, `Box (3 large)`,         `Box ("3" large)`],
  ])(`given in the label can be %s`, (_name, src, same) => {
    expect(render(src)).toEqual(render(same))
  })

  it.each([
    [`a number`,         `l.text = 3`,                 `l.text = "3"`],
    [`a position`,       `l.text = (1, 2)`,            `l.text = "(1, 2)"`],
  ])(`assigned can be %s`, (_name, assigned, same) => {
    expect(render(`l = Label "x"\n${assigned}`)).toEqual(render(`l = Label "x"\n${same}`))
  })

  it.each([
    [`given in the label`, `b = Box\nBox (b)`],
    [`assigned`,           `b = Box\nl = Label "x"\nl.text = b`],
  ])(`can't be a shape, %s`, (_name, src) => {
    expect(() => render(src)).toThrow(/A string can't contain a shape, but this is a Box/)
  })
})
