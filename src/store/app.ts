import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import artefacts from './artefacts'

interface AppState {
    isInitialized: boolean
    willBuildOnLoad: boolean
}

export default createSlice({
    name: 'app',
    initialState: {
        isInitialized: false,
        willBuildOnLoad: false,
    } as AppState,
    reducers: {
        setWillBuildOnLoad: (state, action: PayloadAction<boolean>) => {
            state.willBuildOnLoad = action.payload
        },
        initializationDone: (state) => {
            state.isInitialized = true
        }
    },
    extraReducers: (builder) => {
        builder.addCase(artefacts.actions.buildSuccess, (state) => {
            state.willBuildOnLoad = true
        })
    },
})
