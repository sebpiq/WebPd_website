import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { BuildFormatWebSite, CodeTarget } from "../types"
import buildInput from "./build-input"

interface BuildOutputState {
    format: BuildFormatWebSite | null
    codeTarget: CodeTarget
}

const initialState: BuildOutputState = {
    format: null,
    codeTarget: 'JavaScript',
}

export default createSlice({
    name: 'buildOutput',
    initialState,
    reducers: {
        setFormat: (state, action: PayloadAction<BuildFormatWebSite>) => {
            state.format = action.payload
        },
        setCodeTarget: (state, action: PayloadAction<CodeTarget>) => {
            state.codeTarget = action.payload
        },
    },
    extraReducers(builder) {
        builder.addCase(buildInput.actions.setLocalFile, (state) => {
            state.format = null
        })
    },
})