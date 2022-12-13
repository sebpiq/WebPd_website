import React, { useState } from "react";
import { AudioStepState } from "./appState";
import './StepAudio.css'

interface Props {
    state: AudioStepState
}

const StepAudio: React.FunctionComponent<Props> = ({ 
    state,
}) => {
    console.log('Audio STATE', state.context.state)
    const [_, setIsPlaying] = useState(state.context.state !== 'suspended')
    const onPlay: React.MouseEventHandler = () => {
        // https://github.com/WebAudio/web-audio-api/issues/345
        let promise: Promise<void>
        if (state.context.state === 'suspended') {
            promise = state.context.resume()
        } else {
            promise = state.context.suspend()
        }
        promise.then(() => {
            setIsPlaying(state.context.state !== 'suspended')
        })
    }

    return (
        <div className={`StepAudio ${state.context.state === 'suspended' ? '_paused' : '_playing'}`}>
            <button onClick={onPlay}>
                <span className="_play">▶</span>
                <span className="_pause">⏸</span>
            </button>
            <div className="_version">patch version : {state.version}</div>
        </div>
    )
}

export default StepAudio