# picjs for Neovim

Filetype detection, syntax highlighting, indentation, and comment settings
(`gc` works) for picjs files (`*.picjs`, and the older `*.jp`).

The syntax and indent files are shared with [`extras/vim`](../vim), through
the `syntax` and `indent` symlinks here.

## Installing

With [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{ dir = "/path/to/picjs/extras/nvim" }
```

Or add this directory to your `runtimepath`.

## Options

Set these before the plugin loads (in lazy.nvim, in the spec's `init`):

`vim.g.picjs_recommended_style` (default `true`): use two-space indents, as
the examples do. Set it to `false` to keep your own `expandtab`, `shiftwidth`
and `softtabstop`.

`vim.g.picjs_markdown_fenced` (default `true`): add picjs to
`g:markdown_fenced_languages`, so ```` ```picjs ```` blocks in Markdown are
highlighted.

## Markdown and Tree-sitter

Neovim highlights Markdown with Tree-sitter by default, and Tree-sitter can
only highlight the code inside a fence if it has a Tree-sitter parser for that
language. There isn't one for picjs yet, so ```` ```picjs ```` blocks are only
highlighted when Markdown uses Vim's regex syntax (for example, after
`:lua vim.treesitter.stop()`).
