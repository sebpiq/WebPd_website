import React, { useState } from "react";
import { AppAction, TextStepId, TextStepState } from "./appState";
import './StepText.css'

interface Props {
    state: TextStepState
    isBeingModified: boolean
    dispatch: React.Dispatch<AppAction>
    step: TextStepId
}

const StepText: React.FunctionComponent<Props> = ({ 
    state, 
    dispatch,
    step,
    isBeingModified,
}) => {
    const [currentText, setCurrentText] = useState(state.text)

    const onSubmit: React.FormEventHandler = (event) => {
        event.preventDefault()
        dispatch({ 
            type: 'TEXT_STEP_COMMIT', 
            payload: {step, text: currentText},
        })
    }

    const onChange: React.ChangeEventHandler<HTMLTextAreaElement> = (event) => {
        setCurrentText(event.currentTarget.value)
        if (currentText !== state.text) {
            dispatch({ 
                type: 'TEXT_STEP_MODIFIED',
                payload: {step}
            })
        }
    }

    const onKeyPress: React.KeyboardEventHandler = (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            onSubmit(event)
        }
    }

    const onExpandCollapseClicked = () => {
        dispatch({
            type: 'TEXT_STEP_EXPAND_COLLAPSE',
            payload: {
                isExpanded: !state.isExpanded,
                step
            }
        })
    }
    
    const submitDisabled = !isBeingModified

    return (
        <div className={`StepText ${isBeingModified ? '_modifying': ''} ${state.isExpanded ? '_expanded': ''}`}>
            <h2 onClick={onExpandCollapseClicked}>
                {step}<span className="_modifying">(*)</span>
                <button onClick={onExpandCollapseClicked}>{state.isExpanded ? '▲' : '▼'}</button>
            </h2>
            <form onSubmit={onSubmit}>
                <textarea 
                    onChange={onChange}
                    onKeyUp={onKeyPress}
                    value={currentText} 
                    spellCheck="false"
                />
                <input 
                    type="submit" 
                    disabled={submitDisabled}
                    value="Commit"
                />
            </form>
        </div>
    )
}

export default StepText