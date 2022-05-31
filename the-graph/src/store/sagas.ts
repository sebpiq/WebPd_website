import * as fbpGraph from 'fbp-graph'
import compileDspGraph, { NODE_IMPLEMENTATIONS } from '@webpd/compiler-js'
import compilePdJson from '@webpd/dsp-graph'
import evalEngine, {
    Engine,
    ENGINE_ARRAYS_VARIABLE_NAME,
} from '@webpd/engine-live-eval'
import { all, takeLatest, put, select, call, take, fork } from 'redux-saga/effects'
import { getUiGraph, getWebpdContext, getWebpdEngine, getWebpdIsInitialized } from './selectors'
import { setCreated, setInitialized, WebPdDspToggled, WebPdRequestLoadJson, WEBPD_CREATE, WEBPD_DSP_TOGGLE, WEBPD_REQUEST_LOAD_JSON, WEBPD_SET_JSON } from './webpd'
import { incrementGraphVersion, setUiGraph } from './ui'
import { attachEdgeMetadata, pdToLibrary, pdToUi, uiToPd } from '../core/graph-conversion'
import { Library } from '../core/types'
import { END, EventChannel, eventChannel } from 'redux-saga'

const uiGraphEventChannel = (uiGraph: fbpGraph.Graph) => {
    return eventChannel(emitter => {
        uiGraph.on('endTransaction', () => {
            console.log('endTransaction', uiGraph)
            
            emitter(null)
        })
        // TODO ? 
        uiGraph.on('close', () => {
            emitter(END)
        })
        return () => {
            uiGraph.removeAllListeners()
        }
    })
}

function* uiGraphEventsSaga(uiGraph: fbpGraph.Graph) {
    // TODO : terminate on new UI graph (and clean / kill EventChannel)
    const events: EventChannel<null> = yield call(uiGraphEventChannel, uiGraph)
    try {    
      while (true) {
        // take(END) will cause the saga to terminate by jumping to the finally block
        yield take(events)
        const webpdEngine: Engine = yield select(getWebpdEngine)
        attachEdgeMetadata(uiGraph, webpdEngine.settings)

        yield put(incrementGraphVersion())
        // set ui, set pdjson, set engine
        yield call(syncWithUiGraph, uiGraph)
        console.log('ui GRAPH CHANGE')
      }
    } catch(err) {
        console.error(err)
    } finally {
      console.log('ui graph channel terminated')
    }
}

function* syncWithUiGraph(uiGraph: fbpGraph.Graph) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const pdJson = uiToPd(uiGraph, webpdEngine.settings)
    if (isWebpdInitialized) {
        yield call(runDspGraph, pdJson)
    }
}

function* syncWithPdJson(pdJson: PdJson.Pd) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const uiGraph: fbpGraph.Graph = yield call(pdToUi, pdJson, webpdEngine.settings)
    const library: Library = yield call(pdToLibrary, pdJson, webpdEngine.settings)
    yield put(setUiGraph(uiGraph, library))
    if (isWebpdInitialized) {
        yield call(runDspGraph, pdJson)
    }
    yield fork(uiGraphEventsSaga, uiGraph)
}

function* runDspGraph(pdJson: PdJson.Pd) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const dspGraph = compilePdJson(pdJson)
    const code: PdEngine.SignalProcessorCode = yield call(compileDspGraph, dspGraph, NODE_IMPLEMENTATIONS, {
        ...webpdEngine.settings,
        arraysVariableName: ENGINE_ARRAYS_VARIABLE_NAME,
    })
    yield call(evalEngine.run, webpdEngine, code, {})
}

function* webpdCreateEngine() {
    const context = new AudioContext()
    const webpdEngine: Engine = yield call(evalEngine.create, context, {
        sampleRate: context.sampleRate,
        channelCount: 2,
    })
    yield put(setCreated(context, webpdEngine))
}

function* webpdInitializeEngine() {
    const context: AudioContext = yield select(getWebpdContext)
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const uiGraph: fbpGraph.Graph = yield select(getUiGraph)
    let engine: Engine = yield select(getWebpdEngine)
    engine = yield call(evalEngine.init, engine)
    yield put(setInitialized(context, engine))

    const pdJson = uiToPd(uiGraph, webpdEngine.settings)
    if (pdJson) {
        yield call(runDspGraph, pdJson)
    }
}

function* webpdToggleDsp(action: WebPdDspToggled) {
    const context: AudioContext = yield select(getWebpdContext)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    if (action.payload.isDspOn) {
        yield call(() => context.resume())
        if (!isWebpdInitialized) {
            yield call(webpdInitializeEngine)
        }
    } else {
        yield call(() => context.suspend())
    }
}

function* _webpdRequestLoadJsonSaga(action: WebPdRequestLoadJson) {
    yield call(syncWithPdJson, action.payload.pd)
}

function* webpdRequestLoadJsonSaga() {
    yield takeLatest(WEBPD_REQUEST_LOAD_JSON, _webpdRequestLoadJsonSaga)
}

function* webpdCreateSaga() {
    yield takeLatest(WEBPD_CREATE, webpdCreateEngine)
}

function* webpdDspToggleSaga() {
    yield takeLatest(WEBPD_DSP_TOGGLE, webpdToggleDsp)
}

export default function* rootSaga() {
    yield all([
        webpdCreateSaga(),
        webpdDspToggleSaga(),
        webpdRequestLoadJsonSaga()
    ])
}
