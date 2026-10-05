import type { Location } from "./location.js"
import {parse, createRunner } from "./index.js"

function logger(loc: Location | undefined, result: string, src?: string) {
  const line = loc?.start?.line ?? `?`
  const col = loc?.start?.column ?? `?`
  if (src) {
    console.log(`%c${line}:${col}» %c${src} = %c${result.toString()}`,
      `color: gray;`, `color: darkseagreen;`, `font-weight: bold; color: darkgreen;`)
  }
  else {
    console.log(`%c${line}:${col}» %c${result.toString()}`,
      `color: gray;`, `color: forestgreen;`)
  }
}

const program = process.argv[2]
console.log(program)
const ast = parse(program)

console.log(ast.status)

if (ast.status === `ok`) {
  console.log(JSON.stringify(ast.ast, null, 4))
  const runner = createRunner(logger, null, 1)
  const result = runner.start(ast.ast)
  console.log(`result = `, result)
}

