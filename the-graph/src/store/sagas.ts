import * as fbpGraph from 'fbp-graph'
import compile, { NODE_IMPLEMENTATIONS } from '@webpd/compiler-js'
import evalEngine, {
    Engine,
    ENGINE_ARRAYS_VARIABLE_NAME,
} from '@webpd/engine-live-eval'
import { all, takeLatest, put, select, call } from 'redux-saga/effects'
import { getUiGraph, getWebpdContext, getWebpdEngine, getWebpdIsInitialized } from './selectors'
import { setCreated, setInitialized, WebPdDspToggled, WEBPD_CREATE, WEBPD_DSP_TOGGLE } from './webpd'
import { uiToDsp } from '../core/graph-conversion'
import { UI_GRAPH_CHANGED } from './ui'

function* webpdCreateEngine() {
    const context = new AudioContext()
    const engine: Engine = yield call(evalEngine.create, context, {
        sampleRate: context.sampleRate,
        channelCount: 2,
    })
    yield put(setCreated(context, engine))
}

function* webpdInitializeEngine() {
    const context: AudioContext = yield select(getWebpdContext)
    let engine: Engine = yield select(getWebpdEngine)
    engine = yield call(evalEngine.init, engine)
    yield put(setInitialized(context, engine))

    const graph: fbpGraph.Graph = yield select(getUiGraph)
    yield call(webpdSetGraph, graph)
}

function* webpdSetGraph(graph: fbpGraph.Graph) {
    const engine: Engine = yield select(getWebpdEngine)

    const dspGraph = uiToDsp(graph)
    const code: PdEngine.SignalProcessorCode = yield call(compile, dspGraph, NODE_IMPLEMENTATIONS, {
        ...engine.settings,
        arraysVariableName: ENGINE_ARRAYS_VARIABLE_NAME,
    })
    yield call(evalEngine.run, engine, code, {})
}

function* webpdToggleDsp(action: WebPdDspToggled) {
    const context: AudioContext = yield select(getWebpdContext)
    const isInitialized: boolean = yield select(getWebpdIsInitialized)
    if (action.payload.isDspOn) {
        yield call(() => context.resume())
        if (!isInitialized) {
            yield call(webpdInitializeEngine)
        }
    } else {
        yield call(() => context.suspend())
    }
}

function* webpdCreateSaga() {
    yield takeLatest(WEBPD_CREATE, webpdCreateEngine)
}

function* webpdDspToggleSaga() {
    yield takeLatest(WEBPD_DSP_TOGGLE, webpdToggleDsp)
}

function* _webpdSetUiGraphSaga() {
    const isInitialized: boolean = yield select(getWebpdIsInitialized)
    if (isInitialized) {
        const graph: fbpGraph.Graph = yield select(getUiGraph)
        yield call(webpdSetGraph, graph)
    }
}

function* webpdSetUiGraphSaga() {
    yield takeLatest(UI_GRAPH_CHANGED, _webpdSetUiGraphSaga)
}

export default function* rootSaga() {
    yield all([
        webpdCreateSaga(),
        webpdDspToggleSaga(),
        webpdSetUiGraphSaga()
    ])
}
