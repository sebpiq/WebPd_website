import { buildGraphNodeId, toDspGraph } from '@webpd/pd-json'
import compile from '@webpd/compiler-js'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from '@webpd/pd-registry'
import {
    fsWeb,
    WebPdWorkletNode,
} from '@webpd/audioworklets'
import { compileAsc } from './wasm'
import { PORTLET_ID } from './pd-json'

const BIT_DEPTH = 32

export const createEngine = async (STATE) => {
    const { pdJson, controls, audioContext } = STATE
    const dspGraph = toDspGraph(pdJson, NODE_BUILDERS)
    const inletCallerSpecs = _collectInletCallerSpecs(controls, dspGraph)
    const arrays = Object.values(pdJson.arrays).reduce(
        (arrays, array) => ({
            ...arrays,
            [array.args[0]]: array.data
                ? new Float32Array(array.data)
                : new Float32Array(array.args[1]),
        }),
        {}
    )

    const code = compile(dspGraph, NODE_IMPLEMENTATIONS, {
        target: STATE.target,
        inletCallerSpecs,
        audioSettings: {
            bitDepth: BIT_DEPTH,
            channelCount: { in: 0, out: 2 },
        },
    })

    const webpdNode = new WebPdWorkletNode(audioContext)
    webpdNode.connect(audioContext.destination)
    webpdNode.port.onmessage = (message) => fsWeb(webpdNode, message)
    if (STATE.target === 'javascript') {
        webpdNode.port.postMessage({
            type: 'code:JS',
            payload: {
                jsCode: code,
                arrays,
            },
        })
    } else if (STATE.target === 'assemblyscript') {
        const wasmBuffer = await compileAsc(
            code,
            BIT_DEPTH
        )
        webpdNode.port.postMessage({
            type: 'code:WASM',
            payload: {
                wasmBuffer,
                arrays,
            },
        })
    }
    return webpdNode
}

const _collectInletCallerSpecs = (controls, dspGraph, inletCallerSpecs = {}) => {
    controls.forEach((control) => {
        if (control.type === 'container') {
            inletCallerSpecs = _collectInletCallerSpecs(control.children, dspGraph, inletCallerSpecs)
        } else if (control.type === 'control') {
            const nodeId = buildGraphNodeId(control.patch.id, control.node.id)
            const portletId = PORTLET_ID
            if (!dspGraph[nodeId]) { return }
            inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || []
            inletCallerSpecs[nodeId].push(portletId)
        } else {
            throw new Error(`invalid type ${control.type}`)
        }
    })
    return inletCallerSpecs
}