import { TA, TNative, TNumber, TPosition } from "./types.js"
import { TPalette } from "./types/tpalette.js"
import { TLayout } from "./types/tlayout.js"
import { numberArgument } from "./types/arguments.js"

const D2R = 2*Math.PI/360.0
const R2D = 1 / D2R
  

// sin, cos and tan take an angle in degrees
function trigFunction(name: string, fullName: string, fn: (radians: number) => number) {
  return new TNative(name, [`angle-in-degrees`],
    `return the ${fullName} of the given angle (in degrees)`,
    (_, angle) => new TNumber(fn(numberArgument(name, `angle`, angle) * D2R)))
}

// asin and acos return an angle in degrees
function arcFunction(name: string, inverseOf: string, fn: (ratio: number) => number) {
  return new TNative(name, [`ratio`],
    `return the angle (in degrees) whose ${inverseOf} is _ratio_`,
    (_, ratio) => new TNumber(fn(numberArgument(name, `ratio`, ratio)) * R2D))
}


export const BuiltinConstants: {[name: string]: TA} = {
  PI: new TNumber(Math.PI),
  Palette: new TPalette(),
}

export const BuiltinFunctions: {[name: string]: TNative} = {
  //---------------------------------------------------------------------- layout
  layout: new TNative(`layout`, [`fn`],
    `position shapes with fn now, and animate them to fn's new positions on each .step()`,
    (interpreter, fn) => new TLayout(interpreter, fn)),

  //---------------------------------------------------------------------- d2r
  d2r: new TNative(`d2r`, [`degrees`],
    `convert degrees to radians`,
    (_, degrees) => new TNumber(numberArgument(`d2r`, `degrees`, degrees) * D2R)),

  //---------------------------------------------------------------------- r2d
  r2d: new TNative(`r2d`, [`radians`],
    `convert radians to degrees`,
    (_, radians) => new TNumber(numberArgument(`r2d`, `radians`, radians) * R2D)),

  //---------------------------------------------------------------------- trigonometry
  sin:  trigFunction(`sin`, `sine`, Math.sin),
  cos:  trigFunction(`cos`, `cosine`, Math.cos),
  tan:  trigFunction(`tan`, `tangent`, Math.tan),
  asin: arcFunction(`asin`, `sine`, Math.asin),
  acos: arcFunction(`acos`, `cosine`, Math.acos),

  //---------------------------------------------------------------------- atan2
  atan2: new TNative(`atan2`, [`dy`, `dx`],
    `return the angle (in degrees) between the x-axis and the point (dx,dy). ` +
    `(note the parameter order: y, x, not x, y)`,
    (_, dy, dx) => {
      const y = numberArgument(`atan2`, `dy`, dy)
      const x = numberArgument(`atan2`, `dx`, dx)
      return new TNumber(Math.atan2(y, x) * R2D)
    }),

  //---------------------------------------------------------------------- polar
  polar: new TNative(`polar`, [`radius`, `theta`],
    `return the position of the point "radius" away from the origin along a line ` +
    `at angle "theta" (degrees)`,
    (_, radius, theta) => {
      const r = numberArgument(`polar`, `radius`, radius)
      const angle = numberArgument(`polar`, `theta`, theta) * D2R
      return new TPosition(r * Math.cos(angle), r * Math.sin(angle))
    }),

  //---------------------------------------------------------------------- ln
  ln: new TNative(`ln`, [`number`],
    `return the natural logarithm of number`,
    (_, number) => new TNumber(Math.log(numberArgument(`ln`, `number`, number)))),

  //---------------------------------------------------------------------- log10
  log10: new TNative(`log10`, [`number`],
    `return the logarithm (base 10) of number`,
    (_, number) => new TNumber(Math.log10(numberArgument(`log10`, `number`, number)))),

}


// max
// min
// sum
// mean

