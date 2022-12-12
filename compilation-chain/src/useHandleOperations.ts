import { audioworkletJsEval } from "@webpd/audioworklets"
import { useEffect } from "react"
import { AppDispatcher, AppState, TextStepId } from "./appState"
import { buildStepList, toDspGraph, toJs, toPdJson } from "./operations"


const useHandleOperations = (state: AppState, dispatch: AppDispatcher) => {
    useEffect(() => {
        const {operations} = state
        if (operations.target === null || operations.currentStep === null) {
            return
        }
        const queue = operations.queue || buildStepList(operations.target, operations.currentStep)
        
        const dispatchTextOperationError = () => {
            dispatch({ 
                type: 'TEXT_OPERATION_ERROR', payload: {}
            })
        }

        const dispatchTextOperationSuccess = (result: string) => {
            dispatch({ 
                type: 'TEXT_OPERATION_DONE',
                payload: {
                    currentStep: queue[1] as TextStepId,
                    queue: queue.slice(1), 
                    result
                }
            })
        }
        console.log('useHandleOperations', queue[0])

        switch(queue[0]) {
            case 'pd':
                let pdJson: string = ''
                try {
                    pdJson = toPdJson(state.textSteps.pd.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(pdJson)
                break

            case 'pdJson':
                let dspGraph: string = ''
                try {
                    dspGraph = toDspGraph(state.textSteps.pdJson.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(dspGraph)
                break

            case 'dspGraph':
                let jsCode: string = ''
                try {
                    jsCode = toJs(state.textSteps.dspGraph.text)
                } catch (err) {
                    dispatchTextOperationError()
                    break
                }
                dispatchTextOperationSuccess(jsCode)
                break

            case 'jsCode':
                if (state.audioStep.waaNode) {
                    state.audioStep.waaNode.disconnect()
                }
                const waaNode = new audioworkletJsEval.WorkletNode(state.audioStep.context, 2)
                waaNode.connect(state.audioStep.context.destination)
                waaNode.port.postMessage({
                    type: 'CODE',
                    payload: { code: state.textSteps.jsCode.text, arrays: {} }//, arrays }
                })
                dispatch({ type: 'AUDIO_OPERATION_DONE', payload: {waaNode} })
        }
    })
}

export default useHandleOperations