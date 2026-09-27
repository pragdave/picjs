# PicJS History

## 0.2.12

* The package is now published as `@pragdave/picjs` (previously `@strike48/picjs`); update your imports and `npm install @pragdave/picjs`
* Fix picjs failing to load under a Content-Security-Policy without `'unsafe-eval'` (WebViews, browser extensions, Electron apps, CSP-locked sites): theme expressions such as `=FS*4.5` are now evaluated without `Function()`
* Groups can paint a background and pad their contents: `Group fill ~b3 stroke ~f1 radius .1 pad .3 { ... }`; `pad (x, y)` sets each axis
* `Group` can carry shape defaults (`Group.fill = ~b3`); `padding`/`pad` can be set as a default
* A newline in a label now breaks the line instead of reflowing to a space; a blank line still starts a paragraph, and indentation is stripped
* Reject attributes a shape does not have with an error listing what it accepts, instead of silently ignoring them
* Fix abbreviations (`wid`, `ht`, `rot`, `len`, `thick`) being ignored in shape defaults; `radius` in a default sets `rx`/`ry`
* Fix `rotation` being ignored on arcs and polylines, and arcs leaking `turn`/`rotation` attributes into the SVG
* Fix crashes: a shape-type default fill on any labelled shape, `fit`, `Skip x N y N`, and empty or shapeless programs
* `fit` now works for single labels, and shrinks as well as grows
* Implement `&&`, `||`, unary `!` (short-circuiting) and `%`; fix `==`/`!=` on booleans
* Implement `smooth` and `stepped` for polylines, and fix them on short two-point lines
* Add the documented `stroke_width` attribute to the grammar
* `Shape.attr = ...` defaults are now read, and user defaults always win over built-ins
* Labels reserve exactly the space they draw: font specs, markdown and links are measured as rendered
* Fix diagrams clipping circles and rotated shapes: the viewBox is now measured from the space each shape occupies, and rotations use an exact degrees-to-radians factor
* Fix a standalone label overflowing its own box
* Fix `Goto 3` (a bare distance) placing the next shape at NaN, so it vanished
* Fix the animation runtime dropping palette CSS, which turned palette-filled shapes black
* CLI: `example` and `2up` blocks no longer show their source twice, `picjs process` exits non-zero when a diagram fails, and `--version` reports the real version
* Docs: README rewritten; guide split into drawing, language, animation and integrating pages; reference organised by shape; new page on how layout works

## 0.2.11

* Fix SSR label size estimates ignoring `maxwidth` wrapping, `line_height` and paragraph spacing, which inflated or clipped the viewBox (#6)

## 0.2.10

* Fix the space before `&` disappearing in link labels (#5)
* Remove the build-stamp watermark from rendered SVGs

## 0.2.9

* Markdown `[text](url)` links in labels render as real links (URL scheme sanitized) instead of being discarded
* Fix `**bold**` in labels rendering as plain text

## 0.2.8

* No changes (version bump only)

## 0.2.7

* Add a default export for jiti/CJS compatibility
* Docusaurus plugin (`extras/plugins/docusaurus`): remark plugin, Prism language definition and styles

## 0.2.6

* CLI: fix dependency loading, replace code blocks in plain mode (source kept in a comment), re-render standalone rendered blocks, report counts in verbose mode, show help after unknown commands

## 0.2.5

* Improve light-mode palette colors (pastel remap instead of muddy luma inversion)
* Allow palettes to define explicit `lightColors` overrides (sunset has hand-tuned set)
* Emit explicit dark text for labels in light mode instead of relying on `currentColor`
* Remove `.v1`–`.v4` shape variant classes; simplify `.h1`–`.h4` label classes to only set alignment and size
* Allow `font_weight`, `font_style`, `font_variant`, `font_stretch` as standalone Label attributes
* Fix `behind` constraint not working inside groups
* Fix `self.internal` broken in nested groups (inner group clobbered outer `self` binding)
* Line labels default to "above" with proper gap from the line path
* Use `currentColor` for label fills so they inherit page foreground correctly
* Fix renderAll by attaching SVG to DOM before rendering

## 0.2.4

* Add palette CSS style block to browser renderAll/render output

## 0.2.3

* Fix renderToString crash on labelled shapes in browser environments

## 0.2.2

* Fix rich label fill color being ignored
* Preserve individual label styling in multi-label shapes
* Fix palette color fills in labels (e.g., `~b6`)
* Allow `font_size` before or after label text
* Convert font sizes with units (pt, px, etc) to internal coordinates
* Rich labels with font_size units now compute valid dimensions
* Add directional line syntax (`line right 2`, `line right 2 up 1`)

## 0.2.1

* Fix issue with palettes and dark/light mode
* Fix arrows and end points of curved lines which meet shapes at an angle

## 0.2.0

* Initial public release

## 0.1.0

* Prototype
