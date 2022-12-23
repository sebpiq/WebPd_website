import { useEffect } from "react"
import { registerWebPdWorkletNode } from '@webpd/audioworklets'
import { AppDispatcher, AppState } from "./appState"

const useInitialize = (state: AppState, dispatch: AppDispatcher) => {
    const audioElement = document.querySelector("audio#test-sound") as HTMLMediaElement
    useEffect(() => {
        if (state.isInitialized) {
            return 
        }
        audioElement.volume = 0
        registerWebPdWorkletNode(state.audioStep.context)
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