// Checking the arguments a native function is called with. User code can pass
// any value, so each of these returns the argument as the type the function
// needs, or reports clearly that it is something else.

import { RTE } from "../runtime_error.js"
import type { TA } from "./_base.js"
import { TNumber } from "./tnumber.js"
import { TString } from "./tstring.js"
import { TFunction } from "./tfunction.js"
import { TNative } from "./tnative.js"

export function numberArgument(fn: string, name: string, value: TA | undefined): number {
  if (value instanceof TNumber)
    return value.value
  throw wrongArgument(fn, name, `a number`, value)
}

export function stringArgument(fn: string, name: string, value: TA | undefined): string {
  if (value instanceof TString)
    return value.value
  throw wrongArgument(fn, name, `a string`, value)
}

export function functionArgument(fn: string, name: string, value: TA | undefined): TFunction | TNative {
  if (value instanceof TFunction || value instanceof TNative)
    return value
  throw wrongArgument(fn, name, `a function`, value)
}

function wrongArgument(fn: string, name: string, needed: string, value: TA | undefined) {
  const given = value === undefined ? `nothing` : value.nameForErrors()
  return new RTE(`${fn} needs ${needed} for its ${name}, but was given ${given}`)
}
