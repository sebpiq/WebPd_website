import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Artefacts, build, BuildFormat } from 'webpd'
import { PatchPlayer } from '../PatchPlayer/PatchPlayer'
import buildInput from './build-input'
import buildOutput from './build-output'

export const BUILD_STATUS = {
    INIT: 0,
    IN_PROGRESS: 1,
    SUCCESS: 2,
    ERRORED: 3,
}

type BuildStatus = typeof BUILD_STATUS.INIT | typeof BUILD_STATUS.IN_PROGRESS | typeof BUILD_STATUS.SUCCESS | typeof BUILD_STATUS.ERRORED

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
    buildStatus: BuildStatus
    step: BuildFormat | null
}

const initialState: ArtefactsState = {
    buildStatus: BUILD_STATUS.INIT,
    step: null,
}

export default createSlice({
    name: 'buildOutput',
    initialState,
    reducers: {
        startBuild: (state) => {
            state.buildStatus = BUILD_STATUS.IN_PROGRESS
        },
        buildSuccess: (state, action: PayloadAction<{artefacts: Artefacts, patchPlayer: PatchPlayer | null}>) => {
            ASSETS.artefacts = action.payload.artefacts
            ASSETS.patchPlayer = action.payload.patchPlayer
            state.buildStatus = BUILD_STATUS.SUCCESS
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
            if (action.payload.status === 1) {
                state.buildStatus = BUILD_STATUS.ERRORED
            }
        },
        clean: () => {
            ASSETS.artefacts = build.createArtefacts()
            return initialState
        }
    },
    extraReducers(builder) {
        const reset = () => {
            ASSETS.artefacts = build.createArtefacts()
            return initialState
        }
        builder.addCase(buildOutput.actions.setFormat, reset)
        builder.addCase(buildInput.actions.setLocalFile, reset)
        builder.addCase(buildInput.actions.setUrlFile, reset)
    },
})
