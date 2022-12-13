import { audioworkletJsEval, audioworkletWasm } from "@webpd/audioworklets"
import { useEffect } from "react"
import { AppDispatcher, AppState, StepId, TextStepId } from "./appState"
import { compileAsc, toAsc, toDspGraph, toJs, toPdJson } from "./operations"


const useHandleOperations = (state: AppState, dispatch: AppDispatcher) => {
    useEffect(() => {
        const {operations} = state
        if (operations.nextStep === null) {
            return
        }
        
        const dispatchTextOperationError = () => {
            dispatch({ 
                type: 'TEXT_OPERATION_ERROR', payload: {}
            })
        }

        const dispatchTextOperationSuccess = (result: string, nextStep: StepId) => {
            dispatch({ 
                type: 'TEXT_OPERATION_DONE',
                payload: {
                    currentStep: operations.nextStep as TextStepId,
                    nextStep,
                    result
                }
            })
        }

        const dispatchWasmBufferSuccess = (buffer: ArrayBuffer) => {
            dispatch({ 
                type: 'WASM_OPERATION_DONE',
                payload: {
                    nextStep: 'audio',
                    buffer,
                }
            })
        }

        switch(operations.nextStep) {
            case 'pdJson':
                let pdJson: string = ''
                try {
                    pdJson = toPdJson(state.textSteps.pd.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(pdJson, 'dspGraph')
                break

            case 'dspGraph':
                let dspGraph: string = ''
                try {
                    dspGraph = toDspGraph(state.textSteps.pdJson.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(dspGraph, state.target === 'js-eval' ? 'jsCode' : 'ascCode')
                break

            case 'jsCode':
                let jsCode: string = ''
                try {
                    jsCode = toJs(state.textSteps.dspGraph.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(jsCode, 'audio')
                break

            case 'ascCode':
                let ascCode: string = ''
                try {
                    ascCode = toAsc(state.textSteps.dspGraph.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(ascCode, 'wasm')
                break

            case 'wasm':
                compileAsc(state.textSteps.ascCode.text)
                    .then((buffer) => {
                        dispatchWasmBufferSuccess(buffer)
                    })
                break
            
            case 'audio':
                if (state.audioStep.webpdNode) {
                    state.audioStep.webpdNode.disconnect()
                }
                let webpdNode: AudioWorkletNode
                if (state.target === 'js-eval') {
                    webpdNode = new audioworkletJsEval.WorkletNode(state.audioStep.context)
                    webpdNode.port.postMessage({
                        type: 'CODE',
                        payload: { code: state.textSteps.jsCode.text, arrays: {} }
                    })
                } else if (state.target === 'wasm') {
                    webpdNode = new audioworkletWasm.WorkletNode(state.audioStep.context)
                    webpdNode.port.postMessage({
                        type: 'WASM',
                        payload: {
                            wasmBuffer: state.wasmStep.buffer!,
                            arrays: {}
                        }
                    })
                } else {
                    throw new Error(`Invalid target ${state.target}`)
                }
                state.audioStep.sourceNode!.connect(webpdNode)
                webpdNode.connect(state.audioStep.context.destination)
                dispatch({ type: 'AUDIO_OPERATION_DONE', payload: {webpdNode} })
                break
        }
    })
}

export default useHandleOperations