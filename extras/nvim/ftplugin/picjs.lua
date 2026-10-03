-- Neovim filetype plugin for picjs

if vim.b.did_ftplugin then
  return
end
vim.b.did_ftplugin = true

local bo = vim.bo

bo.commentstring = "// %s"   -- used by gc / gcc
bo.comments = "://"
bo.suffixesadd = ".picjs"
vim.opt_local.formatoptions:remove("t")
vim.opt_local.formatoptions:append("croql")

local undo = "setlocal commentstring< comments< suffixesadd< formatoptions<"

-- The examples and docs use two-space indents. Set
-- vim.g.picjs_recommended_style = false to keep your own settings.
if vim.g.picjs_recommended_style ~= false then
  bo.expandtab = true
  bo.shiftwidth = 2
  bo.softtabstop = 2
  undo = undo .. " expandtab< shiftwidth< softtabstop<"
end

vim.b.undo_ftplugin = undo
