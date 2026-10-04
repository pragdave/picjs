import {parse, createRunner } from "./index.js"

function logger(loc: any, result: any, src: any) {
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
  const runner = createRunner(logger, null as unknown as SVGElement, 1)
  const result = runner.start(ast.ast)
  console.log(`result = `, result)
}

