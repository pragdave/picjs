import { RTE } from "./runtime_error.js"
import * as AST from "./ast.js"
import { Location } from "./location.js"


export abstract class Visitor {


  lastLocation?: Location
  private stepCount = 0
  private stepLimit = 500_000
  private cancelled = false

  cancel() {
    this.cancelled = true
  }

  setStepLimit(limit: number) {
    this.stepLimit = limit
  }

  start(tree: AST.Node) {
    return this.accept(tree) ?? null
  }

  accept(tree: AST.Node) {
    if (!tree)
      throw new Error(`internal error: asked to evaluate a missing syntax tree node`)

    if (this.cancelled)
      throw new RTE(`execution cancelled`)

    if (++this.stepCount > this.stepLimit)
      throw new RTE(`execution exceeded ${this.stepLimit.toLocaleString()} steps — possible infinite loop or very deep recursion`)

    const type = tree.type

    if (tree.location)
      this.lastLocation = tree.location

    // Each kind of node has a method named Visit<type>, found by name here
    const visit = (this as unknown as Record<string, unknown>)[`Visit${type}`]
    if (typeof visit !== `function`)
      return this.error(tree)
    return visit.call(this, tree)
  }

  error(tree: AST.Node): never {
    throw new Error(`internal error: no visitor for syntax tree nodes of type "${tree.type}"`)
  }
}
