import { renderToStringAsync as renderToString } from "../../src/render-to-string.js"

const render = async (source: string, options = {}) => {
  const result = await renderToString(source, options)
  if (result.error) throw new Error(result.error)
  return result.svg
}

const renderError = async (source: string) => (await renderToString(source)).error

describe("Element attributes", () => {
  it("puts the id and attributes on the shape's element", async () => {
    const svg = await render(`Box id api attr data-role gateway`)
    expect(svg).toMatch(/<rect [^>]*id="api" data-role="gateway"/)
  })

  it("interpolates quoted names and values", async () => {
    const svg = await render(`n = 2\nBox attr "data-#{n}" "item #{n}"`)
    expect(svg).toMatch(/data-2="item 2"/)
  })

  it("puts them on the outer group of a shape with a label", async () => {
    const svg = await render(`Box "API" id api attr class hl`)
    expect(svg).toMatch(/<g data-jp-id="[^"]+" id="api" class="hl"><rect [^>]*id="api-s"/)
    expect(svg).toMatch(/<text [^>]*id="api-t"/)
  })

  it("puts them on a group", async () => {
    const svg = await render(`Group id grp { Box }`)
    expect(svg).toMatch(/<g [^>]*id="grp"/)
  })

  it("adds a class to the palette classes", async () => {
    const svg = await render(`Box attr class hl`)
    expect(svg).toMatch(/class="pj-fill-\S+ hl"/)
  })

  it("replaces the generated id without renumbering later shapes", async () => {
    const svg = await render(`Box id api\nCircle`, { ids: { prefix: "p" } })
    expect(svg).toMatch(/id="api"/)
    expect(svg).not.toMatch(/id="pa"/)
    expect(svg).toMatch(/<circle [^>]*id="pb"/)
  })

  it("allows ids made in a function", async () => {
    const svg = await render(`f = i => Box id "b#{i}"\nf(1)\nf(2)`)
    expect(svg).toMatch(/id="b1"/)
    expect(svg).toMatch(/id="b2"/)
  })

  it("rejects a duplicate id", async () => {
    expect(await renderError(`Box id a\nCircle id a`)).toMatch(/"a" is already used by a Box/)
  })

  it("rejects event handlers", async () => {
    expect(await renderError(`Box attr onclick foo`)).toMatch(/Event handler/)
  })

  it("rejects picjs's own data-jp- attributes", async () => {
    expect(await renderError(`Box attr data-jp-id foo`)).toMatch(/reserved/)
  })

  it("rejects an invalid name", async () => {
    expect(await renderError(`Box attr "bad name" foo`)).toMatch(/Invalid SVG attribute name/)
  })
})
