import { audioworkletJsEval, audioworkletWasm } from "@webpd/audioworklets"

interface EngineJs {
    waaNode: audioworkletJsEval.WorkletNode
    mode: 'js'
}

interface EngineWasm {
    waaNode: audioworkletWasm.WorkletNode
    mode: 'wasm'
}

export type Engine = EngineJs | EngineWasm
export type EngineMode = Engine["mode"]

// ------------- Action Types ------------ //
export const WEBPD_CREATE = 'WEBPD_CREATE'
export const WEBPD_CREATED = 'WEBPD_CREATED'
export const WEBPD_INITIALIZED = 'WEBPD_INITIALIZED'
export const WEBPD_DSP_TOGGLE = 'WEBPD_DSP_TOGGLE'
export const WEBPD_SET_ENGINE_MODE = 'WEBPD_SET_ENGINE_MODE'
export const WEBPD_SET_ENGINE = 'WEBPD_SET_ENGINE'

export interface WebPdCreate {
    type: typeof WEBPD_CREATE
}

export interface WebPdCreated {
    type: typeof WEBPD_CREATED
    payload: {
        settings: PdEngine.Settings
        context: AudioContext
    }
}

export interface WebPdInitialized {
    type: typeof WEBPD_INITIALIZED
    payload: {
        context: AudioContext
        engine: Engine
    }
}

export interface WebPdDspToggled {
    type: typeof WEBPD_DSP_TOGGLE
    payload: {
        isDspOn: boolean
    }
}

export interface WebPdSetEngine {
    type: typeof WEBPD_SET_ENGINE
    payload: {
        engine: Engine
    }
}

export interface WebPdSetEngineMode {
    type: typeof WEBPD_SET_ENGINE_MODE
    payload: {
        engineMode: EngineMode
    }
}

type WebPdTypes =
    | WebPdDspToggled
    | WebPdInitialized
    | WebPdCreate
    | WebPdCreated
    | WebPdSetEngineMode
    | WebPdSetEngine

// ------------ Action Creators ---------- //
export const toggleDsp = (isDspOn: boolean): WebPdTypes => {
    return {
        type: WEBPD_DSP_TOGGLE,
        payload: { isDspOn },
    }
}

export const create = (): WebPdTypes => {
    return {
        type: WEBPD_CREATE,
    }
}

export const setCreated = (
    settings: PdEngine.Settings,
    context: AudioContext,
): WebPdTypes => {
    return {
        type: WEBPD_CREATED,
        payload: { context, settings },
    }
}

export const setInitialized = (
    context: AudioContext,
    engine: Engine
): WebPdTypes => {
    return {
        type: WEBPD_INITIALIZED,
        payload: { context, engine },
    }
}

export const setEngine = (engine: Engine): WebPdTypes => {
    return {
        type: WEBPD_SET_ENGINE,
        payload: { engine },
    }
}

export const setEngineMode = (engineMode: EngineMode): WebPdTypes => {
    return {
        type: WEBPD_SET_ENGINE_MODE,
        payload: { engineMode },
    }
}

// ----------------- State --------------- //
interface WebPdState {
    isCreated: boolean
    isInitialized: boolean
    isDspOn: boolean
    context: AudioContext | null
    settings: PdEngine.Settings
    engine: Engine | null
    engineMode: EngineMode
}

export const initialState: WebPdState = {
    isCreated: false,
    isInitialized: false,
    isDspOn: false,
    context: null,
    settings: null,
    engine: null,
    engineMode: 'js'
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
                settings: action.payload.settings,
                context: action.payload.context,
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
                isDspOn: action.payload.isDspOn,
            }
        case WEBPD_SET_ENGINE:
            return {
                ...state,
                engine: action.payload.engine,
            }
        case WEBPD_SET_ENGINE_MODE:
            return {
                ...state,
                engineMode: action.payload.engineMode,
            }
        default:
            return state
    }
}
