import { createStore, combineReducers, applyMiddleware, compose } from 'redux'
import createSagaMiddleware from 'redux-saga'
import { uiReducer } from './ui'
import { webPdReducer } from './webpd'
import rootSaga from './sagas'

export type AppState = {
    webpd: ReturnType<typeof webPdReducer>,
    ui: ReturnType<typeof uiReducer>,
}

const rootReducer = combineReducers<AppState>({
    webpd: webPdReducer,
    ui: uiReducer,
})

const sagaMiddleware = createSagaMiddleware()

const enhancers = [applyMiddleware(sagaMiddleware)]
if (
    process.env.NODE_ENV === 'development' &&
    (window as any).__REDUX_DEVTOOLS_EXTENSION__
) {
    enhancers.push(
        (window as any).__REDUX_DEVTOOLS_EXTENSION__ &&
            (window as any).__REDUX_DEVTOOLS_EXTENSION__()
    )
}

const preloadedState = {}

export const store = createStore(
    rootReducer,
    preloadedState,
    compose(...enhancers)
)

sagaMiddleware.run(rootSaga)
