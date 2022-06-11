import * as fbpGraph from 'fbp-graph'
import { Library } from '../core/types'

export type ArraysMap = { [arrayName: string]: Float32Array }

// ------------- Action Types ------------ //
export const MODEL_SET_GRAPH = 'MODEL_SET_GRAPH'
export const MODEL_INCREMENT_GRAPH_VERSION = 'MODEL_INCREMENT_GRAPH_VERSION'
export const MODEL_ADD_NODE = 'MODEL_ADD_NODE'
export const MODEL_EDIT_NODE = 'MODEL_EDIT_NODE'
export const MODEL_REQUEST_LOAD_PD = 'MODEL_REQUEST_LOAD_PD'
export const MODEL_REQUEST_LOAD_ARRAY = 'MODEL_REQUEST_LOAD_ARRAY'
export const MODEL_ARRAY_LOADED = 'MODEL_ARRAY_LOADED'
export const MODEL_DELETE_ARRAY = 'MODEL_DELETE_ARRAY'

interface ModelSetGraph {
    type: typeof MODEL_SET_GRAPH
    payload: {
        graph: fbpGraph.Graph
        library: Library
    }
}

export interface ModelAddNode {
    type: typeof MODEL_ADD_NODE
    payload: {
        nodeType: PdSharedTypes.NodeType
        nodeArgs: PdJson.ObjectArgs
    }
}

export interface ModelEditNode {
    type: typeof MODEL_EDIT_NODE
    payload: {
        nodeId: PdJson.ObjectLocalId
        nodeArgs: PdJson.ObjectArgs
    }
}

interface ModelIncrementGraphVersion {
    type: typeof MODEL_INCREMENT_GRAPH_VERSION
}

export interface ModelRequestLoadPd {
    type: typeof MODEL_REQUEST_LOAD_PD
    payload: {
        pd: PdJson.Pd
    }
}

export interface ModelRequestLoadArray {
    type: typeof MODEL_REQUEST_LOAD_ARRAY
    payload: {
        arrayName: string
        arrayFile: File
    }
}

interface ModelArrayLoaded {
    type: typeof MODEL_ARRAY_LOADED
    payload: {
        arrayName: PdJson.ObjectGlobalId
        array: Float32Array
    }
}

interface ModelDeleteArray {
    type: typeof MODEL_DELETE_ARRAY
    payload: {
        arrayName: PdJson.ObjectGlobalId
    }
}

type ModelTypes =
    | ModelSetGraph
    | ModelIncrementGraphVersion
    | ModelAddNode
    | ModelEditNode
    | ModelRequestLoadPd
    | ModelRequestLoadArray
    | ModelArrayLoaded
    | ModelDeleteArray

// ------------ Action Creators ---------- //

export const setGraph = (
    graph: fbpGraph.Graph,
    library: Library
): ModelTypes => {
    return {
        type: MODEL_SET_GRAPH,
        payload: { graph, library },
    }
}

export const addNode = (
    nodeType: PdSharedTypes.NodeType,
    nodeArgs: PdJson.ObjectArgs
): ModelTypes => {
    return {
        type: MODEL_ADD_NODE,
        payload: { nodeType, nodeArgs },
    }
}

export const editNode = (
    nodeId: PdJson.ObjectLocalId,
    nodeArgs: PdJson.ObjectArgs
): ModelTypes => {
    return {
        type: MODEL_EDIT_NODE,
        payload: { nodeId, nodeArgs },
    }
}

export const incrementGraphVersion = (): ModelTypes => {
    return {
        type: MODEL_INCREMENT_GRAPH_VERSION,
    }
}

export const requestLoadPd = (pd: PdJson.Pd): ModelTypes => {
    return {
        type: MODEL_REQUEST_LOAD_PD,
        payload: { pd },
    }
}

export const loadArray = (arrayName: string, arrayFile: File): ModelTypes => {
    return {
        type: MODEL_REQUEST_LOAD_ARRAY,
        payload: {
            arrayName,
            arrayFile,
        },
    }
}

export const setArrayLoaded = (
    arrayName: string,
    array: Float32Array
): ModelTypes => {
    return {
        type: MODEL_ARRAY_LOADED,
        payload: { array, arrayName },
    }
}

export const deleteArray = (arrayName: string): ModelTypes => {
    return {
        type: MODEL_DELETE_ARRAY,
        payload: {
            arrayName,
        },
    }
}

// ----------------- State --------------- //
export interface ModelState {
    library: Library
    // `graph` is a complexe object, so when it changes the reference stays the same
    // and it won't trigger a re-render.
    // To force re-render of a component, we can therefore inject this variable
    // which will be incremented at each graph change.
    graphVersion: number
    graph: fbpGraph.Graph
    arrays: ArraysMap
}

export const initialState: ModelState = {
    library: {},
    graphVersion: 0,
    graph: new fbpGraph.Graph(),
    arrays: {},
}

// ---------------- Reducer -------------- //
export const modelReducer = (
    state = initialState,
    action: ModelTypes
): ModelState => {
    switch (action.type) {
        case MODEL_SET_GRAPH:
            return {
                ...state,
                graphVersion: state.graphVersion + 1,
                graph: action.payload.graph,
                library: action.payload.library,
            }
        case MODEL_INCREMENT_GRAPH_VERSION:
            return {
                ...state,
                graphVersion: state.graphVersion + 1,
            }
        case MODEL_ARRAY_LOADED:
            return {
                ...state,
                arrays: {
                    ...state.arrays,
                    [action.payload.arrayName]: action.payload.array,
                },
            }
        case MODEL_DELETE_ARRAY:
            const arraysWithoutDeleted: ArraysMap = {}
            Object.entries(state.arrays).forEach(([arrayName, array]) => {
                if (arrayName !== action.payload.arrayName) {
                    arraysWithoutDeleted[arrayName] = array
                }
            })
            return {
                ...state,
                arrays: arraysWithoutDeleted,
            }
        default:
            return state
    }
}
