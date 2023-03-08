import { configureStore } from '@reduxjs/toolkit'
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import buildInput from './build-input'
import buildOutput from './build-output'
import console_ from './console'
import artefacts from './artefacts'
import app from './app'
import ReduxQuerySync from 'redux-query-sync'
import {
    selectBuildOutputCodeTarget,
    selectBuildOutputFormat,
} from './build-output-selectors'
import { selectBuildInputUrl } from './build-input-selectors'
import createSagaMiddleware from 'redux-saga'
import { all } from 'redux-saga/effects'
import { watchSetUrl } from './build-input-sagas'
import { watchStartBuild } from './artefacts-sagas'
import { selectAppWillBuildOnLoad } from './app-selectors'
import { initializeApp } from './app-sagas'
import patchPlayer from './patch-player'
import { PatchPlayerValues } from '../PatchPlayer/types'
import { selectPatchPlayerValues } from './patch-player-selectors'
const sagaMiddleware = createSagaMiddleware()

export const store = configureStore({
    reducer: {
        app: app.reducer,
        buildInput: buildInput.reducer,
        buildOutput: buildOutput.reducer,
        artefacts: artefacts.reducer,
        console: console_.reducer,
        patchPlayer: patchPlayer.reducer,
    },
    // Needed because we pass ArrayBuffers and other nice things
    // in actions
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }).concat([sagaMiddleware]),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Redux-sagas for side-effects.
// Important to start this after all the other, to be sure our 
// store is initialized and synced with url state.
sagaMiddleware.run(function* rootSaga() {
    yield all([initializeApp(), watchSetUrl(), watchStartBuild()])
})

// Allows auto synchronization between redux state and url search params.
// NOTE: this seems to sync the state synchronously on load of the page,
// so no need to worry about race conditions. 
ReduxQuerySync({
    store,
    params: {
        jsOrAsc: {
            selector: selectBuildOutputCodeTarget,
            action: buildOutput.actions.setCodeTarget,
            defaultValue: buildOutput.getInitialState().codeTarget,
        },
        target: {
            selector: selectBuildOutputFormat,
            action: buildOutput.actions.setFormat,
            defaultValue: buildOutput.getInitialState().format,
        },
        url: {
            selector: selectBuildInputUrl,
            action: buildInput.actions.setUrl,
            defaultValue: buildInput.getInitialState().url,
        },
        build: {
            selector: selectAppWillBuildOnLoad,
            action: app.actions.setWillBuildOnLoad,
            defaultValue: app.getInitialState().willBuildOnLoad,
            stringToValue: (str: string) => str === '1',
            valueToString: (value: boolean) => (value ? '1' : '0'),
        },
        pp: {
            selector: selectPatchPlayerValues,
            action: patchPlayer.actions.valuesChanged,
            defaultValue: patchPlayer.getInitialState().values,
            stringToValue: (str: string) => JSON.parse(str),
            valueToString: (value: PatchPlayerValues) => JSON.stringify(value),
        },
    },
    replaceState: true,
    initialTruth: 'location',
})