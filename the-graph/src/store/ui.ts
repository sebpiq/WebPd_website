import * as fbpGraph from 'fbp-graph'
import TheGraph from 'the-graph'

// ------------- Action Types ------------ //
export type UiTheme = 'dark' | 'light'
export type UiLibrary = any
export const UI_SET_THEME = 'UI_SET_THEME'
export const UI_GRAPH_CHANGED = 'UI_GRAPH_CHANGED'
export const UI_PAN_SCALED_CHANGED = 'UI_PAN_SCALED_CHANGED'

interface UiPanScaleChanged {
    type: typeof UI_PAN_SCALED_CHANGED
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

interface UiGraphChanged {
    type: typeof UI_GRAPH_CHANGED
    payload: {
        graph: fbpGraph.Graph
    }
}

type UiTypes = UiSetTheme | UiGraphChanged | UiPanScaleChanged


// ------------ Action Creators ---------- //
export const setTheme = (theme: UiTheme): UiTypes => {
    return {
        type: UI_SET_THEME,
        payload: {theme},
    }
}

export const graphChanged = (graph: fbpGraph.Graph): UiTypes => {
    return {
        type: UI_GRAPH_CHANGED,
        payload: {graph},
    }
}

export const panScaleChanged = (panX: number, panY: number, scale: number): UiTypes => {
    return {
        type: UI_PAN_SCALED_CHANGED,
        payload: {panX, panY, scale},
    }
}

// ----------------- State --------------- //
export interface UiState {
    library: any
    // `graph` is a complexe object, so when it changes the reference stays the same 
    // and it won't trigger a re-render. 
    // To force re-render of a component, we can therefore inject this variable 
    // which will be incremented at each graph change.
    graphVersion: number,
    graph: fbpGraph.Graph
    theme: UiTheme
    panX: number
    panY: number
    scale: number
}

export const initialState: UiState = {
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
        case UI_GRAPH_CHANGED:
            return {
                ...state,
                graphVersion: state.graphVersion + 1,
                graph: action.payload.graph,
                // TODO : real library
                // Synthesize component library from graph
                library: {
                    ...TheGraph.library.libraryFromGraph(action.payload.graph)
                }
            }
        case UI_PAN_SCALED_CHANGED:
            return {
                ...state,
                panX: -action.payload.panX,
                panY: -action.payload.panY,
                scale: action.payload.scale,
            }
        default:
            return state
    }
}