import { useEffect } from "react"
import { audioworkletJsEval, audioworkletWasm, addModule } from '@webpd/audioworklets'
import { AppDispatcher, AppState } from "./appState"

const useInitialize = (state: AppState, dispatch: AppDispatcher) => {
    useEffect(() => {
        if (state.isInitialized) {
            return 
        }
        addModule(state.audioStep.context, audioworkletJsEval.WorkletProcessorCode)
            .then(() => addModule(state.audioStep.context, audioworkletWasm.WorkletProcessorCode)
            .then(() => dispatch({ type: 'APP_INITIALIZED', payload: {} }))
        )
    })
}

export default useInitialize