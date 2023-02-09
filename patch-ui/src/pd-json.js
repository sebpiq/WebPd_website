import parse from '@webpd/pd-parser'

export const PORTLET_ID = '0'

export const loadPdJson = async (url) => {
    const response = await fetch(url)
    const pdFile = await response.text()
    return parse(pdFile)
}

export const getPdNode = (pdJson, [patchId, nodeId]) =>
    pdJson.patches[patchId].nodes[nodeId]