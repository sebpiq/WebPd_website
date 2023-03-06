import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import buildInput from './build-input'
import buildOutput from './build-output'
import artefacts from './artefacts'
import app from './app'

export const store = configureStore({
    reducer: {
        app: app.reducer,
        buildInput: buildInput.reducer,
        buildOutput: buildOutput.reducer,
        artefacts: artefacts.reducer,
    },
    // Needed because we pass ArrayBuffers and other nice things
    // in actions
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector