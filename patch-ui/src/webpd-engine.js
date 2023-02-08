import { toDspGraph } from '@webpd/pd-json'
import compile from '@webpd/compiler-js'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from '@webpd/pd-registry'
import {
    fsWeb,
    WebPdWorkletNode,
} from '@webpd/audioworklets'
import { PORTLET_ID } from './pd-json'

export const createEngine = (STATE) => {
    const { pdJson, controls, audioContext } = STATE
    const inletCallerSpecs = _collectInletCallerSpecs(controls)
    const dspGraph = toDspGraph(pdJson, NODE_BUILDERS)

    const jsCode = compile(dspGraph, NODE_IMPLEMENTATIONS, {
        target: 'javascript',
        inletCallerSpecs,
        audioSettings: {
            bitDepth: 32,
            channelCount: { in: 0, out: 2 },
        },
    })

    const webpdNode = new WebPdWorkletNode(audioContext)
    webpdNode.connect(audioContext.destination)

    webpdNode.port.onmessage = (message) => fsWeb(webpdNode, message)
    webpdNode.port.postMessage({
        type: 'code:JS',
        payload: {
            jsCode,
            arrays: Object.values(pdJson.arrays).reduce(
                (arrays, array) => ({
                    ...arrays,
                    [array.args[0]]: array.data
                        ? new Float32Array(array.data)
                        : new Float32Array(array.args[1]),
                }),
                {}
            ),
        },
    })
    return webpdNode
}

const _collectInletCallerSpecs = (controls, inletCallerSpecs = {}) => {
    controls.forEach((control) => {
        if (control.type === 'container') {
            inletCallerSpecs = _collectInletCallerSpecs(control.controls, inletCallerSpecs)
        } else if (control.type === 'control') {
            const nodeId = control.graphNodeId
            const portletId = PORTLET_ID
            inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || []
            inletCallerSpecs[nodeId].push(portletId)
        } else {
            throw new Error(`invalid type ${control.type}`)
        }
    })
    return inletCallerSpecs
}