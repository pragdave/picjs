import { existsSync, readdirSync, readFileSync } from "fs"
import { resolve } from "path"
import * as source from "../../src/index.js"
import { ParseStatus } from "../../src/parser.js"

// The built library is minified, which renames classes, so anything that
// depends on a class's name works from the source but breaks once built.
// Every example must render, and build its timeline, the same through
// dist/picjs.js as through the source. Needs a build first (`npm run build`).

type Library = typeof source

const examples = resolve(process.cwd(), `examples`)
const bundle = resolve(process.cwd(), `dist`, `picjs.js`)

const names = readdirSync(examples).filter(f => f.endsWith(`.picjs`)).sort()
const exampleSource = (name: string) => readFileSync(resolve(examples, name), `utf8`)

// run a program, returning its timeline and what it logged
function run(library: Library, src: string) {
  const parsed = library.parse(src)
  if (parsed.status !== ParseStatus.Ok) throw new Error(String(parsed.error))
  const logged: string[] = []
  const dispatcher = library.createRunner((_loc, value) => logged.push(value), null, 1)
  dispatcher.start(parsed.ast)
  const timeline = (dispatcher as unknown as { timeline: { asArray(): unknown } }).timeline.asArray()
  return { timeline, logged }
}

describe(`the built library`, () => {
  let built: Library

  beforeAll(async () => {
    if (!existsSync(bundle))
      throw new Error(`${bundle} not found: run \`npm run build\` before the tests`)
    built = await import(bundle)
  })

  it.each(names)(`renders %s the same as the source`, name => {
    const src = exampleSource(name)
    const options = { includeSource: false }
    expect(built.renderToString(src, options)).toEqual(source.renderToString(src, options))
  })

  it.each(names)(`builds the same timeline for %s as the source`, name => {
    const src = exampleSource(name)
    expect(run(built, src).timeline).toEqual(run(source, src).timeline)
  })

  it(`inspects a shape the same as the source`, () => {
    const src = `b = Box\n?? b`
    const fromBuilt = run(built, src).logged
    expect(fromBuilt).toEqual(run(source, src).logged)
    expect(fromBuilt[0]).toMatch(/^Box\t\tattrs: /)
  })
})
