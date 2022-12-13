import parse from '@webpd/pd-parser'
import compile from '@webpd/compiler-js'
import { toDspGraph } from '@webpd/pd-json'
import { audioworkletJsEval, audioworkletWasm } from '@webpd/audioworklets'
import { useEffect } from 'react'
import { AppDispatcher, AppState, SoundSource, StepId, TextStepId } from './appState'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from '@webpd/pd-registry'
import { DspGraph } from '@webpd/dsp-graph'
import { compileAsc } from './utils'

export const CHANNEL_COUNT = { in: 2, out: 2 }

const useHandleOperations = (state: AppState, dispatch: AppDispatcher) => {
    useEffect(() => {
        const { operations, compilationOptions, soundSourceOptions } = state
        if (operations.nextStep === null) {
            return
        }

        const runTextOperation = (
            operation: () => string,
            nextStep: StepId
        ) => {
            let result: string
            try {
                result = operation()
            } catch (err) {
                dispatchTextOperationError()
                return
            }
            dispatch({
                type: 'TEXT_OPERATION_DONE',
                payload: {
                    currentStep: operations.nextStep as TextStepId,
                    nextStep,
                    result,
                },
            })
        }

        const dispatchTextOperationError = () => {
            dispatch({
                type: 'TEXT_OPERATION_ERROR',
                payload: {},
            })
        }

        const dispatchWasmBufferSuccess = (buffer: ArrayBuffer) => {
            dispatch({
                type: 'WASM_OPERATION_DONE',
                payload: {
                    nextStep: 'audio',
                    buffer,
                },
            })
        }

        switch (operations.nextStep) {
            case 'pdJson':
                runTextOperation(() => {
                    return JSON.stringify(
                        parse(state.textSteps.pd.text),
                        undefined,
                        2
                    )
                }, 'dspGraph')
                break

            case 'dspGraph':
                runTextOperation(
                    () => {
                        const pdJson = JSON.parse(state.textSteps.pdJson.text)
                        const dspGraph = toDspGraph(pdJson, NODE_BUILDERS)
                        return JSON.stringify(dspGraph, undefined, 2)
                    },
                    compilationOptions.target === 'js-eval'
                        ? 'jsCode'
                        : 'ascCode'
                )
                break

            case 'jsCode':
                runTextOperation(() => {
                    const dspGraph = JSON.parse(state.textSteps.dspGraph.text)
                    return compile(dspGraph, NODE_IMPLEMENTATIONS as any, {
                        audioSettings: {
                            channelCount: CHANNEL_COUNT,
                            bitDepth: compilationOptions.bitDepth,
                        },
                        target: 'javascript',
                    })
                }, 'audio')
                break

            case 'ascCode':
                runTextOperation(() => {
                    const dspGraph = JSON.parse(
                        state.textSteps.dspGraph.text
                    ) as DspGraph.Graph
                    return compile(dspGraph, NODE_IMPLEMENTATIONS as any, {
                        audioSettings: {
                            channelCount: CHANNEL_COUNT,
                            bitDepth: compilationOptions.bitDepth,
                        },
                        target: 'assemblyscript',
                    })
                }, 'wasm')
                break

            case 'wasm':
                compileAsc(state.textSteps.ascCode.text).then((buffer) => {
                    dispatchWasmBufferSuccess(buffer)
                })
                break

            case 'audio':
                const { target } = compilationOptions
                const { webpdNode, stream, context } = state.audioStep
                const audioElement = document.querySelector("audio#test-sound") as HTMLMediaElement
                if (webpdNode) {
                    webpdNode.disconnect()
                }

                let sourceNode: AudioNode
                if (soundSourceOptions.source === SoundSource.microphone) {
                    audioElement.volume = 0
                    sourceNode = context.createMediaStreamSource(stream!)
                } else if (soundSourceOptions.source === SoundSource.sample) {
                    audioElement.volume = 1
                    sourceNode = context.createMediaElementSource(audioElement)
                } else {
                    throw new Error(`Invalid sound source ${soundSourceOptions.source}`)
                }

                let newWebpdNode: AudioWorkletNode
                if (target === 'js-eval') {
                    newWebpdNode = new audioworkletJsEval.WorkletNode(
                        context
                    )
                    newWebpdNode.port.postMessage({
                        type: 'CODE',
                        payload: {
                            code: state.textSteps.jsCode.text,
                            arrays: {},
                        },
                    })
                } else if (target === 'wasm') {
                    newWebpdNode = new audioworkletWasm.WorkletNode(
                        context
                    )
                    newWebpdNode.port.postMessage({
                        type: 'WASM',
                        payload: {
                            wasmBuffer: state.wasmStep.buffer!,
                            arrays: {},
                        },
                    })
                } else {
                    throw new Error(`Invalid target ${target}`)
                }

                sourceNode.connect(newWebpdNode)
                newWebpdNode.connect(context.destination)
                dispatch({
                    type: 'AUDIO_OPERATION_DONE',
                    payload: { webpdNode: newWebpdNode },
                })
                break
        }
    })
}

export default useHandleOperations
