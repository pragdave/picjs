" Vim indent file
" Language: picjs
"
" Indents one level inside { }, ( ) and [ ], and lines a closing bracket up
" with the line that opened it. Needs syntax highlighting on, so that brackets
" in strings and comments are ignored.

if exists('b:did_indent')
  finish
endif
let b:did_indent = 1

setlocal indentexpr=GetPicjsIndent(v:lnum)
setlocal indentkeys=0{,0},0),0],!^F,o,O,e
setlocal autoindent nosmartindent nocindent

let b:undo_indent = 'setlocal indentexpr< indentkeys< autoindent< smartindent< cindent<'

if exists('*GetPicjsIndent')
  finish
endif

" Strings and comments don't count when matching brackets
let s:skip = 'synIDattr(synID(line("."), col("."), 0), "name") =~? "string\\|comment"'

" Inside brackets, indent one level past the line holding the innermost open
" bracket, and line a closing bracket up with that line. Outside them, keep
" the previous line's indent.
function! GetPicjsIndent(lnum) abort
  let prev = prevnonblank(a:lnum - 1)
  if prev == 0
    return 0
  endif

  let saved = getcurpos()
  call cursor(a:lnum, 1)
  let [open_lnum, _] = searchpairpos('[[({]', '', '[\])}]', 'bnW', s:skip)
  call setpos('.', saved)

  if open_lnum == 0
    return indent(prev)
  endif
  if getline(a:lnum) =~# '^\s*[\])}]'
    return indent(open_lnum)
  endif
  return indent(open_lnum) + shiftwidth()
endfunction
