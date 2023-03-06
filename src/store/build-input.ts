import { createSlice, PayloadAction } from "@reduxjs/toolkit"

interface BuildInputState {
    url: string | null
    filepath: string | null
    arrayBuffer: ArrayBuffer | null
}

export default createSlice({
    name: 'buildInput',
    initialState: {
        url: null,
        filepath: null,
        arrayBuffer: null,
    } as BuildInputState,
    reducers: {
        setUrl: (state, action: PayloadAction<string>) => {
            state.url = action.payload
        },
        setFileFromUrl: (state, action: PayloadAction<ArrayBuffer>) => {
            state.arrayBuffer = action.payload
        },
        fetchUrlError: (_, __: PayloadAction<string>) => {},
        setLocalFile: (state, action: PayloadAction<{filepath: string, arrayBuffer: ArrayBuffer}>) => {
            state.filepath = action.payload.filepath
            state.arrayBuffer = action.payload.arrayBuffer
        },
    },
})