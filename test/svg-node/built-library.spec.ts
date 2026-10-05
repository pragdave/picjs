import { existsSync, readdirSync, readFileSync } from "fs"
import { resolve } from "path"
import { renderToString } from "../../src/index.js"

// The built library is minified, which renames classes, so anything that
// depends on a class's name works from the source but breaks once built.
// Every example must render the same through dist/picjs.js as through the
// source. Needs a build first (`npm run build`).

const examples = resolve(process.cwd(), `examples`)
const bundle = resolve(process.cwd(), `dist`, `picjs.js`)

const names = readdirSync(examples).filter(f => f.endsWith(`.picjs`)).sort()

describe(`the built library`, () => {
  let built: { renderToString: typeof renderToString }

  beforeAll(async () => {
    if (!existsSync(bundle))
      throw new Error(`${bundle} not found: run \`npm run build\` before the tests`)
    built = await import(bundle)
  })

  it.each(names)(`renders %s the same as the source`, name => {
    const src = readFileSync(resolve(examples, name), `utf8`)
    const fromBuilt = built.renderToString(src, { includeSource: false })
    const fromSource = renderToString(src, { includeSource: false })
    expect(fromBuilt).toEqual(fromSource)
  })
})
