import * as fbpGraph from 'fbp-graph'
import { Library } from '../core/types'

// ------------- Action Types ------------ //
export type UiTheme = 'dark' | 'light'
export type UiPopup = 'addnode' | null
export type UiLibrary = any

export const UI_SET_THEME = 'UI_SET_THEME'
export const UI_SET_GRAPH = 'UI_SET_GRAPH'
export const UI_SET_PAN_SCALE = 'UI_SET_PAN_SCALE'
export const UI_SET_POPUP = 'UI_SET_POPUP'
export const UI_INCREMENT_GRAPH_VERSION = 'UI_INCREMENT_GRAPH_VERSION'

interface UiSetPanScale {
    type: typeof UI_SET_PAN_SCALE
    payload: {
        panX: number, 
        panY: number, 
        scale: number
    }
}

interface UiSetTheme {
    type: typeof UI_SET_THEME
    payload: {
        theme: UiTheme
    }
}

interface UiSetGraph {
    type: typeof UI_SET_GRAPH
    payload: {
        graph: fbpGraph.Graph
        library: Library
    }
}

interface UiSetPopup {
    type: typeof UI_SET_POPUP
    payload: {
        popup: UiPopup
    }
}

interface UiIncrementGraphVersion {
    type: typeof UI_INCREMENT_GRAPH_VERSION
}

type UiTypes = UiSetTheme | UiSetGraph | UiSetPanScale | UiSetPopup | UiIncrementGraphVersion


// ------------ Action Creators ---------- //
export const setTheme = (theme: UiTheme): UiTypes => {
    return {
        type: UI_SET_THEME,
        payload: {theme},
    }
}

export const setUiGraph = (graph: fbpGraph.Graph, library: Library): UiTypes => {
    return {
        type: UI_SET_GRAPH,
        payload: {graph, library},
    }
}

export const incrementGraphVersion = (): UiTypes => {
    return {
        type: UI_INCREMENT_GRAPH_VERSION,
    }
}

export const panScaleChanged = (panX: number, panY: number, scale: number): UiTypes => {
    return {
        type: UI_SET_PAN_SCALE,
        payload: {panX, panY, scale},
    }
}

export const setPopup = (popup: UiPopup) => {
    return {
        type: UI_SET_POPUP,
        payload: {popup},
    }
}

// ----------------- State --------------- //
export interface UiState {
    popup: UiPopup
    library: Library
    // `graph` is a complexe object, so when it changes the reference stays the same 
    // and it won't trigger a re-render. 
    // To force re-render of a component, we can therefore inject this variable 
    // which will be incremented at each graph change.
    graphVersion: number
    graph: fbpGraph.Graph
    theme: UiTheme
    panX: number
    panY: number
    scale: number
}

export const initialState: UiState = {
    popup: null,
    library: {},
    graphVersion: 0,
    graph: new fbpGraph.Graph(),
    theme: 'dark',
    panX: 0,
    panY: 0,
    scale: 1,
}

// ---------------- Reducer -------------- //
export const uiReducer = (
    state = initialState,
    action: UiTypes
): UiState => {
    switch (action.type) {
        case UI_SET_THEME:
            return {
                ...state,
                theme: action.payload.theme
            }
        case UI_SET_GRAPH:
            return {
                ...state,
                graphVersion: state.graphVersion + 1,
                graph: action.payload.graph,
                library: action.payload.library,
            }
        case UI_SET_PAN_SCALE:
            return {
                ...state,
                panX: -action.payload.panX,
                panY: -action.payload.panY,
                scale: action.payload.scale,
            }
        case UI_SET_POPUP:
            return {
                ...state,
                popup: action.payload.popup
            }
        case UI_INCREMENT_GRAPH_VERSION:
            return {
                ...state,
                graphVersion: state.graphVersion + 1,
            }
        default:
            return state
    }
}