import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { build } from 'webpd'

interface AppState {
    isInitialized: boolean
}

export const appInitializationDone = createAsyncThunk(
    'app/initializationDone',
    async () => {
        build.setAsc(window.asc)
    }
)

export default createSlice({
    name: 'app',
    initialState: {
        isInitialized: false,
    } as AppState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(appInitializationDone.fulfilled.type, (state) => {
            state.isInitialized = true
        })
    },
})
