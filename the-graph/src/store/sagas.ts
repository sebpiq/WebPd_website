import * as fbpGraph from 'fbp-graph'
import evalEngine, { Engine } from '@webpd/engine-live-eval'
import {
    all,
    takeLatest,
    put,
    select,
    call,
    take,
    fork,
} from 'redux-saga/effects'
import {
    getCurrentPdPatch,
    getModelArrays,
    getModelGraph,
    getUiCanvasCenterPoint,
    getWebpdContext,
    getWebpdEngine,
    getWebpdIsInitialized,
} from './selectors'
import {
    setCreated,
    setInitialized,
    WebPdDspToggled,
    WEBPD_CREATE,
    WEBPD_DSP_TOGGLE,
} from './webpd'
import {
    arrayLoadError,
    Arrays,
    incrementGraphVersion,
    ModelAddNode,
    ModelEditNode,
    ModelRequestLoadArray,
    ModelRequestLoadPd,
    MODEL_ADD_NODE,
    MODEL_ARRAY_LOADED,
    MODEL_EDIT_NODE,
    MODEL_REQUEST_LOAD_ARRAY,
    MODEL_REQUEST_LOAD_PD,
    setArrayLoaded,
    setGraph,
} from './model'
import {
    pdToLibrary,
    pdToGraph,
    graphToPd,
    pdToJsCode,
} from '../core/converters'
import { Library } from '../core/types'
import { END, EventChannel, eventChannel } from 'redux-saga'
import { LOCALSTORAGE_HELP_SEEN_KEY, Point, UI_SET_POPUP } from './ui'
import * as model from '../core/model'
import { readFileAsArrayBuffer } from '../core/browser'

const graphEventChannel = (graph: fbpGraph.Graph) => {
    return eventChannel((emitter) => {
        graph.on('endTransaction', () => {
            console.log('endTransaction', graph)
            emitter(null)
        })
        // TODO ?
        graph.on('close', () => {
            emitter(END)
        })
        return () => {
            graph.removeAllListeners()
        }
    })
}

function* graphEventsSaga(graph: fbpGraph.Graph) {
    // TODO : terminate on new UI graph (and clean / kill EventChannel)
    const events: EventChannel<null> = yield call(graphEventChannel, graph)
    try {
        while (true) {
            // take(END) will cause the saga to terminate by jumping to the finally block
            yield take(events)
            yield call(graphChanged, graph)
        }
    } catch (err) {
        console.error(err)
    } finally {
        console.log('ui graph channel terminated')
    }
}

function* graphChanged(graph: fbpGraph.Graph) {
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const webpdEngine: Engine = yield select(getWebpdEngine)
    yield put(incrementGraphVersion())
    const pdJson = graphToPd(graph)
    const library: Library = yield call(
        pdToLibrary,
        pdJson,
        webpdEngine.settings
    )
    yield put(setGraph(graph, library))
    if (isWebpdInitialized) {
        yield call(updateWebpdDsp, pdJson)
    }
    console.log('ui GRAPH CHANGED')
}

function* updateWebpdDsp(pd: PdJson.Pd) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const arraysData: Arrays = yield select(getModelArrays)
    const arrays: {[arrayName: string]: Float32Array} = {}
    Object.entries(arraysData).forEach(([arrayName, arrayDatum]) => {
        if (arrayDatum.code !== 'loaded') {
            return
        }
        arrays[arrayName] = arrayDatum.array
    })

    const code = pdToJsCode(pd, webpdEngine.settings)
    yield call(evalEngine.run, webpdEngine, code, arrays)
}

function* createWebpdEngine() {
    const context = new AudioContext()
    const webpdEngine: Engine = yield call(evalEngine.create, context, {
        sampleRate: context.sampleRate,
        channelCount: 2,
    })
    yield put(setCreated(context, webpdEngine))
}

function* initializeWebpdEngine() {
    const context: AudioContext = yield select(getWebpdContext)
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    let webpdEngine: Engine = yield select(getWebpdEngine)
    webpdEngine = yield call(evalEngine.init, webpdEngine)
    yield put(setInitialized(context, webpdEngine))

    const pdJson = graphToPd(graph)
    if (pdJson) {
        yield call(updateWebpdDsp, pdJson)
    }
}

function* toggleWebpdDsp(action: WebPdDspToggled) {
    const context: AudioContext = yield select(getWebpdContext)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    if (action.payload.isDspOn) {
        yield call(() => context.resume())
        if (!isWebpdInitialized) {
            yield call(initializeWebpdEngine)
        }
    } else {
        yield call(() => context.suspend())
    }
}

function* createGraphNode(action: ModelAddNode) {
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    const canvasCenterPoint: Point = yield select(getUiCanvasCenterPoint)
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const patch: PdJson.Patch = yield select(getCurrentPdPatch)
    const nodeId = model.generateId(patch)
    model.addGraphNode(
        graph,
        nodeId,
        action.payload.nodeType,
        action.payload.nodeArgs,
        canvasCenterPoint,
        webpdEngine.settings
    )
    yield call(graphChanged, graph)
}

function* editGraphNode(action: ModelEditNode) {
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    model.editGraphNode(graph, action.payload.nodeId, action.payload.nodeArgs)
}

function* requestLoadPd(action: ModelRequestLoadPd) {
    const pdJson = action.payload.pd
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const graph: fbpGraph.Graph = yield call(
        pdToGraph,
        pdJson,
        webpdEngine.settings
    )
    const library: Library = yield call(
        pdToLibrary,
        pdJson,
        webpdEngine.settings
    )
    yield put(setGraph(graph, library))
    if (isWebpdInitialized) {
        yield call(updateWebpdDsp, pdJson)
    }
    yield fork(graphEventsSaga, graph)
}

function* requestLoadArray(action: ModelRequestLoadArray) {
    const context = new AudioContext()
    const arrayBuffer: ArrayBuffer = yield call(
        readFileAsArrayBuffer,
        action.payload.arrayFile
    )

    let audioBuffer: AudioBuffer = null
    try {
        audioBuffer = yield call(
            context.decodeAudioData.bind(context),
            arrayBuffer
        )
    } catch(err) {
        yield put(arrayLoadError(action.payload.arrayName, err.toString()))
        return
    }

    // !!! Loading only first channel of stereo audio
    yield put(
        setArrayLoaded(action.payload.arrayName, audioBuffer.getChannelData(0))
    )
}

function* arrayLoaded() {
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    yield call(graphChanged, graph)
}

function* setHelpSeen() {
    localStorage.setItem(LOCALSTORAGE_HELP_SEEN_KEY, 'true')
}

function* requestLoadPdSaga() {
    yield takeLatest(MODEL_REQUEST_LOAD_PD, requestLoadPd)
}

function* createWebpdEngineSaga() {
    yield takeLatest(WEBPD_CREATE, createWebpdEngine)
}

function* toggleWebpdDspSaga() {
    yield takeLatest(WEBPD_DSP_TOGGLE, toggleWebpdDsp)
}

function* createGraphNodeSaga() {
    yield takeLatest(MODEL_ADD_NODE, createGraphNode)
}

function* editGraphNodeSaga() {
    yield takeLatest(MODEL_EDIT_NODE, editGraphNode)
}

function* setPopupSaga() {
    yield takeLatest(UI_SET_POPUP, setHelpSeen)
}

function* loadArraySaga() {
    yield takeLatest(MODEL_REQUEST_LOAD_ARRAY, requestLoadArray)
}

function* arrayLoadedSaga() {
    yield takeLatest(MODEL_ARRAY_LOADED, arrayLoaded)
}

export default function* rootSaga() {
    yield all([
        createWebpdEngineSaga(),
        toggleWebpdDspSaga(),
        requestLoadPdSaga(),
        createGraphNodeSaga(),
        editGraphNodeSaga(),
        setPopupSaga(),
        loadArraySaga(),
        arrayLoadedSaga(),
    ])
}
