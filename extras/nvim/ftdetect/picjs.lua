-- Detect picjs files. *.jp is the language's old extension.
vim.filetype.add({
  extension = {
    picjs = "picjs",
    jp = "picjs",
  },
})
