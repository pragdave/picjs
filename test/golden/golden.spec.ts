// Golden-file tests: every diagram in examples/, docs/ and the README is
// rendered and compared against a stored snapshot. For animated diagrams we
// also snapshot the timeline and the rendered frame at every animation boundary
// and midway between boundaries.
//
// These exist to catch unintended changes in output. If a change is intended,
// review the diff and update with `npm test -- test/golden -u`.

import * as fs from "fs"
import * as path from "path"

import { renderToStringAsync } from "../../src/render-to-string.js"
import { findPicjsBlocks } from "../../src/md-blocks.js"
import { parseToAST, ParseStatus } from "../../src/parser.js"
import { parse as pegParse } from "../../src/peg_parser/jp.js"
import { Dispatcher } from "../../src/dispatcher.js"
import { nullLogger } from "../../src/render-utils.js"
import { svgNode, serialize } from "../../src/svg-node.js"
import { resetTheme, applyPaletteToTheme } from "../../src/defaults.js"
import { Palette } from "../../src/palette.js"

const ROOT = process.cwd()   // jest runs from the repo root

interface Diagram { name: string, source: string }

function examples(): Diagram[] {
  const dir = path.join(ROOT, "examples")
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".picjs"))
    .sort()
    .map(f => ({ name: `examples/${f}`, source: fs.readFileSync(path.join(dir, f), "utf8") }))
}

// Fences as the Eleventy plugin sees them: ```picjs or ~~~ picjs, with optional
// meta. Blocks marked `code` are only syntax-highlighted, never rendered.
const DOC_FENCE = /^(```|~~~)[ \t]*picjs\b([^\n]*)\n([\s\S]*?)\n\1[ \t]*$/gm

function docs(): Diagram[] {
  const dir = path.join(ROOT, "docs")
  const result: Diagram[] = []
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".md")).sort()) {
    const content = fs.readFileSync(path.join(dir, f), "utf8")
    let n = 0
    for (const m of content.matchAll(DOC_FENCE)) {
      n += 1
      if (/\bcode\b/.test(m[2])) continue
      result.push({ name: `docs/${f} #${n}`, source: m[3].trimEnd() })
    }
  }
  return result
}

// The README holds already-rendered blocks, so use the CLI's own block finder.
function readme(): Diagram[] {
  const content = fs.readFileSync(path.join(ROOT, "README.md"), "utf8")
  return findPicjsBlocks(content).map((b, i) => ({ name: `README.md #${i + 1}`, source: b.source }))
}

const diagrams = [...examples(), ...docs(), ...readme()]

function newDispatcher(source: string) {
  resetTheme()
  Palette.setCurrent(`sunset`)
  applyPaletteToTheme(Palette.getCurrentColors())
  const parsed = parseToAST(pegParse, source, `Start`, false)
  if (parsed.status !== ParseStatus.Ok) throw new Error(parsed.error?.message)
  const dispatcher = new Dispatcher(nullLogger, null, 1)
  dispatcher.start(parsed.ast)
  return dispatcher
}

function elementsAt(source: string, t: number): string[] {
  const dispatcher = newDispatcher(source)
  dispatcher.applyTimelineUpTo(t)
  return dispatcher.renderToSvgNodes().map(serialize)
}

// To keep snapshots readable, a frame records only the top-level elements that
// differ from the t=0 render, keyed by their index in it.
function frameDiff(base: string[], frame: string[]): Record<string, string> {
  const diff: Record<string, string> = {}
  const n = Math.max(base.length, frame.length)
  for (let i = 0; i < n; i++) {
    if (base[i] !== frame[i]) diff[i] = frame[i] ?? `(absent)`
  }
  return diff
}

function sampleTimes(boundaries: number[]): number[] {
  const times: number[] = []
  boundaries.forEach((t, i) => {
    if (i > 0) times.push((boundaries[i - 1] + t) / 2)
    times.push(t)
  })
  return times
}

describe(`golden output`, () => {
  it(`finds diagrams to check`, () => {
    expect(diagrams.length).toBeGreaterThan(50)
  })

  for (const { name, source } of diagrams) {
    it(name, async () => {
      const result = await renderToStringAsync(source, { includeSource: false })
      const snapshot: Record<string, any> = {
        error: result.error,
        width: result.width,
        height: result.height,
        svg: result.svg,
      }

      if (!result.error) {
        const dispatcher = newDispatcher(source)
        const boundaries = dispatcher.animationBoundaryTimes()
        if (boundaries.length > 1) {
          snapshot.timeline = (dispatcher as any).timeline.asArray()
          const base = elementsAt(source, 0)
          snapshot.frames = Object.fromEntries(
            sampleTimes(boundaries).map(t => [t.toFixed(4), frameDiff(base, elementsAt(source, t))])
          )
        }
      }

      expect(snapshot).toMatchSnapshot()
    })
  }
})
