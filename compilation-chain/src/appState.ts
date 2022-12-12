import { audioworkletJsEval, audioworkletWasm } from "@webpd/audioworklets"

export type TextStepId = keyof AppState['textSteps']
export type StepId = TextStepId | 'audio'

export type OperationStatus = 'waiting' | 'started' | 'ended'
export type OperationType = 'compile'
type OperationQueue = Array<StepId>

export type CompileTarget = 'wasm' | 'js-eval'

// ------------------------------------ ACTIONS ------------------------------------ //
interface AppInitializedAction {
  type: 'APP_INITIALIZED'
  payload: {}
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

interface AudioOperationDoneAction {
  type: 'AUDIO_OPERATION_DONE'
  payload: { waaNode: AudioWorkletNode }
}

interface TextOperationDoneAction {
  type: 'TEXT_OPERATION_DONE'
  payload: {
    currentStep: TextStepId
    queue: OperationQueue
    result: string
  }
}

interface TextOperationErrorAction {
  type: 'TEXT_OPERATION_ERROR'
  payload: {}
}

export type AppAction = TextStepModifiedAction 
  | TextStepCommitAction | TextOperationDoneAction | TextOperationErrorAction 
  | AppInitializedAction | AudioOperationDoneAction | TextStepExpandCollapseAction

// ------------------------------------ STATES ------------------------------------ //
export interface OperationState {
  target: CompileTarget | null
  queue: OperationQueue | null
  currentStep: StepId | null
}

export interface TextStepState {
  text: string 
  isExpanded: boolean
  version: number
}

export interface AudioStepState {
  context: AudioContext
  waaNode: audioworkletJsEval.WorkletNode | audioworkletWasm.WorkletNode | null
  version: number
}

export interface AppState {
  isInitialized: boolean
  textSteps: {
    pd: TextStepState
    pdJson: TextStepState
    dspGraph: TextStepState
    jsCode: TextStepState
  }
  audioStep: AudioStepState
  stepBeingModified: TextStepId | null
  operations: OperationState
}

export const initialAppState: AppState = {
  isInitialized: false,
  textSteps: {
    pd: {
      text: `#N canvas 306 267 645 457 10;
#X obj 41 27 osc~ 220;
#X obj 41 50 dac~;
#X connect 0 0 1 0;`,
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
      isExpanded: false,
      version: 0,
    },
  },
  audioStep: {
    context: new AudioContext(),
    waaNode: null,
    version: 0,
  },
  stepBeingModified: 'pd',
  operations: {
    target: null,
    queue: [], 
    currentStep: null
  }
}

// ------------------------------------ REDUCER ------------------------------------ //
export const reducer = (state: AppState, action: AppAction): AppState => {
  // console.log('ACTION', action.type, action)
  switch(action.type) {

    case 'APP_INITIALIZED':
      return {
        ...state,
        isInitialized: true
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
          target: 'js-eval',
          queue: null,
          currentStep: action.payload.step,
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
          queue: action.payload.queue,
          currentStep: action.payload.currentStep,
        }
      }
    
    case 'AUDIO_OPERATION_DONE':
      return {
        ...state,
        audioStep: {
          ...state.audioStep,
          waaNode: action.payload.waaNode,
          version: state.audioStep.version + 1,
        },
        operations: {
          ...state.operations,
          queue: null,
          currentStep: null,
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