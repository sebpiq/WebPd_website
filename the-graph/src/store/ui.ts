export interface AppDimensions {
    width: number, 
    height: number,
}

export interface PanScale {
    x: number
    y: number
    scale: number
}

export interface Point {
    x: number
    y: number
}

export const POPUP_NODE_LIBRARY = 'POPUP_NODE_LIBRARY'
export const POPUP_NODE_CREATE = 'POPUP_NODE_CREATE'
export const POPUP_NODE_EDIT = 'POPUP_NODE_EDIT'

export type UiPopup = typeof POPUP_NODE_LIBRARY | typeof POPUP_NODE_CREATE

interface NodeCreatePopupData {
    type: typeof POPUP_NODE_CREATE
    data: {
        nodeType: PdSharedTypes.NodeType
    }
}

interface NodeEditPopupData {
    type: typeof POPUP_NODE_EDIT
    data: {
        nodeType: PdSharedTypes.NodeType
        nodeArgs: PdJson.ObjectArgs
        nodeId: PdJson.ObjectLocalId
    }
}

interface NodeLibraryPopupData {
    type: typeof POPUP_NODE_LIBRARY
}

export type Popup = NodeCreatePopupData | NodeLibraryPopupData | NodeEditPopupData

// ------------- Action Types ------------ //
export type UiTheme = 'dark' | 'light'
export type UiLibrary = any

export const UI_SET_THEME = 'UI_SET_THEME'
export const UI_SET_PAN_SCALE = 'UI_SET_PAN_SCALE'
export const UI_SET_POPUP = 'UI_SET_POPUP'
export const UI_SET_APP_DIMENSIONS = 'UI_SETAPP_DIMENSIONS'

interface UiSetPanScale {
    type: typeof UI_SET_PAN_SCALE
    payload: PanScale
}

interface UiSetTheme {
    type: typeof UI_SET_THEME
    payload: {
        theme: UiTheme
    }
}

interface UiSetPopup {
    type: typeof UI_SET_POPUP
    payload: {
        popup: Popup,
    }
}

interface UiSetAppDimensions {
    type: typeof UI_SET_APP_DIMENSIONS
    payload: AppDimensions
}

type UiTypes = UiSetTheme | UiSetPanScale | UiSetPopup | UiSetAppDimensions


// ------------ Action Creators ---------- //
export const setTheme = (theme: UiTheme): UiTypes => {
    return {
        type: UI_SET_THEME,
        payload: {theme},
    }
}

export const setPanScale = (x: number, y: number, scale: number): UiTypes => {
    return {
        type: UI_SET_PAN_SCALE,
        payload: {x, y, scale},
    }
}

export const setPopup = (popup: Popup) => {
    return {
        type: UI_SET_POPUP,
        payload: {popup},
    }
}

export const setAppDimensions = (width: number, height: number) => {
    return {
        type: UI_SET_APP_DIMENSIONS,
        payload: {width, height},
    }
}

// ----------------- State --------------- //
export interface UiState {
    popup: Popup | null
    theme: UiTheme
    panScale: PanScale
    appDimensions: AppDimensions
}

export const initialState: UiState = {
    popup: null,
    theme: 'light',
    panScale: {
        x: 0, 
        y: 0, 
        scale: 1
    },
    appDimensions: {
        width: window.innerWidth,
        height: window.innerHeight,
    }
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
        case UI_SET_PAN_SCALE:
            return {
                ...state,
                panScale: action.payload,
            }
        case UI_SET_POPUP:
            return {
                ...state,
                popup: action.payload.popup
            }
        case UI_SET_APP_DIMENSIONS:
            return {
                ...state,
                appDimensions: action.payload,
            }
        default:
            return state
    }
}