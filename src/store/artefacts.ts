import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Artefacts, build, BuildFormat } from 'webpd'
import { PatchPlayer } from '../PatchPlayer/PatchPlayer'
import buildInput from './build-input'
import buildOutput from './build-output'

// We need to kep these out of state
// because these complex, non-serializable values
// cause errors with immer and RTK.
export const ASSETS: {
    artefacts: Artefacts
    patchPlayer: PatchPlayer | null
} = {
    artefacts: build.createArtefacts(),
    patchPlayer: null,
}

interface ArtefactsState {
    isBuilding: boolean
    warnings: Array<string> | null
    errors: Array<string> | null
    step: BuildFormat | null
}

const initialState: ArtefactsState = {
    isBuilding: false,
    warnings: null,
    errors: null,
    step: null,
}

export default createSlice({
    name: 'buildOutput',
    initialState,
    reducers: {
        startBuild: (state) => {
            state.isBuilding = true
            state.warnings = null
            state.errors = null
        },
        buildComplete: (state, action: PayloadAction<{artefacts: Artefacts, patchPlayer: PatchPlayer | null}>) => {
            ASSETS.artefacts = action.payload.artefacts
            ASSETS.patchPlayer = action.payload.patchPlayer
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
        builder.addCase(buildOutput.actions.setFormat, () => {
            ASSETS.artefacts = build.createArtefacts()
            return initialState
        })
        builder.addCase(buildInput.actions.setLocalFile, () => {
            ASSETS.artefacts = build.createArtefacts()
            return initialState
        })
    },
})
