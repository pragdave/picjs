---
title: Hanoi with Layouts
description: The Towers of Hanoi, with the algorithm kept apart from the animation
layout: layouts/doc.njk
eleventyNavigation:
  key: Hanoi with Layouts
  order: 7
---
# The Towers of Hanoi, Using a Layout

The [original Hanoi animation](/hanoi-breakdown/) moves each disk with explicit `move`
commands, called from inside the algorithm. This version draws exactly the same thing, but the
algorithm never mentions animation. It just changes some data, and a [layout](/animation/#layouts)
turns that data into a picture.

This page only covers what's different. The poles, disks, and colors are drawn as before. You can
[open the full program in the playground](/editor/?example=hanoi-layout.picjs).

## The model

The state of the puzzle is just a list of the disks on each peg, bottom first:

``` picjs code
pegs = [[], [], []]   // disk numbers, bottom first; 1 is the smallest
```

## The algorithm

Moving a disk is now a change to `pegs`, followed by a request to show it:

``` picjs code
hanoi = (n, from, to, via) => {
  if (n > 0) {
    hanoi(n-1, from, via, to)
    pegs[to].push(pegs[from].pop())
    view.step()
    hanoi(n-1, via, to, from)
  }
}
```

Compare this with the original, where the algorithm called a `moveDisk` function that popped the
disk, scheduled three `move` commands, and pushed it again. Here, `from` and `to` are just peg
numbers, and nothing in the algorithm knows what a disk looks like.

## The layout

The layout says where every disk belongs, for any arrangement of `pegs`. Disk `d` on peg `p`, at
`height` in that peg's stack, sits that many disk-heights above the bottom of the pole:

``` picjs code
view = layout(() => {
  pegs.each((peg, p) => {
    peg.each((d, height) => {
      disks[d-1].s = poles[p].s - (0, (height+1) * 22)
    })
  })
})
```

This replaces the original's `canHaveDisks` mixin, which tracked each pole's stack so that it could
work out where the next disk would land. The layout doesn't need to remember anything: it works the
positions out from `pegs` each time.

Each `view.step()` runs this function again. Only one disk is ever somewhere new, so only that disk
moves.

## The transition

A straight-line move would drag the disk through the poles, so the layout gets a transition: lift
the disk clear, carry it across at a steady speed, and lower it into place.

``` picjs code
view.transition = (disk, from, to) => {
  top = poles[0].n.y - 10
  distance = ((to.x - from.x) / PoleSep).abs()   // 1 or 2 poles across
  move disk.s      to (from.x, top) ease "cubicIn"
  then move disk.s to (to.x, top)   ease "linear" take 0.3 + 0.3*distance
  then move disk.s to to            ease "cubicOut"
}
```

These are the same three moves as the original's `moveDisk`. The difference is where they come
from. `from` and `to` are the disk's old and new positions, given for the point the layout set, the
disk's `.s`. So the transition doesn't need to know which pegs are involved: the distance comes
from the positions themselves.

## Setting up

The pegs start empty, so the layout places nothing, and the disks start hidden. Filling the first
peg and taking one step brings them in:

``` picjs code
[NumDisks..1].each(d => pegs[0].push(d))
view.step(0.3)                  // the disks fade in, one after another
@ += 0.3

hanoi(NumDisks, 0, 2, 1)
```

Each disk is new to the layout, so it fades in where it belongs. The `0.3` staggers them: each disk
starts 0.3 seconds after the one before, which gives the same build-up as the original's
`@ += 0.3` loop.
