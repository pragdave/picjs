# picjs for Vim

Filetype detection, syntax highlighting, indentation, and comment settings for
picjs files (`*.picjs`, and the older `*.jp`).

## Installing

With Vim's built-in packages:

```sh
mkdir -p ~/.vim/pack/picjs/start
ln -s /path/to/picjs/extras/vim ~/.vim/pack/picjs/start/picjs
```

Or point your plugin manager at this directory.

To highlight ```` ```picjs ```` blocks in Markdown files, add this to your vimrc:

```vim
let g:markdown_fenced_languages = ['picjs']
```

## Options

`g:picjs_recommended_style` (default `1`): use two-space indents, as the
examples do. Set it to `0` to keep your own `expandtab`, `shiftwidth` and
`softtabstop`.

For Neovim, use [`extras/nvim`](../nvim) instead.
