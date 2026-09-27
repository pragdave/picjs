import { existsSync, readFileSync } from "fs"
import { resolve } from "path"

// picjs must load under a Content-Security-Policy without 'unsafe-eval'
// (WebViews, extensions, Electron, CSP-locked sites). Any Function(...) or
// eval(...) in the shipped bundles breaks that, so fail if one appears.
// Needs a build first (`npm run build`); callFunction(), easingFunction()
// and the like don't match because of the lookbehind.

const DYNAMIC_CODE = /(?<![\w$])(?:Function|eval)\s*\(/

const bundles = [`picjs.js`, `runtime.js`, `picjs.umd.js`, `picjs.runtime.umd.js`]

describe(`built bundles`, () => {
  it.each(bundles)(`dist/%s contains no Function( or eval(`, name => {
    const path = resolve(process.cwd(), `dist`, name)
    if (!existsSync(path))
      throw new Error(`${path} not found: run \`npm run build\` before the tests`)
    const match = readFileSync(path, `utf8`).match(DYNAMIC_CODE)
    expect(match?.[0]).toBeUndefined()
  })
})
