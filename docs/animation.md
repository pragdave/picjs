---
title: Animation
description: Moving things over time
layout: layouts/doc.njk
eleventyNavigation:
  key: Animation
  order: 5
---

picjs lets you change attributes of drawing objects over time. You can do this directly, by saying
what should move where and when, or you can describe how a drawing reflects some data, and let
picjs animate the changes as that data changes.

## Animation Primitives

The primitives say exactly what changes, and when.

~~~ picjs example animated
a = box "Hello"
move a.c to a.se take 2
~~~

Hit the Play control to the left of the timeline, and the box should move. Position the scrubber back
and forth, and the box's position will reflect the time.

~~~ picjs example animated
a = box "Hello"
Gap
b = circle "World"
l = line from a to b

// animation
move a to (2,1) 
move b to (1,-1)
set a.fill to ~b4
set b.fill to ~b6
set b.rad to .7
set l.thickness to .1
~~~

You might be surprised that all the animations run concurrently, rather than one after the other. It
turns out that is one of the subtle superpowers of picjs.

picjs has a special variable, `@`, which represents the time (in seconds) when animations will run. 
Whenever you create
an animation (using `move`, `set`, and `draw`), that animation starts at whatever time is currently
in `@`. The initial value of `@` is zero, and so all the animations in the code above run starting at 0.

We can change `@` to change how the animations work. We'll also use the `take` attribute to set
durations for the different effects.

~~~ picjs example animated
a = box "Hello"
Gap
b = circle "World"
l = line from a to b

// animation
move a to (2,1) take 3 
@ = .5
move b to (1,-1)
set a.fill to ~b4
set b.fill to ~b6
@ = 1.5
set b.rad to .7
@ = 0
set l.thickness to .1
~~~

Notice we can set `@` to any value, including ones before the current animation time. 

### Chaining Animations

Sometimes, though, you do want animations to run sequentially. `then` to the rescue.

~~~ picjs example animated
a = box "Hello"
Gap
b = circle "World"
l = line from a to b

move a to (1,1)
then move b to (1,-1)
then set l.thickness to .2
~~~

### More About `@`

The `@` value has some other tricks up its temporal sleeve. It has a number of attributes:

| Expression | Value |
|-----------|-------------|
| `@` | Current time (shorthand for `@.now`) |
| `@.now` | Current time |
| `@.max_time` | Maximum time in the timeline |
| `@.last_animation_start` | Start time of most recent animation |
| `@.last_animation_end` | End time of most recent animation |
| `@.start_from` | Time offset for next animation |

Assigning to `@.now` is the same as assigning to `@`: it sets the current time.

`@.start_from` can also be assigned to. When set, it determines the time that the next animation
will start, but doesn't change `@.now`. This is rarely used, but has a place when you want to
schedule a future animation without interfering with calculations that use `@`.

Then there's the strange `@@` sigil. It's an abbreviation for

``` picjs code
@.now = @.last_animation_end
```

Called after an animation, it updates the value of `@` so that a subsequent animation will start
immediately after the previous one. For adjacent animations, it's like using `then`. It's more
useful when you have your animations broken into chunks, and you want to synchronize their execution.

### Easing

As with _interpolations_, you can add an easing function to animations:
`linear`, `cubicIn`, `cubicOut`, `cubic`, `cubicInOut`, `quadIn`, `quadOut`, `quad`, `quadInOut`, and `bounce`.

### Lines and Arrows

Lines and arrows have two distinct types of animation. We've already seen the first: their start and
end points track the shapes they are attached to, and they have attributes like `stroke` to set the
color and `thickness` to set their width.

But lines can also be animated when they are drawn: they grow from their start to their end.

For this to work, we have to tell the line not to draw itself initially using the `nodraw` property.
We can then animate it using the `draw` animator.

~~~ picjs example animated
c1 = circle rad .1
c2 = circle rad .1 at c1.c + (2, 1)

l = line -> from c1 to c2 nodraw

draw l take 2 ease quad
~~~

### Attachment

You'll probably notice that if you join two shapes with a line and move one of the shapes, the line
adjusts so it is still attached.

This is an example of _shape attachment_. Two shapes are attached when the position of one _explicitly_
depends on the position of the other. This dependency is created when you use a constraint. 

~~~ picjs example animated
b1 = box fill ~b1
b2 = box fill ~b2
b3 = box fill ~b3
b4 = box fill ~b4 with .w at b3.e

move b1 up .5
move b3 up .5
~~~

The first three boxes are unconstrained. Box `b2` is next to `b1`, but that just because the layout
mechanism put it there. The position of `b4`, however, is _defined_ in terms of `b3`. Moving `b1`
has no impact on `b2`, but when `b3` moves, the constraint means that `b4` moves with it.

Now let's repeat the experiment, but moving `b2` and `b4`.

~~~ picjs example animated
b1 = box fill ~b1
b2 = box fill ~b2
b3 = box fill ~b3
b4 = box fill ~b4 with .w at b3.e

move b2 up .5
move b4 up .5
~~~

Perhaps surprisingly, `b4` doesn't move. The constraint glues it to `b3`, and the animation respects
that.

The [Towers of Hanoi breakdown](/hanoi-breakdown/) shows these primitives working together in a
complete animation.

## Higher-Level Animations

Often what you want to show is an algorithm at work: values being sorted, disks moving between pegs.
Writing a `move` for every change mixes the animation into the algorithm. Instead, you can describe
_where_ things should be, given the current state of your program, and let picjs work out the
animations.

### Layouts

A layout is a function that positions shapes. `layout()` runs it straight away, so the shapes start
where it puts them. Each call to the layout's `step()` runs it again, and animates every shape whose
position has changed.

~~~ picjs example animated
a = box "A"
b = box "B"
c = box "C"

order = [a, b, c]
view = layout(() => {
  order.each((shape, i) => { shape.c = (i * 1.5, 0) })
})

@ += .5
order = [c, a, b]
view.step()
order = [a, b, c]
view.step()
~~~

The code that changes `order` knows nothing about animation: it just calls `step()` when it's ready
for the drawing to catch up. Each step starts at `@`, and `@` then advances past its animations, so
consecutive steps play one after the other.

Set `view.take` and `view.ease` to change how long the moves take and how they're eased.

### Transitions

By default, a shape moves to its new position in a straight line. To change that, give the layout a
`transition` function. It's called for each shape that moves, with the shape and its old and new
positions, and can run whatever animations it likes.

~~~ picjs example animated
a = box "A"
b = box "B"
c = box "C"

order = [a, b, c]
view = layout(() => {
  order.each((shape, i) => { shape.c = (i * 1.5, 0) })
})
view.transition = (shape, from, to) => {
  move shape to from - (0, 1) take .3 ease "cubicOut"
  then move shape to to - (0, 1) take .5
  then move shape to to take .3 ease "cubicIn"
}

@ += .5
order = [c, a, b]
view.step()
~~~

The positions are for whichever point the layout set: here, the shapes' centers.

### Shapes Entering and Leaving

If a step places a shape the layout didn't place last time, the shape fades in at its new position.
If the layout stops placing a shape, it fades out where it is. Until a layout first places a shape,
the shape stays hidden. Set `view.enter = (shape, at) => ...` or `view.exit = (shape, from) => ...`
to do something else instead.

Normally everything in a step moves at once. Give `step()` a time, or set `view.stagger`, and each
shape starts that much after the one before.

~~~ picjs example animated
a = box "A"
b = box "B"
c = box "C"

shown = [a]
view = layout(() => {
  shown.each((shape, i) => { shape.c = (i * 1.5, 0) })
})

@ += .5
shown = [a, b, c]
view.step(.3)
shown = [c, a]
view.step()
~~~

The [layout version of the Towers of Hanoi](/higher-level-hanoi-breakdown/) puts these together.

## Combining Layouts

A drawing can have more than one layout: one for the data, say, and another for markers that point
at it. Add layouts together with `+`, and stepping the result steps them all at once, each with its
own settings and transitions. A shape should belong to just one of them.

``` picjs code
view = bars + markers
view.step()
```

The [bubble sort breakdown](/bubble-sort-breakdown/) uses two layouts this way.
