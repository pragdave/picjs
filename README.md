# picjs

A language for drawing — and animating — diagrams. You describe what you want;
picjs works out where everything goes.

![A simple flow chart with three boxes, connected by arrows](./gh-assets/hello.png)

```
Palette.current = "shuksan"
box "Input" -> box "Process" fill ~b2 -> box "Output"
```

Have a play in the [**playground**](https://pragdave.github.io/picjs/editor/),
or read the [**documentation**](https://pragdave.github.io/picjs/).

## Diagrams in your markdown

Write a diagram where it belongs — in the document that talks about it:

~~~markdown
Here is how the parts fit together:


<!-- picjs:9b843399:plain
box "Input" -> box "Process" -> box "Output"
-->
<svg viewBox="-0.7 -0.575 5.4 1.15" class="_myopic-1" xmlns="http://www.w3.org/2000/svg"><style>.pj-fill-sunset-b1{fill:#41476b}
.pj-fill-sunset-f1{fill:#fbdfa2}
.pj-stroke-sunset-b1{stroke:#41476b}
[data-theme="light"] .pj-fill-sunset-b1{fill:#8b90b8}
[data-theme="light"] .pj-fill-sunset-f1{fill:#1a1a2e}
[data-theme="light"] .pj-stroke-sunset-b1{stroke:#8b90b8}</style><g data-jp-id="SBox-1"><rect width="1" height="0.75" stroke="none" stroke-width="0.015" rx="0.06" ry="0.06" x="-0.5" y="-0.375" class="pj-fill-sunset-b1" data-jp-id="SBox-1"></rect><text font-family="Roboto, sans-serif" font-size="0.14" font-style="normal" font-variant="normal" font-weight="normal" font-stretch="normal" x="-0.16100000000000003" y="-0.084" class="pj-fill-sunset-f1" dominant-baseline="text-before-edge" data-jp-id="SLabel-2">Input</text></g><g data-jp-id="SLine-3"><path stroke-width="0.04" x="1" y="0" d="M 0.5 0 L 1.284 0" fill="none" class="pj-stroke-sunset-b1"></path><path d="M 1.284 -0.06 L 1.44 0 L 1.284 0.06 Z" stroke="none" class="pj-fill-sunset-b1"></path></g><g data-jp-id="SBox-4"><rect width="1" height="0.75" stroke="none" stroke-width="0.015" rx="0.06" ry="0.06" x="1.5" y="-0.375" class="pj-fill-sunset-b1" data-jp-id="SBox-4"></rect><text font-family="Roboto, sans-serif" font-size="0.14" font-style="normal" font-variant="normal" font-weight="normal" font-stretch="normal" x="1.7746" y="-0.084" class="pj-fill-sunset-f1" dominant-baseline="text-before-edge" data-jp-id="SLabel-5">Process</text></g><g data-jp-id="SLine-6"><path stroke-width="0.04" x="3" y="0" d="M 2.5 0 L 3.284 0" fill="none" class="pj-stroke-sunset-b1"></path><path d="M 3.284 -0.06 L 3.44 0 L 3.284 0.06 Z" stroke="none" class="pj-fill-sunset-b1"></path></g><g data-jp-id="SBox-7"><rect width="1" height="0.75" stroke="none" stroke-width="0.015" rx="0.06" ry="0.06" x="3.5" y="-0.375" class="pj-fill-sunset-b1" data-jp-id="SBox-7"></rect><text font-family="Roboto, sans-serif" font-size="0.14" font-style="normal" font-variant="normal" font-weight="normal" font-stretch="normal" x="3.8068" y="-0.084" class="pj-fill-sunset-f1" dominant-baseline="text-before-edge" data-jp-id="SLabel-8">Output</text></g></svg>
<!-- /picjs -->
~~~

Then run picjs over the file:

```console
$ npx picjs process README.md
```

Each block is replaced by the rendered SVG, with the source kept beside it in a
comment. Edit the source and run it again and the picture is redrawn; leave it
alone and nothing changes. The result is static SVG, so it works anywhere —
including here, on GitHub.

If you control your site's markdown pipeline, the
[Lume and Eleventy plugins](./extras/plugins) do the same thing at build time.

## It is a real language

<table>
<tr>
<td width="50%">

~~~
petals = 17
start_color = oklch(70%, .3, 0)

petal = (color) => {
  4.times(=> {
    Arc stroke color
    Arc ccw stroke color.spin(10)
    Arc stroke color.spin(20)
  })
}

petals.times(n => {
  Face 360/petals*n
  petal(start_color.spin(n*30))
})
~~~

</td>
<td width="50%">

![Image drawn using arcs and 17-fold rotational symmetry](./gh-assets/petal.png)

</td>
</tr>
</table>

Shapes follow on from one another, so `petal` needs no coordinates at all. The
outer loop turns the drawing direction a little each time and shifts the hue to
match.

## And it animates

![Screenshot of the Towers of Hanoi animation](./gh-assets/hanoi1.png)

Towers of Hanoi, solved recursively, with every move animated — in under sixty
lines. There is a [walk-through of how it works](./docs/hanoi-breakdown.md).

## Installing

```console
$ npm install picjs
```

In a page:

```html
<script type="module">
  import { renderAll } from 'picjs'
  renderAll('.picjs')          // renders every element with class "picjs"
</script>
<div class="picjs">box "Hello"</div>
```

On a server:

```typescript
import { renderToStringAsync } from 'picjs'
const { svg, width, height } = await renderToStringAsync('box "Hello"')
```

## Documentation

* [Guide](https://pragdave.github.io/picjs/guide/) — start here
* [How layout works](https://pragdave.github.io/picjs/layout/) — where things end up, and why
* [The language](https://pragdave.github.io/picjs/language/) — variables, functions, closures
* [Animation](https://pragdave.github.io/picjs/animation/)
* [Reference](https://pragdave.github.io/picjs/picjs-reference/) — every shape and option
* [Playground](https://pragdave.github.io/picjs/editor/) — nothing to install

The `skills/` directory has two skills files, should you want an AI to write
picjs with you.

## What you get

* Shapes that flow one after another, or sit where you pin them
* Constraints that hold: move a shape and whatever is attached follows
* Groups that nest, and behave as shapes themselves
* Colour palettes with light and dark variants, checked for contrast
* A timeline: shapes appear, move, and change over it
* Numbers, strings, lists, ranges, colours, positions and functions, with
  closures — and attributes on every value, which is enough to build mixins

## License

See [LICENSE.md](./LICENSE.md).
