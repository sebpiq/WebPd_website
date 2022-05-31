export const POPUP_NODE_LIBRARY = 'POPUP_NODE_LIBRARY'
export const POPUP_NODE_CREATE = 'POPUP_NODE_CREATE'

export type UiPopup = typeof POPUP_NODE_LIBRARY | typeof POPUP_NODE_CREATE

interface NodeCreatePopupData {
    type: typeof POPUP_NODE_CREATE
    data: {
        nodeType: PdSharedTypes.NodeType
    }
}

interface NodeLibraryPopupData {
    type: typeof POPUP_NODE_LIBRARY
}

export type Popup = NodeCreatePopupData | NodeLibraryPopupData

// ------------- Action Types ------------ //
export type UiTheme = 'dark' | 'light'
export type UiLibrary = any

export const UI_SET_THEME = 'UI_SET_THEME'
export const UI_SET_PAN_SCALE = 'UI_SET_PAN_SCALE'
export const UI_SET_POPUP = 'UI_SET_POPUP'

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

interface UiSetPopup {
    type: typeof UI_SET_POPUP
    payload: {
        popup: Popup,
    }
}

type UiTypes = UiSetTheme | UiSetPanScale | UiSetPopup


// ------------ Action Creators ---------- //
export const setTheme = (theme: UiTheme): UiTypes => {
    return {
        type: UI_SET_THEME,
        payload: {theme},
    }
}

export const panScaleChanged = (panX: number, panY: number, scale: number): UiTypes => {
    return {
        type: UI_SET_PAN_SCALE,
        payload: {panX, panY, scale},
    }
}

export const setPopup = (popup: Popup) => {
    return {
        type: UI_SET_POPUP,
        payload: {popup},
    }
}

// ----------------- State --------------- //
export interface UiState {
    popup: Popup | null
    theme: UiTheme
    panX: number
    panY: number
    scale: number
}

export const initialState: UiState = {
    popup: null,
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
        default:
            return state
    }
}