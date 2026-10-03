" Vim syntax file
" Language:   picjs (a language for drawings and animations)
" Maintainer: Dave Thomas
" License:    Same as the picjs project
"
" Follows the grammar in src/peg_parser/jp.pegjs. Many attribute words are
" only keywords in attribute position, so single letters (x, y, r, n, s, e, w)
" are not highlighted on their own: they are common variable names.

if exists('b:current_syntax')
  finish
endif

scriptencoding utf-8

let s:cpo_save = &cpo
set cpo&vim

" --- Numbers -----------------------------------------------------------------

syn match   picjsNumber     '\v<\d+(\.\d+)?([eE][+-]?\d+)?>'
syn match   picjsNumber     '\v(<|\W)\zs\.\d+([eE][+-]?\d+)?>'
syn match   picjsNumber     '\v<\d+(\.\d+)?\%'
syn match   picjsNumber     '\v(<|\W)\zs\.\d+\%'
syn match   picjsSize       '\v<\d+(\.\d+)?\s*[x×]\s*\d+(\.\d+)?>'

" --- Strings -----------------------------------------------------------------
" Double-quoted strings (and """...""") interpolate #{expr}; ## is a literal #.

syn match   picjsEscape     contained '\\[bfnrtv0\\"'']'
syn match   picjsEscape     contained '\\x\x\{2}'
syn match   picjsEscape     contained '\\u\x\{4}'
syn match   picjsEscape     contained '##'
syn region  picjsInterp     contained matchgroup=picjsInterpDelim start='#{' end='}' contains=TOP

syn region  picjsString     start='"""' end='"""' contains=picjsEscape,picjsInterp,@Spell
syn region  picjsString     start="'''" end="'''" contains=@Spell
syn region  picjsString     start='"\("""\)\@!' skip='\\\\\|\\"' end='"' oneline contains=picjsEscape,picjsInterp,@Spell
syn region  picjsString     start="'\('''\)\@!" skip="\\\\\|\\'" end="'" oneline contains=picjsEscape,@Spell

" --- Colors ------------------------------------------------------------------

syn match   picjsColor      '\~[a-zA-Z0-9]\+'
syn region  picjsColor      matchgroup=picjsColor start='\~#{' end='}' contains=TOP
syn match   picjsColor      '#\x\{3,4}\>'
syn match   picjsColor      '#\x\{6}\>'
syn match   picjsColor      '#\x\{8}\>'

" --- Shapes and layout -------------------------------------------------------

syn keyword picjsShape      Arc Aside Box Circle Ellipse Group Label Line Oval Skip
syn keyword picjsShape      arc box circle ellipse line oval
syn keyword picjsLayout     Face Gap Goto

" Shape defaults and classes: Box.pole.fill = ..., Box .pole 20x150
syn match   picjsClass      '\v(<(Arc|Aside|Box|Circle|Ellipse|Group|Label|Line|Oval|Skip|arc|box|circle|ellipse|line|oval))@<=(\.\h\w*)+' contains=picjsCardinal
syn match   picjsClass      '\v(^|[[:space:](])\zs\.\h\w*'

" Cardinal points: shape.n, .se, self.c
syn match   picjsCardinal   '\v\.(nw|ne|sw|se|n|s|e|w|c)>'
syn match   picjsSelf       '\<self\ze\.'

" Directions. The one- and two-letter forms only count straight after Face.
syn keyword picjsDirection  north northeast northwest south southeast southwest east west
syn keyword picjsDirection  up down left right
syn match   picjsDirection  '\v(<Face\s+)@<=(nw|ne|sw|se|n|s|e|w)>'

" --- Control flow and constants ----------------------------------------------

syn keyword picjsConditional if else
syn keyword picjsBoolean    true false
syn keyword picjsConstant   PI Palette

" --- Animation ---------------------------------------------------------------

syn keyword picjsAnimation  move rotate set draw then pause wait
syn keyword picjsAnimParam  take ease by about
syn match   picjsTimeline   '@@\|@'

" --- Attributes and other keywords -------------------------------------------

syn keyword picjsAttribute  fill stroke stroke_width thickness thick opacity
syn keyword picjsAttribute  solid dotted dashed straight stepped step smooth curve curved
syn keyword picjsAttribute  width wid height ht length len radius rad rx ry rotation rot
syn keyword picjsAttribute  padding pad maxwidth align fit same behind nodraw close
syn keyword picjsAttribute  font font_family font_size font_style font_variant font_weight font_stretch line_height
syn keyword picjsAttribute  above below inside outside turn cw ccw
syn keyword picjsKeyword    at with from to until even level

" --- Functions ---------------------------------------------------------------

syn keyword picjsBuiltin    layout d2r r2d sin cos tan asin acos atan2 polar ln log10
syn match   picjsFunction   '\v<\h\w*\ze\s*\('
syn match   picjsFunction   '\v<\h\w*\ze\s*\=\s*(\([^)]*\)|\h\w*)?\s*\=\>'
" After picjsFunction, so that rgb( is a color model rather than a call
syn match   picjsColorModel '\c\v<(oklch|rgb|hsl|hsv)a?\ze\s*\('

" --- Operators and line endings ----------------------------------------------

syn match   picjsOperator   '[-+*/%^!<>=]'
syn match   picjsOperator   '\v[-+*/%]\=|\=\=|!\=|\<\=|\>\=|\&\&|\|\||\.\.|\=\>'
syn match   picjsInspect    '??'

" Line endings: -> <- <-> ~> |-| o-o -- ~~
syn match   picjsArrow      '\v[<|][-~]([>|]|o>)?'
syn match   picjsArrow      '\v<o[-~]([>|]|o>)?'
syn match   picjsArrow      '\v[-~]([>|]|o>)'
syn match   picjsArrow      '\v(^|\s)\zs(--|\~\~)\ze(\s|$)'

" --- Comments ----------------------------------------------------------------
" After the operators: when two matches start at the same place, the one
" defined last wins, and // must beat /.

syn keyword picjsTodo       TODO FIXME XXX HACK NOTE contained
syn match   picjsComment    '//.*$' contains=picjsTodo,@Spell

" --- Highlighting ------------------------------------------------------------

hi def link picjsComment      Comment
hi def link picjsTodo         Todo
hi def link picjsNumber       Number
hi def link picjsSize         Number
hi def link picjsString       String
hi def link picjsEscape       SpecialChar
hi def link picjsInterpDelim  Delimiter
hi def link picjsColor        Constant
hi def link picjsColorModel   Function
hi def link picjsShape        Type
hi def link picjsLayout       Statement
hi def link picjsClass        Type
hi def link picjsCardinal     Special
hi def link picjsSelf         Special
hi def link picjsDirection    Special
hi def link picjsConditional  Conditional
hi def link picjsBoolean      Boolean
hi def link picjsConstant     Constant
hi def link picjsAnimation    Keyword
hi def link picjsAnimParam    Keyword
hi def link picjsTimeline     Special
hi def link picjsAttribute    Identifier
hi def link picjsKeyword      Keyword
hi def link picjsBuiltin      Function
hi def link picjsFunction     Function
hi def link picjsOperator     Operator
hi def link picjsInspect      Debug
hi def link picjsArrow        Delimiter

let b:current_syntax = 'picjs'

let &cpo = s:cpo_save
unlet s:cpo_save
