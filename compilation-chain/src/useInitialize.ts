import { useEffect } from "react"
import { audioworkletJsEval, audioworkletWasm, addModule } from '@webpd/audioworklets'
import { AppDispatcher, AppState } from "./appState"

const useInitialize = (state: AppState, dispatch: AppDispatcher) => {
    const audioElement = document.querySelector("audio#test-sound") as HTMLMediaElement
    useEffect(() => {
        if (state.isInitialized) {
            return 
        }
        audioElement.volume = 0
        addModule(state.audioStep.context, audioworkletJsEval.WorkletProcessorCode)
            .then(() => addModule(state.audioStep.context, audioworkletWasm.WorkletProcessorCode))
            .then(() => navigator.mediaDevices.getUserMedia({audio: true}))
            .then((stream) => {
                dispatch({ type: 'APP_INITIALIZED', payload: { stream } })
            })
            .catch((err) => {
                throw new Error(`failed getting user media ${err}`)
            })
    })
}

export default useInitialize