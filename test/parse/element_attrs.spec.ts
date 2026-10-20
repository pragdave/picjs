import {
  line,
  number,
  shape,
  string,
  testParse,
} from "../helpers/ast.js"

const attr = (name: string, value: string) => ({ name: string(name), value: string(value) })

testParse(`Box id api`,
  shape(`SBox`, { _elementAttrs: [ attr(`id`, `api`) ] }))

testParse(`Box attr data-role gateway`,
  shape(`SBox`, { _elementAttrs: [ attr(`data-role`, `gateway`) ] }))

testParse(`Box attr "aria-label" "The gateway"`,
  shape(`SBox`, { _elementAttrs: [ attr(`aria-label`, `The gateway`) ] }))

testParse(`Box attr data-x 1.5`,
  shape(`SBox`, { _elementAttrs: [ attr(`data-x`, `1.5`) ] }))

testParse(`Box id api x 1 attr class hl`,
  shape(`SBox`, { x: number(1), _elementAttrs: [ attr(`id`, `api`), attr(`class`, `hl`) ] }))

testParse(`Box id cafe`,
  shape(`SBox`, { _elementAttrs: [ attr(`id`, `cafe`) ] }))

testParse(`Line id wire`,
  line({ line_path: string(`straight`), _elementAttrs: [ attr(`id`, `wire`) ] }))
