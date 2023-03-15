import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import artefacts from './artefacts'

interface AppState {
    isInitialized: boolean
    willBuildOnLoad: boolean
    debug: boolean
}

export default createSlice({
    name: 'app',
    initialState: {
        isInitialized: false,
        willBuildOnLoad: false,
        debug: false,
    } as AppState,
    reducers: {
        setWillBuildOnLoad: (state, action: PayloadAction<boolean>) => {
            state.willBuildOnLoad = action.payload
        },
        initializationDone: (state) => {
            state.isInitialized = true
        },
        setDebug: (state, action: PayloadAction<boolean>) => {
            state.debug = action.payload
        },
        pointerUp: () => {}
    },
    extraReducers: (builder) => {
        builder.addCase(artefacts.actions.buildSuccess, (state) => {
            state.willBuildOnLoad = true
        })
    },
})
