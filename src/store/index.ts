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
import { all, call } from 'redux-saga/effects'
import { watchSetUrl } from './build-input-sagas'
import { watchStartBuild } from './artefacts-sagas'
import { selectAppWillBuildOnLoad } from './app-selectors'
import { initializeApp } from './app-sagas'
const sagaMiddleware = createSagaMiddleware()

export const store = configureStore({
    reducer: {
        app: app.reducer,
        buildInput: buildInput.reducer,
        buildOutput: buildOutput.reducer,
        artefacts: artefacts.reducer,
        console: console_.reducer
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

function* rootSaga() {
    yield all([initializeApp(), watchSetUrl(), watchStartBuild()])
}

sagaMiddleware.run(rootSaga)

ReduxQuerySync({
    store,
    params: {
        jsOrAsc: {
            selector: selectBuildOutputCodeTarget,
            action: buildOutput.actions.setCodeTarget,
            defaultValue: buildOutput.getInitialState().codeTarget
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
            valueToString: (value: boolean) => value ? '1': '0',
        },
    },
    initialTruth: 'location',
})
