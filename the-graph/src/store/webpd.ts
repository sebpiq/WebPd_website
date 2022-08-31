import { audioworkletJsEval, audioworkletWasm } from "@webpd/audioworklets"
import { Settings } from "../core/types"

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
export const WEBPD_SET_IS_COMPILING = 'WEBPD_SET_IS_COMPILING'

export interface WebPdCreate {
    type: typeof WEBPD_CREATE
}

export interface WebPdCreated {
    type: typeof WEBPD_CREATED
    payload: {
        settings: Settings
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

export interface WebPdSetIsCompiling {
    type: typeof WEBPD_SET_IS_COMPILING
    payload: {
        isCompiling: boolean
    }
}

type WebPdTypes =
    | WebPdDspToggled
    | WebPdInitialized
    | WebPdCreate
    | WebPdCreated
    | WebPdSetEngineMode
    | WebPdSetEngine
    | WebPdSetIsCompiling

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
    settings: Settings,
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

export const setIsCompiling = (isCompiling: boolean): WebPdTypes => {
    return {
        type: WEBPD_SET_IS_COMPILING,
        payload: { isCompiling },
    }
}

// ----------------- State --------------- //
interface WebPdState {
    isCreated: boolean
    isInitialized: boolean
    isDspOn: boolean
    isCompiling: boolean
    context: AudioContext | null
    settings: Settings
    engine: Engine | null
    engineMode: EngineMode
}

export const initialState: WebPdState = {
    isCreated: false,
    isInitialized: false,
    isDspOn: false,
    isCompiling: false,
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
        case WEBPD_SET_IS_COMPILING:
            return {
                ...state,
                isCompiling: action.payload.isCompiling,
            }
        default:
            return state
    }
}
