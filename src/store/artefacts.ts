import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Artefacts, build, BuildFormat } from 'webpd'
import buildInput from './build-input'
import buildOutput from './build-output'

interface ArtefactsState {
    artefacts: Artefacts
    isBuilding: boolean
    warnings: Array<string> | null
    errors: Array<string> | null
    step: BuildFormat | null
}

const initialState: ArtefactsState = {
    artefacts: build.createArtefacts(),
    isBuilding: false,
    warnings: null,
    errors: null,
    step: null,
}

export default createSlice({
    name: 'buildOutput',
    initialState,
    reducers: {
        setArtefacts: (state, action: PayloadAction<Artefacts>) => {
            state.artefacts = action.payload
        },
        startBuild: (state) => {
            state.isBuilding = true
            state.warnings = null
            state.errors = null
        },
        buildComplete: (state, action: PayloadAction<Artefacts>) => {
            state.artefacts = action.payload
            state.isBuilding = false
        },
        startStep: (state, action: PayloadAction<BuildFormat>) => {
            state.step = action.payload
        },
        stepComplete: (
            state,
            action: PayloadAction<{
                status: 0 | 1
                errors?: Array<string>
                warnings?: Array<string>
            }>
        ) => {
            if (action.payload.warnings) {
                state.warnings = [...(state.warnings || []), ...action.payload.warnings]
            }
            if (action.payload.errors) {
                state.errors = [...(state.errors || []), ...action.payload.errors]
            }
            if (action.payload.status === 1) {
                state.isBuilding = false
            }
        },
    },
    extraReducers(builder) {
        builder.addCase(buildOutput.actions.setFormat, () => initialState)
        builder.addCase(buildInput.actions.setLocalFile, () => initialState)
    },
})
