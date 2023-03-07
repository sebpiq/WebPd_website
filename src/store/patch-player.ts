import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PatchPlayer, PatchPlayerValues } from "../PatchPlayer/types"
import artefacts from "./artefacts"
import { actionCleanBuild } from "./shared-action"

// We need to kep these out of state
// because these complex, non-serializable values
// cause errors with immer and RTK.
export const ASSETS: {
    patchPlayer: PatchPlayer | null
} = {
    patchPlayer: null
}

interface PatchPlayerState {
    values: PatchPlayerValues
}

const initialState: PatchPlayerState = {
    values: {},
}

export default createSlice({
    name: 'patchPlayer',
    initialState,
    reducers: {
        valuesChanged: (state, action: PayloadAction<PatchPlayerValues>) => {
            state.values = action.payload
        },
    },
    extraReducers: (builder) => {
        builder.addCase(artefacts.actions.buildSuccess, (_, action) => {
            ASSETS.patchPlayer = action.payload.patchPlayer
        })
        builder.addCase(actionCleanBuild, () => {
            ASSETS.patchPlayer = null
            return initialState
        })
    },
})