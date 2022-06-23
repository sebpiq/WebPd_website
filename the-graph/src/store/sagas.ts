import * as fbpGraph from 'fbp-graph'
import { audioworkletJsEval, audioworkletWasm, addModule } from '@webpd/audioworklets'
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
    getWebpdEngineMode,
    getWebpdIsInitialized,
    getWebpdSettings,
} from './selectors'
import {
    Engine,
    EngineMode,
    setCreated,
    setEngine,
    setInitialized,
    WebPdDspToggled,
    WEBPD_CREATE,
    WEBPD_DSP_TOGGLE,
    WEBPD_SET_ENGINE_MODE,
} from './webpd'
import {
    arrayLoadError,
    Arrays,
    incrementGraphVersion,
    ModelAddNode,
    ModelEditNode,
    ModelRequestLoadLocalArray,
    ModelRequestLoadPd,
    ModelRequestLoadRemoteArray,
    MODEL_ADD_NODE,
    MODEL_ARRAY_LOADED,
    MODEL_EDIT_NODE,
    MODEL_REQUEST_LOAD_LOCAL_ARRAY,
    MODEL_REQUEST_LOAD_PD,
    MODEL_REQUEST_LOAD_REMOTE_ARRAY,
    setArrayLoaded,
    setGraph,
} from './model'
import {
    pdToLibrary,
    pdToGraph,
    graphToPd,
    pdToJsCode,
    pdToWasm,
} from '../core/converters'
import { Library, Point } from '../core/types'
import { END, EventChannel, eventChannel } from 'redux-saga'
import { LOCALSTORAGE_HELP_SEEN_KEY, UI_SET_POPUP } from './ui'
import * as model from '../core/model'
import { httpGetBinary, readFileAsArrayBuffer } from '../core/browser'
import { GLOBS_VARIABLE_NAME } from '../core/constants'

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
    const settings: PdEngine.Settings = yield select(getWebpdSettings)
    yield put(incrementGraphVersion())
    const pdJson = graphToPd(graph)
    const library: Library = yield call(
        pdToLibrary,
        pdJson,
        settings
    )
    yield put(setGraph(graph, library))
    if (isWebpdInitialized) {
        yield call(updateWebpdDsp, pdJson)
    }
    console.log('ui GRAPH CHANGED')
}

function* updateWebpdDsp(pd: PdJson.Pd) {
    const webpdEngine: Engine = yield select(getWebpdEngine)
    const settings: PdEngine.Settings = yield select(getWebpdSettings)
    const arraysData: Arrays = yield select(getModelArrays)
    const arrays: { [arrayName: string]: Float32Array } = {}
    Object.entries(arraysData).forEach(([arrayName, arrayDatum]) => {
        if (arrayDatum.code !== 'loaded') {
            return
        }
        arrays[arrayName] = arrayDatum.array
    })

    if (webpdEngine.mode === 'js') {
        const code = pdToJsCode(pd, settings)
        webpdEngine.waaNode.port.postMessage({
            type: 'CODE',
            payload: { code, arrays }
        })

    } else if (webpdEngine.mode === 'wasm') {
        let wasmBuffer: ArrayBuffer
        try {
            wasmBuffer = yield call(pdToWasm, pd, settings)
        } catch(err) {
            console.log(err)
            return
        }
        webpdEngine.waaNode.port.postMessage({
            type: 'WASM',
            payload: { wasmBuffer, arrays }
        })
    }
}

function* updateWebpdEngine() {
    const engineMode: EngineMode = yield select(getWebpdEngineMode)
    const context: AudioContext = yield select(getWebpdContext)
    const settings: PdEngine.Settings = yield select(getWebpdSettings)
    let webpdEngine: Engine = yield select(getWebpdEngine)

    if (webpdEngine && webpdEngine.waaNode) {
        webpdEngine.waaNode.disconnect()
    }

    if (engineMode === 'js') {
        const waaNode = new audioworkletJsEval.WorkletNode(context, settings.channelCount, GLOBS_VARIABLE_NAME)
        webpdEngine = {waaNode, mode: engineMode}
    
    } else if(engineMode === 'wasm') {
        const waaNode = new audioworkletWasm.WorkletNode(context, settings.channelCount, Float64Array)
        webpdEngine = {waaNode, mode: engineMode}
    }

    webpdEngine.waaNode.connect(context.destination)
    return webpdEngine
}

function* createWebpd() {
    const context = new AudioContext()
    const settings: PdEngine.Settings = {
        sampleRate: context.sampleRate,
        channelCount: 2,
    }
    yield addModule(context, audioworkletJsEval.WorkletProcessorCode)
    yield addModule(context, audioworkletWasm.WorkletProcessorCode)
    yield put(setCreated(settings, context))
}

function* initializeWebpdEngine() {
    const context: AudioContext = yield select(getWebpdContext)
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    const webpdEngine: Engine = yield call(updateWebpdEngine)
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (context.state === 'suspended') {
        context.resume()
    }
    yield put(setInitialized(context, webpdEngine))

    const pdJson = graphToPd(graph)
    if (pdJson) {
        yield call(updateWebpdDsp, pdJson)
    }
}

function* changeWebpdEngineMode() {
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    if (!isWebpdInitialized) {
        return
    }

    const webpdEngine: Engine = yield call(updateWebpdEngine)
    yield put(setEngine(webpdEngine))
    const graph: fbpGraph.Graph = yield select(getModelGraph)
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
    const settings: PdEngine.Settings = yield select(getWebpdSettings)
    const patch: PdJson.Patch = yield select(getCurrentPdPatch)
    const nodeId = model.generateId(patch)
    model.addGraphNode(
        graph,
        nodeId,
        action.payload.nodeType,
        action.payload.nodeArgs,
        canvasCenterPoint,
        settings
    )
    yield call(graphChanged, graph)
}

function* editGraphNode(action: ModelEditNode) {
    const graph: fbpGraph.Graph = yield select(getModelGraph)
    model.editGraphNode(graph, action.payload.nodeId, action.payload.nodeArgs)
}

function* requestLoadPd(action: ModelRequestLoadPd) {
    const pdJson = action.payload.pd
    const settings: PdEngine.Settings = yield select(getWebpdSettings)
    const isWebpdInitialized: boolean = yield select(getWebpdIsInitialized)
    const graph: fbpGraph.Graph = yield call(
        pdToGraph,
        pdJson,
        settings
    )
    const library: Library = yield call(
        pdToLibrary,
        pdJson,
        settings
    )
    yield put(setGraph(graph, library))
    if (isWebpdInitialized) {
        yield call(updateWebpdDsp, pdJson)
    }
    yield fork(graphEventsSaga, graph)
}

function* requestLoadArray(arrayName: string, arrayBuffer: ArrayBuffer) {
    const context = new AudioContext()
    let audioBuffer: AudioBuffer = null
    try {
        audioBuffer = yield call(
            context.decodeAudioData.bind(context),
            arrayBuffer
        )
    } catch (err) {
        yield put(arrayLoadError(arrayName, err.toString()))
        return
    }

    // !!! Loading only first channel of stereo audio
    yield put(setArrayLoaded(arrayName, audioBuffer.getChannelData(0)))
}

function* requestLoadLocalArray(action: ModelRequestLoadLocalArray) {
    const arrayBuffer: ArrayBuffer = yield call(
        readFileAsArrayBuffer,
        action.payload.arrayFile
    )
    yield call(requestLoadArray, action.payload.arrayName, arrayBuffer)
}

function* requestLoadRemoteArray(action: ModelRequestLoadRemoteArray) {
    const arrayBuffer: ArrayBuffer = yield call(
        httpGetBinary,
        action.payload.url
    )
    yield call(requestLoadArray, action.payload.arrayName, arrayBuffer)
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

function* createWebpdSaga() {
    yield takeLatest(WEBPD_CREATE, createWebpd)
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

function* loadLocalArraySaga() {
    yield takeLatest(MODEL_REQUEST_LOAD_LOCAL_ARRAY, requestLoadLocalArray)
}

function* loadRemoteArraySaga() {
    yield takeLatest(MODEL_REQUEST_LOAD_REMOTE_ARRAY, requestLoadRemoteArray)
}

function* arrayLoadedSaga() {
    yield takeLatest(MODEL_ARRAY_LOADED, arrayLoaded)
}

function* setEngineModeSaga() {
    yield takeLatest(WEBPD_SET_ENGINE_MODE, changeWebpdEngineMode)
}

export default function* rootSaga() {
    yield all([
        createWebpdSaga(),
        toggleWebpdDspSaga(),
        requestLoadPdSaga(),
        createGraphNodeSaga(),
        editGraphNodeSaga(),
        setPopupSaga(),
        loadLocalArraySaga(),
        loadRemoteArraySaga(),
        arrayLoadedSaga(),
        setEngineModeSaga(),
    ])
}
