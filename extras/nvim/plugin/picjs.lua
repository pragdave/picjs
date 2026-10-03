-- Neovim support for picjs

if vim.g.loaded_picjs then
  return
end
vim.g.loaded_picjs = true

-- Highlight ```picjs blocks in Markdown files. This works with Neovim's
-- regex-based Markdown syntax; Tree-sitter Markdown highlighting would need a
-- Tree-sitter grammar for picjs. Set vim.g.picjs_markdown_fenced = false to
-- turn it off.
if vim.g.picjs_markdown_fenced ~= false then
  local languages = vim.g.markdown_fenced_languages or {}
  if not vim.tbl_contains(languages, "picjs") then
    table.insert(languages, "picjs")
    vim.g.markdown_fenced_languages = languages
  end
end
