// A mixin that gives a collection first(), last(), each() and map(). Each
// iterates from first_index() to last_index() in steps of default_step(), or
// of a step it's given; a step below 1 interpolates, from at(0) to at(1).

import { RTE } from "../runtime_error.js"
import { TList } from "./tlist.js"
import { TNative } from "./tnative.js"
import { TNumber } from "./tnumber.js"
import { TA, TBase } from "../types.js"
import { Interpreter } from "../interpreter.js"
import { functionArgument } from "./arguments.js"

const EachMsg = `.each() and map() take a optional step value and a required callback function`

type IterableCallback = (thisBeingIterated:TA, step: number) => void

// each and map take an optional step before the callback
function stepAndCallback(fn: string, args: TA[]) {
  const [ step, callback ] = args.length > 1 ? args : [ undefined, args[0] ]
  return { step, callback: functionArgument(fn, `callback`, callback) }
}

// What a collection provides to mix this in
export interface IterableHost extends TBase<unknown> {
  at(index: number): TA
  first_index(): number
  last_index(): number
  default_step(): number
}

export function addToAttrs(host: IterableHost) {
  host.attrs.first = new TNative(`first`, [],
    `return the first item in this collection or range`,

    (_interpreter) => {
      return host.at(host.first_index())
    })

  host.attrs.last = new TNative(`last`, [],
    `return the last item in host collection or range`,

    (_interpreter) => {
      return host.at(host.last_index())
    })


  function iterate(host: IterableHost, _interpreter: Interpreter, requestedStep: TA | undefined, callback: IterableCallback) {
    let step
    if (requestedStep) {
      if (requestedStep instanceof TNumber) {
        step = requestedStep.toNative()
      }
      else {
        throw new RTE(EachMsg + ` (it looks as if the step value is not a number)`)
      }
    }
    else {
      step = host.default_step()
    }

    if (step <= 0)
      throw new RTE(`the step value must be greater than zero`)

    if (step >= 1 && !(Number.isInteger(step)))
      throw new RTE(`A step value of 1 or more must be an integer`)

    let start, end

    if (step < 1) {
      start = 0.0
      end = 1.000001   // allow for errors as we accumulate i in the loop
    }
    else {
      start = host.first_index()
      end = host.last_index()
    }

    for (let i = start, n = 0; i <= end; i += step, n++) {
      callback(host.at(i), n)
    }
  }

  host.attrs.each = new TNative(`each`, [ `[step]`, `callback` ],
    `invoke 'callback' with each item in turn. The optional step ` +
    `allows you to select each nth item. It 0.0 < step < 1.0, then ` +
    `we do interpolation`,
    (interpreter, ...args) => {
      const { step, callback } = stepAndCallback(`each`, args)
      iterate(host, interpreter, step, (value, index) => {
        interpreter.callFunction(callback, [ value, new TNumber(index) ])
      })

      return host
    })


  host.attrs.map = new TNative(`map`, [ `[step]`, `callback` ],
    `invoke 'callback' with each item in turn, and collect ` + 
    `the results into a list, which we return. The optional step ` +
    `allows you to select each nth item. It 0.0 < step < 1.0, then ` +
    `we do interpolation`,

    (interpreter, ...args) => {
      const { step, callback } = stepAndCallback(`map`, args)
      const result: TA[] = []

      iterate(host, interpreter, step, (value, index) => {
        result.push(interpreter.callFunction(callback, [ value, new TNumber(index) ]))
      })

      return new TList(result)
    })
}
