import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import artefacts from "./artefacts"
import buildInput from "./build-input"
import buildOutput from "./build-output"

interface ConsoleState {
    warnings: Array<string> | null
    errors: Array<string> | null
}

const initialState: ConsoleState = {
    warnings: null,
    errors: null,
}

export default createSlice({
    name: 'console',
    initialState,
    reducers: {
        setState: (_, action: PayloadAction<ConsoleState>) => {
            return action.payload
        },
    },
    extraReducers(builder) {
        builder.addCase(artefacts.actions.startBuild, () => initialState)
        builder.addCase(artefacts.actions.stepComplete, (
            state,
            action
        ) => {
            if (action.payload.warnings) {
                state.warnings = [...(state.warnings || []), ...action.payload.warnings]
                if (state.warnings.length === 0) {
                    state.warnings = null
                }
            }
            if (action.payload.errors) {
                state.errors = [...(state.errors || []), ...action.payload.errors]
            }
        })
        builder.addCase(buildInput.actions.setUrl, () => initialState)
        builder.addCase(buildInput.actions.setLocalFile, () => initialState)
        builder.addCase(buildInput.actions.clear, () => initialState)
        builder.addCase(buildOutput.actions.setFormat, () => initialState)
        builder.addCase(buildInput.actions.fetchUrlError, (
            state,
            action
        ) => {
            state.errors = [action.payload]
        })
    },
})