import * as fbpGraph from 'fbp-graph'
import { Library } from '../core/types'

// ------------- Action Types ------------ //
export const MODEL_SET_GRAPH = 'MODEL_SET_GRAPH'
export const MODEL_INCREMENT_GRAPH_VERSION = 'MODEL_INCREMENT_GRAPH_VERSION'
export const MODEL_ADD_NODE = 'MODEL_ADD_NODE'
export const MODEL_EDIT_NODE = 'MODEL_EDIT_NODE'
export const MODEL_REQUEST_LOAD_PD = 'MODEL_REQUEST_LOAD_PD'


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
        nodeType: PdSharedTypes.NodeType,
        nodeArgs: PdJson.ObjectArgs
    }
}

export interface ModelEditNode {
    type: typeof MODEL_EDIT_NODE
    payload: {
        nodeId: PdJson.ObjectLocalId,
        nodeArgs: PdJson.ObjectArgs
    }
}

interface ModelIncrementGraphVersion {
    type: typeof MODEL_INCREMENT_GRAPH_VERSION
}

export interface ModelRequestLoadPd {
    type: typeof MODEL_REQUEST_LOAD_PD
    payload: {
        pd: PdJson.Pd,
    }
}

type ModelTypes = ModelSetGraph | ModelIncrementGraphVersion | ModelAddNode | ModelEditNode | ModelRequestLoadPd


// ------------ Action Creators ---------- //

export const setGraph = (graph: fbpGraph.Graph, library: Library): ModelTypes => {
    return {
        type: MODEL_SET_GRAPH,
        payload: {graph, library},
    }
}

export const addNode = (nodeType: PdSharedTypes.NodeType, nodeArgs: PdJson.ObjectArgs): ModelTypes => {
    return {
        type: MODEL_ADD_NODE,
        payload: {nodeType, nodeArgs},
    }
}

export const editNode = (nodeId: PdJson.ObjectLocalId, nodeArgs: PdJson.ObjectArgs): ModelTypes => {
    return {
        type: MODEL_EDIT_NODE,
        payload: {nodeId, nodeArgs},
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
        payload: {pd}
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
}

export const initialState: ModelState = {
    library: {},
    graphVersion: 0,
    graph: new fbpGraph.Graph(),
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
        default:
            return state
    }
}