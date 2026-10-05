#!/usr/bin/env node

// Generate docs/grammar.md, an annotated EBNF of the picjs grammar, from
// src/peg_parser/jp.pegjs. Run it (`make docs/grammar.md`) whenever the
// grammar changes; never edit grammar.md by hand.
//
// The grammar is parsed with Peggy's own parser. Rules are listed top down
// from Start: each appears once, under the shallowest rule that refers to it,
// and the rules under one parent are in alphabetical order. A rule is
// annotated with the comment written above it in the grammar.
//
// What is left out, because it isn't syntax:
// - actions, labels and display names
// - alternatives that only report an error (they call error() or expected(),
//   or throw), and rules made of nothing else
// - keyword rules (move = "move" !IdentifierPart): references to them are
//   written as the word itself, and the words are listed in a table

const peggy = require(`peggy`)
const fs    = require(`fs`)
const path  = require(`path`)

const ROOT         = path.resolve(__dirname, `../..`)
const GRAMMAR_FILE = path.join(ROOT, `src/peg_parser/jp.pegjs`)
const OUTPUT_FILE  = path.join(ROOT, `docs/grammar.md`)

const WIDTH  = 80     // of the EBNF lines
const INDENT = 16     // where a rule's definition starts

const source  = fs.readFileSync(GRAMMAR_FILE, `utf8`)
const lines   = source.split(`\n`)
const grammar = peggy.parser.parse(source)
const rules   = new Map(grammar.rules.map(rule => [rule.name, rule]))

// ──────────────────────────────────────────────── Classifying rules

function unwrap(node) {
  while ([`action`, `named`, `labeled`, `text`, `group`].includes(node.type))
    node = node.expression
  return node
}

// An alternative that exists only to report an error
function isErrorAlternative(node) {
  return node.type === `action` && /\b(error|expected)\s*\(|\bthrow\b/.test(node.code)
}

// the top-level alternatives, looking through wrappers such as $( ... )
function alternativesOf(rule) {
  let expr = rule.expression
  while ([`named`, `group`, `text`].includes(expr.type) ||
         (expr.type === `action` && unwrap(expr).type === `choice` && !isErrorAlternative(expr)))
    expr = expr.expression
  return expr.type === `choice` ? expr.alternatives : [expr]
}

const errorOnly = new Set(
  grammar.rules.filter(rule => alternativesOf(rule).every(isErrorAlternative)).map(rule => rule.name)
)

// keyword rules: words followed by !IdentifierPart, named after the word. The words may have
// alternatives and optional parts ("curve" "d"?), which are spelled out.
function keywordSpellings(rule) {
  const expr = unwrap(rule.expression)
  if (expr.type !== `sequence` || expr.elements.length !== 2) return null
  const [words, guard] = expr.elements
  if (guard.type !== `simple_not` || unwrap(guard.expression).name !== `IdentifierPart`) return null
  const spellings = spellingsOf(words)
  // a keyword is named after itself: SizeUnit is a set of words, not a keyword
  return spellings?.some(s => s.toLowerCase() === rule.name.toLowerCase()) ? spellings : null
}

function spellingsOf(node) {
  node = unwrap(node)
  switch (node.type) {
    case `literal`:  return [node.value]
    case `optional`: {
      const inner = spellingsOf(node.expression)
      return inner && [``, ...inner]
    }
    case `choice`: {
      const each = node.alternatives.map(spellingsOf)
      return each.every(Boolean) ? each.flat() : null
    }
    case `sequence`: {
      let result = [``]
      for (const element of node.elements) {
        const next = spellingsOf(element)
        if (!next) return null
        result = result.flatMap(prefix => next.map(word => prefix + word))
      }
      return result
    }
    default: return null
  }
}

const keywords = new Map()
for (const rule of grammar.rules) {
  const spellings = keywordSpellings(rule)
  if (spellings) keywords.set(rule.name, spellings)
}

// a character class too long to show, such as a Unicode category
const isBigClass = rule => {
  const expr = unwrap(rule.expression)
  return expr.type === `class` && expr.parts.length > 6
}

// ──────────────────────────────────────────────── Rendering EBNF

// Precedence, loosest first, so a subexpression is parenthesized only when it
// has to be
const CHOICE = 0, SEQUENCE = 1, PREFIX = 2, SUFFIX = 3, PRIMARY = 4

// A character as it is written: printable ASCII as itself, anything else
// (tabs, a non-breaking space) escaped so it can be seen. `special` are the
// characters that need a backslash where it is used.
const NAMED_ESCAPES = { '\t': `\\t`, '\n': `\\n`, '\r': `\\r`, '\f': `\\f`, '\v': `\\v` }

function escapeChar(c, special) {
  if (NAMED_ESCAPES[c]) return NAMED_ESCAPES[c]
  if (c === `\\` || special.includes(c)) return `\\${c}`
  const code = c.codePointAt(0)
  if (code >= 0x20 && code < 0x7f) return c
  return `\\u${code.toString(16).toUpperCase().padStart(4, `0`)}`
}

const quote = s => {
  const mark = s.includes(`'`) && !s.includes(`"`) ? `"` : `'`
  return mark + [...s].map(c => escapeChar(c, mark)).join(``) + mark
}

const classChar = c => escapeChar(c, `]^-`)

// [text, precedence], or null when the node shows nothing
function render(node) {
  switch (node.type) {
    case `rule`:
    case `named`:
    case `labeled`:
    case `text`:
    case `action`:
      return render(node.expression)

    case `group`:
      return render(node.expression)

    case `choice`: {
      const alternatives = node.alternatives
        .filter(a => !isErrorAlternative(a) && !(unwrap(a).type === `rule_ref` && errorOnly.has(unwrap(a).name)))
        .map(render).filter(Boolean)
      if (alternatives.length === 0) return null
      if (alternatives.length === 1) return alternatives[0]
      return [alternatives.map(([text]) => text).join(` | `), CHOICE]
    }

    case `sequence`: {
      const parts = node.elements.map(render).filter(Boolean)
      if (parts.length === 0) return null
      if (parts.length === 1) return parts[0]
      return [parts.map(p => wrap(p, SEQUENCE)).join(` `), SEQUENCE]
    }

    case `simple_not`: return prefixed(`!`, node.expression)
    case `simple_and`: return prefixed(`&`, node.expression)
    case `semantic_not`: return [`!{…}`, PRIMARY]
    case `semantic_and`: return [`&{…}`, PRIMARY]

    case `optional`:     return suffixed(node.expression, `?`)
    case `zero_or_more`: return suffixed(node.expression, `*`)
    case `one_or_more`:  return suffixed(node.expression, `+`)

    case `rule_ref`: {
      const spellings = keywords.get(node.name)
      if (spellings) {
        const words = spellings.map(quote)
        return words.length === 1 ? [words[0], PRIMARY] : [`( ${words.join(` | `)} )`, PRIMARY]
      }
      return [node.name, PRIMARY]
    }

    case `literal`:
      return [quote(node.value) + (node.ignoreCase ? `i` : ``), PRIMARY]

    case `class`: {
      const parts = node.parts.map(p => (Array.isArray(p) ? `${classChar(p[0])}-${classChar(p[1])}` : classChar(p)))
      return [`[${node.inverted ? `^` : ``}${parts.join(``)}]${node.ignoreCase ? `i` : ``}`, PRIMARY]
    }

    case `any`:
      return [`.`, PRIMARY]

    default:
      throw new Error(`extract-grammar: no rendering for a Peggy "${node.type}" node`)
  }
}

function wrap([text, precedence], needed) {
  return precedence < needed ? `( ${text} )` : text
}

function prefixed(op, expression) {
  const inner = render(expression)
  return inner && [op + wrap(inner, SUFFIX), PREFIX]
}

function suffixed(expression, op) {
  const inner = render(expression)
  return inner && [wrap(inner, PRIMARY) + op, SUFFIX]
}

// The rule's alternatives, as text
function definitionOf(rule) {
  if (isBigClass(rule)) {
    const note = commentAbove(rule).join(` `) || `a large character class`
    return [`? Unicode ${rule.name}: ${note} ?`]
  }
  return alternativesOf(rule)
    .filter(a => !isErrorAlternative(a) && !(unwrap(a).type === `rule_ref` && errorOnly.has(unwrap(a).name)))
    .map(render)
    .filter(Boolean)
    .map(([text]) => text)
}

// The pieces of an alternative that a line can break between: it splits at
// spaces, but not inside a quoted literal or a character class
function tokensOf(text) {
  const tokens = []
  let current = ``
  let inside = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inside) {
      current += c
      if (c === `\\`) current += text[++i]
      else if (c === inside) inside = null
    }
    else if (c === ` `) {
      if (current) tokens.push(current)
      current = ``
    }
    else {
      current += c
      if (c === `'` || c === `"`) inside = c
      else if (c === `[`) inside = `]`
    }
  }
  if (current) tokens.push(current)

  // keep brackets with what they enclose, so a line neither ends in "(" nor
  // starts with ")"
  const joined = []
  for (const token of tokens) {
    const previous = joined[joined.length - 1]
    if (previous !== undefined && (previous === `(` || previous.endsWith(` (`) || /^\)/.test(token)))
      joined[joined.length - 1] = `${previous} ${token}`
    else
      joined.push(token)
  }
  return joined
}

function formatRule(rule) {
  const name = rule.name
  const out = []
  const fits = name.length < INDENT - 1
  if (!fits) out.push(name)

  definitionOf(rule).forEach((alternative, i) => {
    let line = (i === 0 && fits ? name.padEnd(INDENT) : ` `.repeat(INDENT)) + (i === 0 ? `= ` : `| `)
    let atStart = true
    for (const token of tokensOf(alternative)) {
      if (!atStart && line.length + 1 + token.length > WIDTH) {
        out.push(line)
        line = ` `.repeat(INDENT + 4)
        atStart = true
      }
      line += (atStart ? `` : ` `) + token
      atStart = false
    }
    out.push(line)
  })
  out[out.length - 1] += ` ;`
  return out.join(`\n`)
}

// ──────────────────────────────────────────────── Comments

const isRuleBreak = line => /^\/\/\s*(-{3,}|={3,})/.test(line)

// The comment block written directly above a rule. A section's introduction
// (the comment under a // ==== or // ---- heading) goes to the first rule
// after it.
function commentAbove(rule) {
  let i = rule.location.start.line - 2
  const block = collectCommentBlock(i)
  if (block.text.length > 0 || block.start === i + 1) {
    if (block.text.length > 0 && !block.headed) return block.text
  }
  // skip blank lines to a section introduction
  let j = i
  while (j >= 0 && lines[j].trim() === ``) j--
  const intro = collectCommentBlock(j)
  if (intro.headed && !ruleBetween(j + 1, i)) return intro.text
  return block.text
}

function collectCommentBlock(end) {
  const text = []
  let i = end
  let headed = false
  while (i >= 0 && /^\s*\/\//.test(lines[i])) {
    if (isRuleBreak(lines[i].trim())) { headed = true; break }
    text.unshift(lines[i].replace(/^\s*\/\/ ?/, ``))
    i--
  }
  return { text: tidy(text), start: i + 1, headed }
}

function ruleBetween(from, to) {
  return grammar.rules.some(r => r.location.start.line - 1 > from && r.location.start.line - 1 <= to)
}

// comment lines as paragraphs: blank comment lines separate them
function tidy(text) {
  const paragraphs = []
  let current = []
  for (const line of text) {
    if (line.trim() === ``) {
      if (current.length) paragraphs.push(current.join(` `))
      current = []
    }
    else current.push(line.trim())
  }
  if (current.length) paragraphs.push(current.join(` `))
  return paragraphs
}

// ──────────────────────────────────────────────── Ordering

function referencesOf(rule) {
  const found = []
  const visit = peggy.compiler.visitor.build({
    choice(node) {
      node.alternatives
        .filter(a => !isErrorAlternative(a))
        .forEach(a => visit(a))
    },
    rule_ref(node) {
      if (!keywords.has(node.name) && !errorOnly.has(node.name) && rules.has(node.name))
        found.push(node.name)
    },
  })
  if (!isBigClass(rule)) visit(rule.expression)
  return [...new Set(found)]
}

// The rules reachable from Start, in the order they are first reached
const reachable = [`Start`]
const placed = new Set(reachable)
for (let i = 0; i < reachable.length; i++) {
  for (const name of referencesOf(rules.get(reachable[i]))) {
    if (!placed.has(name)) {
      placed.add(name)
      reachable.push(name)
    }
  }
}

// Each rule goes under its immediate dominator: the nearest rule that every
// route from Start to it passes through. A rule used in only one place sits
// with its user; one used all over rises to their common ancestor.
const referrers = new Map(reachable.map(name => [name, []]))
for (const name of reachable)
  for (const used of referencesOf(rules.get(name))) referrers.get(used).push(name)

const dominators = new Map(reachable.map(name => [name, new Set(reachable)]))
dominators.set(`Start`, new Set([`Start`]))
for (let changed = true; changed;) {
  changed = false
  for (const name of reachable.slice(1)) {
    const common = new Set(reachable)
    for (const referrer of referrers.get(name))
      for (const d of common) if (!dominators.get(referrer).has(d)) common.delete(d)
    common.add(name)
    if (common.size !== dominators.get(name).size) {
      dominators.set(name, common)
      changed = true
    }
  }
}

const children = new Map(reachable.map(name => [name, []]))
for (const name of reachable.slice(1)) {
  // the immediate dominator is the strict dominator with the most dominators
  const parent = [...dominators.get(name)]
    .filter(d => d !== name)
    .reduce((a, b) => (dominators.get(a).size >= dominators.get(b).size ? a : b))
  children.get(parent).push(name)
}
for (const list of children.values()) list.sort()

if (process.argv.includes(`--tree`)) {
  const show = (name, depth) => {
    console.log(`  `.repeat(depth) + name)
    children.get(name).forEach(child => show(child, depth + 1))
  }
  show(`Start`, 0)
  process.exit(0)
}

// ──────────────────────────────────────────────── Writing

const out = []
const emit = (...text) => out.push(...text)

emit(
  `---`,
  `title: picjs Grammar`,
  `description: The picjs grammar, as annotated EBNF`,
  `layout: layouts/doc.njk`,
  `eleventyNavigation:`,
  `  key: Grammar`,
  `  order: 5`,
  `---`,
  ``,
  `<!-- Generated from src/peg_parser/jp.pegjs by docs/tools/extract-grammar.cjs. Do not edit. -->`,
  ``,
  `This is the grammar that picjs's parser is built from, written as EBNF. It is`,
  `generated from the parser's grammar, \`src/peg_parser/jp.pegjs\`, so it is always`,
  `current.`,
  ``,
  `Rules are listed from the top down, starting with \`Start\`. Each rule appears`,
  `once, under the first rule that uses it, and the rules under one rule are in`,
  `alphabetical order. The notes come from the comments in the grammar.`,
  ``,
  `## Notation`,
  ``,
  `The grammar is a PEG (parsing expression grammar), so it differs from ordinary`,
  `EBNF in two ways:`,
  ``,
  `- **Alternatives are tried in order**, and the first that matches wins: in`,
  `  \`A | B\`, \`B\` is tried only if \`A\` fails.`,
  `- **Lookaheads** check what comes next without consuming it: \`!X\` matches`,
  `  only where \`X\` does not, and \`&X\` only where it does.`,
  ``,
  `| Notation | Means |`,
  `|----------|-------|`,
  `| \`'word'\` | the characters, exactly (\`'word'i\` ignores case) |`,
  `| \`[a-z]\`, \`[^"]\` | one character in, or not in, the set |`,
  `| \`.\` | any one character |`,
  `| \`X?\`, \`X*\`, \`X+\` | \`X\` optionally, zero or more times, one or more times |`,
  `| \`? … ?\` | described in words |`,
  ``,
  `Spacing is explicit: \`_\` is optional space, \`__\` is required space, and`,
  `\`SameLineSpace\` is space that doesn't include a newline. Space includes`,
  `comments. A keyword such as \`'move'\` only matches the whole word, so`,
  `\`mover\` is a name, not \`move\` followed by \`r\`. The keywords, with their`,
  `abbreviations, are [listed at the end](#keywords).`,
  ``,
)

// A comment is prose, not markdown, except for `code`: escape the rest so
// that <percent> or _ and __ show as written
function asMarkdown(text) {
  return text
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/[\\*_<>[\]|#]/g, c => `\\${c}`)))
    .join(``)
}

function emitRule(name) {
  // a large class's note is already in its definition
  const notes = isBigClass(rules.get(name)) ? [] : commentAbove(rules.get(name))
  emit(...notes.flatMap(p => [asMarkdown(p), ``]))
  emit(`\`\`\`ebnf`, formatRule(rules.get(name)), `\`\`\``, ``)
}

function emitTree(name) {
  emitRule(name)
  children.get(name).forEach(emitTree)
}

// The program's spine, Start to Expression, comes first. Then there's a
// section for each rule under Expression, holding the rules beneath it, and
// finally the spacing rules that Start owns.
const spine = [`Start`, `Program`, `ExpressionList`, `Expression`]
spine.slice(1, -1).forEach((name, i) => {
  if (children.get(name).join() !== spine[i + 2])
    throw new Error(`extract-grammar: expected ${name} to lead only to ${spine[i + 2]}; update the spine`)
})

emit(`## Programs`, ``)
spine.forEach(emitRule)

for (const name of children.get(`Expression`)) {
  emit(`## \`${name}\``, ``)
  emitTree(name)
}

emit(`## Spacing`, ``)
children.get(`Start`).filter(name => name !== `Program`).forEach(emitTree)

emit(`## Keywords`, ``)
emit(
  `These are written as words in the rules above. Where a keyword has more than`,
  `one spelling, any of them may be used.`,
  ``,
  `| Keyword | Spellings |`,
  `|---------|-----------|`,
)
for (const [name, spellings] of [...keywords].sort(([a], [b]) => a.localeCompare(b, `en`, { sensitivity: `base` })))
  emit(`| ${name} | ${spellings.map(s => `\`${s}\``).join(`, `)} |`)
emit(``)

fs.writeFileSync(OUTPUT_FILE, out.join(`\n`))

const unreachable = grammar.rules
  .map(rule => rule.name)
  .filter(name => !placed.has(name) && !keywords.has(name) && !errorOnly.has(name))
console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}: ${placed.size} rules, ${keywords.size} keywords`)
if (unreachable.length > 0)
  console.log(`Not reachable from Start, so left out: ${unreachable.join(`, `)}`)
