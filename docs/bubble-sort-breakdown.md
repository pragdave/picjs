---
title: Bubble Sort Breakdown
description: Animating a sort with two layouts combined
layout: layouts/doc.njk
eleventyNavigation:
  key: Bubble Sort Breakdown
  order: 8
---
# Animating a Bubble Sort

This animation sorts eight bars. A bracket underneath shows which pair is being compared, and a
tick appears under each bar once it has reached its final place. You can
[open the program in the playground](/editor/?example=bubble-sort.picjs).

Like the [layout version of Hanoi](/higher-level-hanoi-breakdown/), the algorithm only changes
data. This page looks at what's new here: markers that the layout moves, shows, and hides, and
two layouts working together.

## The model and the algorithm

Three variables describe everything on the screen:

``` picjs code
items = [5, 2, 8, 1, 7, 3, 6, 4]
comparing = -1       // index of the left item being compared, or -1 for none
sorted_from = N      // the items from here on are in their final places
```

The sort updates them as it goes, and calls `view.step()` after each comparison and each swap:

``` picjs code
[0..N-2-pass].each(i => {
  comparing = i
  view.step()
  if (items[i] > items[i+1]) {
    larger = items[i]
    items[i] = items[i+1]
    items[i+1] = larger
    view.step()
  }
})
```

## Two layouts

The bars and the markers behave differently, so each gets its own layout.

The bar layout stands each value's bar at that value's index:

``` picjs code
bar_view = layout(() => {
  items.each((v, i) => { bars[v-1].s = slot(i) })
})
```

The marker layout puts the bracket under the pair being compared, and a tick under each finished
bar:

``` picjs code
marker_view = layout(() => {
  if (comparing >= 0) { bracket.n = slot(comparing) + (Spacing/2, 0.1) }
  ticks.each((tick, i) => {
    if (i >= sorted_from) { tick.n = slot(i) + (0, 0.35) }
  })
})
marker_view.take = 0.3
```

Nothing here says "show" or "hide". When `comparing` first becomes 0, the layout places the
bracket for the first time, so it fades in. When a pass ends and `sorted_from` drops, the layout
places one more tick, and that tick fades in. At the end, `comparing` goes back to -1, the layout
stops placing the bracket, and it fades out.

## A transition that reads the model

When two bars swap, sliding them straight past each other would overlap them. So the bar layout's
transition lifts the bar moving right, which is always the larger one, over the other:

``` picjs code
bar_view.transition = (bar, from, to) => {
  if (to.x > from.x) {
    clear = items[from.x / Spacing] * Unit + 0.1
    move bar.s      to from - (0, clear) take 0.25 ease "cubicOut"
    then move bar.s to to - (0, clear)   take 0.4  ease "linear"
    then move bar.s to to                take 0.25 ease "cubicIn"
  }
  else {
    move bar.s to to take 0.9 ease "cubicInOut"
  }
}
```

It only needs to lift high enough to clear the other bar. When the transition runs, `items`
already holds the new order, so the value now at the index this bar is leaving is the one it's
passing over. The view may read the model; it's the model that mustn't know about the view.

## Combining them

The algorithm calls one `view.step()`, so the two layouts are added together:

``` picjs code
view = bar_view + marker_view
```

Stepping `view` steps both layouts from the same moment, each with its own settings: the markers
move in 0.3 seconds, while the bars use their transition. Then `@` moves on to whichever finished
last.

Keeping the layouts separate is what lets them differ. With one layout, the bracket and ticks
would get the bars' lift-and-carry transition too.
