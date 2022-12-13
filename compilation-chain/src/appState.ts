import { audioworkletJsEval, audioworkletWasm } from "@webpd/audioworklets"
import { buildStepList } from "./utils"

export type TextStepId = keyof AppState['textSteps']
export type StepId = TextStepId | 'wasm' | 'audio'

export type OperationStatus = 'waiting' | 'started' | 'ended'
export type OperationType = 'compile'

export type CompileTarget = 'wasm' | 'js-eval'

// ------------------------------------ ACTIONS ------------------------------------ //
interface AppInitializedAction {
  type: 'APP_INITIALIZED'
  payload: {
    sourceNode: AudioNode
  }
}

interface CompilationOptionsSetAction {
  type: 'COMPILATION_OPTIONS_SET'
  payload: Partial<AppState['compilationOptions']>
}

interface TextStepModifiedAction {
  type: 'TEXT_STEP_MODIFIED'
  payload: {
    step: TextStepId
  }
}

interface TextStepExpandCollapseAction {
  type: 'TEXT_STEP_EXPAND_COLLAPSE'
  payload: {
    step: TextStepId
    isExpanded: boolean
  }
}

interface TextStepCommitAction {
  type: 'TEXT_STEP_COMMIT'
  payload: {
    step: TextStepId
    text: string
  }
}

interface TextOperationDoneAction {
  type: 'TEXT_OPERATION_DONE'
  payload: {
    currentStep: TextStepId
    nextStep: StepId
    result: string
  }
}

interface TextOperationErrorAction {
  type: 'TEXT_OPERATION_ERROR'
  payload: {}
}

interface WasmOperationDoneAction {
  type: 'WASM_OPERATION_DONE'
  payload: { 
    buffer: ArrayBuffer
    nextStep: StepId
  }
}

interface AudioOperationDoneAction {
  type: 'AUDIO_OPERATION_DONE'
  payload: { webpdNode: AudioWorkletNode }
}

export type AppAction = TextStepModifiedAction 
  | TextStepCommitAction | TextOperationDoneAction | TextOperationErrorAction 
  | AppInitializedAction | AudioOperationDoneAction | TextStepExpandCollapseAction
  | WasmOperationDoneAction | CompilationOptionsSetAction

// ------------------------------------ STATES ------------------------------------ //
export interface TextStepState {
  text: string 
  isExpanded: boolean
  version: number
}

export interface WasmStepState {
  buffer: ArrayBuffer | null
  version: number
}

export interface AppState {
  isInitialized: boolean
  compilationOptions: {
    target: CompileTarget
    bitDepth: 32 | 64
  }
  textSteps: {
    pd: TextStepState
    pdJson: TextStepState
    dspGraph: TextStepState
    jsCode: TextStepState
    ascCode: TextStepState
  }
  audioStep: {
    context: AudioContext
    sourceNode: AudioNode | null
    webpdNode: audioworkletJsEval.WorkletNode | audioworkletWasm.WorkletNode | null
    version: number
  }
  wasmStep: WasmStepState
  stepBeingModified: TextStepId | null
  operations: {
    nextStep: StepId | null
  }
}

// ------------------------------------ REDUCER ------------------------------------ //
export const initialAppState: AppState = {
  isInitialized: false,
  compilationOptions: {
    target: 'js-eval',
    bitDepth: 64,
  },
  textSteps: {
    pd: {
      text: `#N canvas 620 382 450 300 12;
#X obj 86 210 dac~;
#X obj 163 38 adc~;
#X connect 1 0 0 0;
#X connect 1 1 0 1;`,
      isExpanded: true,
      version: 0,
    },
    pdJson: {
      text: '',
      isExpanded: false,
      version: 0,
    },
    dspGraph: {
      text: '',
      isExpanded: false,
      version: 0,
    },
    jsCode: {
      text: '',
      isExpanded: true,
      version: 0,
    },
    ascCode: {
      text: '',
      isExpanded: true,
      version: 0,
    },
  },
  audioStep: {
    context: new AudioContext(),
    sourceNode: null,
    webpdNode: null,
    version: 0,
  },
  wasmStep: {
    buffer: null,
    version: 0,
  },
  stepBeingModified: 'pd',
  operations: {
    nextStep: null
  }
}

export const reducer = (state: AppState, action: AppAction): AppState => {
  let buildSteps: Array<StepId>
  switch(action.type) {

    case 'APP_INITIALIZED':
      return {
        ...state,
        audioStep: {
          ...state.audioStep,
          sourceNode: action.payload.sourceNode
        },
        isInitialized: true
      }

    case 'COMPILATION_OPTIONS_SET':
      buildSteps = buildStepList(state.compilationOptions.target, 'pd')
      return {
        ...state,
        compilationOptions: {
          ...state.compilationOptions,
          ...action.payload,
        },
        operations: {
          nextStep: buildSteps[1] || null
        }
      }

    case 'TEXT_STEP_EXPAND_COLLAPSE':
      return {
        ...state,
        textSteps: {
          ...state.textSteps,
          [action.payload.step]: {
            ...state.textSteps[action.payload.step],
            isExpanded: action.payload.isExpanded,
          }
        },        
      }

    case 'TEXT_STEP_MODIFIED':
      return {
        ...state,
        stepBeingModified: action.payload.step
      }
    
    case 'TEXT_STEP_COMMIT':
      buildSteps = buildStepList(state.compilationOptions.target, action.payload.step)
      return {
        ...state,
        textSteps: {
          ...state.textSteps,
          [action.payload.step]: {
            ...state.textSteps[action.payload.step],
            text: action.payload.text
          }
        },
        stepBeingModified: null,
        operations: {
          nextStep: buildSteps[1] || null,
        }
      }

    case 'TEXT_OPERATION_DONE':
      return {
        ...state,
        textSteps: {
          ...state.textSteps,
          [action.payload.currentStep]: {
            ...state.textSteps[action.payload.currentStep],
            text: action.payload.result,
            version: state.textSteps[action.payload.currentStep].version + 1
          }
        },
        operations: {
          ...state.operations,
          nextStep: action.payload.nextStep,
        }
      }

    case 'WASM_OPERATION_DONE':
      return {
        ...state,
        wasmStep: {
          ...state.wasmStep,
          buffer: action.payload.buffer,
          version: state.wasmStep.version + 1,
        },
        operations: {
          ...state.operations,
          nextStep: action.payload.nextStep,
        }        
      }
    
    case 'AUDIO_OPERATION_DONE':
      return {
        ...state,
        audioStep: {
          ...state.audioStep,
          webpdNode: action.payload.webpdNode,
          version: state.audioStep.version + 1,
        },
        operations: {
          ...state.operations,
          nextStep: null,
        }
      }

    case 'TEXT_OPERATION_ERROR':
      return {
        ...state,
        operations: initialAppState.operations,
      }

    default:
      return state
  }
}

export type AppDispatcher = React.Dispatch<AppAction>