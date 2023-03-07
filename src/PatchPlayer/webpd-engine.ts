import { runtime, Artefacts } from 'webpd'
import { PatchPlayer } from './types'

export const createEngine = async (
    patchPlayer: PatchPlayer,
    stream: MediaStream,
    artefacts: Artefacts
) => {
    const sourceNode = patchPlayer.audioContext.createMediaStreamSource(stream)
    const webpdNode = new runtime.WebPdWorkletNode(patchPlayer.audioContext)
    sourceNode.connect(webpdNode)
    webpdNode.connect(patchPlayer.audioContext.destination)
    webpdNode.port.onmessage = (message) => runtime.fs.web(webpdNode, message)

    if (artefacts.compiledJs) {
        webpdNode.port.postMessage({
            type: 'code:JS',
            payload: {
                jsCode: artefacts.compiledJs,
            },
        })
    } else if (artefacts.wasm) {
        webpdNode.port.postMessage({
            type: 'code:WASM',
            payload: {
                wasmBuffer: artefacts.wasm,
            },
        })
    } else {
        throw new Error(`Missing artefacts for creating the engine`)
    }
    return webpdNode
}
