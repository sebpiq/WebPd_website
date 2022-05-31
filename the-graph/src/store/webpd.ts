import { Engine } from "@webpd/engine-live-eval"

// ------------- Action Types ------------ //
export const WEBPD_CREATE = 'WEBPD_CREATE'
export const WEBPD_CREATED = 'WEBPD_CREATED'
export const WEBPD_INITIALIZED = 'WEBPD_INITIALIZED'
export const WEBPD_DSP_TOGGLE = 'WEBPD_DSP_TOGGLE'

export interface WebPdCreate {
    type: typeof WEBPD_CREATE
}

export interface WebPdCreated {
    type: typeof WEBPD_CREATED
    payload: {
        context: AudioContext,
        engine: Engine
    }
}

export interface WebPdInitialized {
    type: typeof WEBPD_INITIALIZED
    payload: {
        context: AudioContext,
        engine: Engine
    }
}

export interface WebPdDspToggled {
    type: typeof WEBPD_DSP_TOGGLE
    payload: {
        isDspOn: boolean,
    }
}

type WebPdTypes = WebPdDspToggled | WebPdInitialized | WebPdCreate | WebPdCreated


// ------------ Action Creators ---------- //
export const toggleDsp = (isDspOn: boolean): WebPdTypes => {
    return {
        type: WEBPD_DSP_TOGGLE,
        payload: {isDspOn},
    }
}

export const create = (): WebPdTypes => {
    return {
        type: WEBPD_CREATE,
    }
}

export const setCreated = (context: AudioContext, engine: Engine): WebPdTypes => {
    return {
        type: WEBPD_CREATED,
        payload: {context, engine}
    }
}

export const setInitialized = (context: AudioContext, engine: Engine): WebPdTypes => {
    return {
        type: WEBPD_INITIALIZED,
        payload: {context, engine}
    }
}

// ----------------- State --------------- //
interface WebPdState {
    isCreated: boolean
    isInitialized: boolean
    isDspOn: boolean
    context: AudioContext | null
    engine: Engine | null
}

export const initialState: WebPdState = {
    isCreated: false,
    isInitialized: false,
    isDspOn: false,
    context: null,
    engine: null,
}

// ---------------- Reducer -------------- //
export const webPdReducer = (
    state = initialState,
    action: WebPdTypes
): WebPdState => {
    switch (action.type) {
        case WEBPD_CREATED: 
            return {
                ...state,
                isCreated: true,
                context: action.payload.context,
                engine: action.payload.engine,
            }
        case WEBPD_INITIALIZED: 
            return {
                ...state,
                isInitialized: true,
                context: action.payload.context,
                engine: action.payload.engine,
            }
        case WEBPD_DSP_TOGGLE: 
            return {
                ...state,
                isDspOn: action.payload.isDspOn
            }
        default:
            return state
    }
}