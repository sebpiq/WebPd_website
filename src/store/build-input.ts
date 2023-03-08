import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface BuildInputState {
    url: string | null
    filepath: string | null
    arrayBuffer: ArrayBuffer | null
    focusOn: 'url' | 'local'
}

const initialState: BuildInputState = {
    url: null,
    filepath: null,
    arrayBuffer: null,
    focusOn: 'local',
}

export default createSlice({
    name: 'buildInput',
    initialState,
    reducers: {
        setUrl: (state, action: PayloadAction<string>) => {
            state.url = action.payload
            state.focusOn = 'url'
        },
        fetchUrlError: (_, __: PayloadAction<string>) => {},
        fetchUrlSuccess: (state, action: PayloadAction<{url: string, arrayBuffer: ArrayBuffer}>) => {
            state.filepath = null
            state.url = action.payload.url
            state.arrayBuffer = action.payload.arrayBuffer
        },
        setLocalFile: (state, action: PayloadAction<{filepath: string, arrayBuffer: ArrayBuffer}>) => {
            state.url = null
            state.filepath = action.payload.filepath
            state.arrayBuffer = action.payload.arrayBuffer
            state.focusOn = 'local'
        },
        setFocusOn: (state, action: PayloadAction<BuildInputState['focusOn']>) => {
            state.focusOn = action.payload
        }
    },
})