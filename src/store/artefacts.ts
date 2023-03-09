import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Build } from 'webpd'
import { PatchPlayer } from '../PatchPlayer/types'
import buildInput from './build-input'
import buildOutput from './build-output'
import { actionCleanBuild } from './shared-action'

export const BUILD_STATUS = {
    INIT: 0,
    IN_PROGRESS: 1,
    SUCCESS: 2,
    ERRORED: 3,
}

type BuildStatus =
    | typeof BUILD_STATUS.INIT
    | typeof BUILD_STATUS.IN_PROGRESS
    | typeof BUILD_STATUS.SUCCESS
    | typeof BUILD_STATUS.ERRORED

// We need to kep these out of state
// because these complex, non-serializable values
// cause errors with immer and RTK.
export const ASSETS: {
    artefacts: Build.Artefacts
} = {
    artefacts: Build.createArtefacts(),
}

interface ArtefactsState {
    buildStatus: BuildStatus
    step: Build.BuildFormat | null
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
        buildSuccess: (
            state,
            action: PayloadAction<{
                artefacts: Build.Artefacts
                patchPlayer: PatchPlayer | null
            }>
        ) => {
            ASSETS.artefacts = action.payload.artefacts
            state.buildStatus = BUILD_STATUS.SUCCESS
        },
        startStep: (state, action: PayloadAction<Build.BuildFormat>) => {
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
    },
    extraReducers(builder) {
        const reset = () => {
            ASSETS.artefacts = Build.createArtefacts()
            return initialState
        }
        builder.addCase(actionCleanBuild, reset)
        builder.addCase(buildOutput.actions.setFormat, reset)
        builder.addCase(buildInput.actions.setLocalFile, reset)
        builder.addCase(buildInput.actions.fetchUrlSuccess, reset)
    },
})
