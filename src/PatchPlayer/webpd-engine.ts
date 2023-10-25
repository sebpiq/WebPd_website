import { Run, Build } from 'webpd'
import { PatchPlayer } from './types'

export const createEngine = async (
    patchPlayer: PatchPlayer,
    stream: MediaStream | null,
    artefacts: Build.Artefacts
) => {

    const webpdNode = new Run.WebPdWorkletNode(patchPlayer.audioContext)
    if (stream) {
        const sourceNode = patchPlayer.audioContext.createMediaStreamSource(stream)
        sourceNode.connect(webpdNode)
    }
    webpdNode.connect(patchPlayer.audioContext.destination)
    webpdNode.port.onmessage = (message) => Run.fsWeb(webpdNode, message, {
        rootUrl: Run.urlDirName(patchPlayer.patchUrl || '.')
    })

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
