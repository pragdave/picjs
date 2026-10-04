import { TA, TNumber } from "../../src/types.js"
import { valueOf } from "../helpers/eval.js"

function t(ip: string, expected: TA) {
  it(ip, () => {
  const result = valueOf(ip)
  expect(result.value).toEqual(expected.value)
  })
}

function n(val: number) {
  return new TNumber(val)
}


describe(`function call`, () => {

  describe(`(built in`, () => {
    t(`[1 2 3].pop()`,    n(3))
    t(`[1 2 3]["pop"]()`, n(3))
  })

  describe(`(with no parameters`, () => {
    t(`f = => 123  f()`, n(123))
    t(`f = () => 123  f()`, n(123))
  })

  describe(`(with one parameter in`, () => {
    t(`f = a => a + 123  f(27)`, n(150))
    t(`f = (a) => a + 123  f(-23)`, n(100))
  })

  describe(`(with three parameters`, () => {
    t(`f = (a, b, c) => a + b * c  f(1, 2, 3)`, n(7))
    t(`f = (a b c) => a + b * c  f(1, 2, 3)`, n(7))

  })

  describe(`of something that isn't a function`, () => {
    it.each([
      [`a number`,          `x = 3  x()`,        /only call a function.*3/],
      [`a shape attribute`, `b = Box  b.fill()`, /only call a function/],
    ])(`(%s) is an error`, (_name, src, message) => {
      expect(() => valueOf(src)).toThrow(message)
    })
  })
})
