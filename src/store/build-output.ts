import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { Build } from "webpd"
import { BuildFormatWebSite, CodeTarget } from "../types"
import buildInput from "./build-input"

export const AVAILABLE_OUTPUT_FORMATS: Array<Build.BuildFormat> = [
    'wav',
    'wasm',
]

interface BuildOutputState {
    format: BuildFormatWebSite | null
    codeTarget: CodeTarget
    previewDurationSeconds: number | null
}

const initialState: BuildOutputState = {
    format: null,
    codeTarget: 'JavaScript',
    previewDurationSeconds: 30,
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
        setPreviewDurationSeconds: (state, action: PayloadAction<number | null>) => {
            state.previewDurationSeconds = action.payload
        },
        clear: () => initialState
    },
    extraReducers(builder) {
        builder.addCase(buildInput.actions.setFocusOn, (state) => {
            state.format = null
        })
    },
})