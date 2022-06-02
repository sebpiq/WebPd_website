import * as fbpGraph from 'fbp-graph'
import compileToJsCode, { NODE_IMPLEMENTATIONS } from '@webpd/compiler-js'
import compileToDspGraph from '@webpd/dsp-graph'
import evalEngine, {
    Engine,
    ENGINE_ARRAYS_VARIABLE_NAME,
} from '@webpd/engine-live-eval'
import { all, takeLatest, put, select, call, take, fork } from 'redux-saga/effects'
import { getCurrentPdPatch, getModelGraph, getUiCanvasCenterPoint, getWebpdContext, getWebpdEngine, getWebpdIsInitialized } from './selectors'
import { setCreated, setInitialized, WebPdDspToggled, WEBPD_CREATE, WEBPD_DSP_TOGGLE } from './webpd'
import { incrementGraphVersion, ModelAddNode, ModelRequestLoadPd, MODEL_ADD_NODE, MODEL_REQUEST_LOAD_PD, setGraph } from './model'
import { updateEdgeMetadata, addNode, generateLibrary, loadPdJson, getPdJson, generateId } from '../core/graph-conversion'
import { Library } from '../core/types'
import { END, EventChannel, eventChannel } from 'redux-saga'
import { AppDimensions, Point } from './ui'

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
        updateEdgeMetadata(uiGraph, webpdEngine.settings)
        yield call(graphChanged, uiGraph)
      }
    } catch(err) {
        console.error(err)
    } finally {
      console.log('ui graph channel terminated')
    }
}

function* graphChanged (uiGraph: fbpGraph.Graph) {
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const webpdEngine: Engine = yield select(getWebpdEngine)
    yield put(incrementGraphVersion())
    const pdJson = getPdJson(uiGraph)
    const library: Library = yield call(generateLibrary, pdJson, webpdEngine.settings)
    yield put(setGraph(uiGraph, library))
    if (isWebpdInitialized) {
        yield call(runDspGraph, pdJson)
    }
    console.log('ui GRAPH CHANGED')
}

function* runDspGraph(pdJson: PdJson.Pd) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const dspGraph = compileToDspGraph(pdJson)
    const code: PdEngine.SignalProcessorCode = yield call(compileToJsCode, dspGraph, NODE_IMPLEMENTATIONS, {
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
    const uiGraph: fbpGraph.Graph = yield select(getModelGraph)
    let webpdEngine: Engine = yield select(getWebpdEngine)
    webpdEngine = yield call(evalEngine.init, webpdEngine)
    yield put(setInitialized(context, webpdEngine))

    const pdJson = getPdJson(uiGraph)
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

function* createNode(action: ModelAddNode) {
    const uiGraph: fbpGraph.Graph = yield select(getModelGraph)
    const canvasCenterPoint: Point = yield select(getUiCanvasCenterPoint)
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const patch: PdJson.Patch = yield select(getCurrentPdPatch)
    const nodeId = generateId(patch)
    const pdNode: PdJson.Node = {
        id: nodeId,
        type: action.payload.type,
        args: action.payload.args,
    }
    addNode(uiGraph, pdNode, canvasCenterPoint, webpdEngine.settings)
    yield call(graphChanged, uiGraph)
}

function* requestLoadPd(action: ModelRequestLoadPd) {
    const pdJson = action.payload.pd
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const uiGraph: fbpGraph.Graph = yield call(loadPdJson, pdJson, webpdEngine.settings)
    const library: Library = yield call(generateLibrary, pdJson, webpdEngine.settings)
    yield put(setGraph(uiGraph, library))
    if (isWebpdInitialized) {
        yield call(runDspGraph, pdJson)
    }
    yield fork(uiGraphEventsSaga, uiGraph)
}

function* webpdRequestLoadJsonSaga() {
    yield takeLatest(MODEL_REQUEST_LOAD_PD, requestLoadPd)
}

function* webpdCreateSaga() {
    yield takeLatest(WEBPD_CREATE, webpdCreateEngine)
}

function* webpdDspToggleSaga() {
    yield takeLatest(WEBPD_DSP_TOGGLE, webpdToggleDsp)
}

function* webpdCreateNodeSaga() {
    yield takeLatest(MODEL_ADD_NODE, createNode)
}

export default function* rootSaga() {
    yield all([
        webpdCreateSaga(),
        webpdDspToggleSaga(),
        webpdRequestLoadJsonSaga(),
        webpdCreateNodeSaga(),
    ])
}
