" Vim filetype plugin
" Language: picjs

if exists('b:did_ftplugin')
  finish
endif
let b:did_ftplugin = 1

setlocal commentstring=//\ %s
setlocal comments=://
setlocal formatoptions-=t formatoptions+=croql
setlocal suffixesadd=.picjs

let b:undo_ftplugin = 'setlocal commentstring< comments< formatoptions< suffixesadd<'

" The examples and docs use two-space indents. Set
" g:picjs_recommended_style = 0 to keep your own settings.
if get(g:, 'picjs_recommended_style', 1)
  setlocal expandtab shiftwidth=2 softtabstop=2
  let b:undo_ftplugin .= ' | setlocal expandtab< shiftwidth< softtabstop<'
endif
