import React, { useReducer } from 'react';
import './App.css';
import { initialAppState, reducer } from './appState';
import StepAudio from './StepAudio';
import StepText from './StepText';
import StepWasm from './StepWasm';
import useHandleOperations from './useHandleOperations';
import useInitialize from './useInitialize';

function App() {

  const [appState, dispatch] = useReducer(reducer, initialAppState)
  useInitialize(appState, dispatch)
  useHandleOperations(appState, dispatch)

  return (
    <div className="App">
      <StepText 
        key={`pd-${appState.textSteps.pd.version}`}
        state={appState.textSteps.pd}
        isBeingModified={appState.stepBeingModified === 'pd'}
        dispatch={dispatch}
        step="pd"
      />
      <StepText 
        key={`pdJson-${appState.textSteps.pdJson.version}`}
        state={appState.textSteps.pdJson}
        isBeingModified={appState.stepBeingModified === 'pdJson'}
        dispatch={dispatch}
        step="pdJson"
      />
      <StepText 
        key={`dspGraph-${appState.textSteps.dspGraph.version}`}
        state={appState.textSteps.dspGraph}
        isBeingModified={appState.stepBeingModified === 'dspGraph'}
        dispatch={dispatch}
        step="dspGraph"
      />
      {appState.target === 'js-eval' ? 
        <StepText 
          key={`jsCode-${appState.textSteps.jsCode.version}`}
          state={appState.textSteps.jsCode}
          isBeingModified={appState.stepBeingModified === 'jsCode'}
          dispatch={dispatch}
          step="jsCode"
        /> : null
      }
      {appState.target === 'wasm' ? 
        <StepText 
          key={`ascCode-${appState.textSteps.ascCode.version}`}
          state={appState.textSteps.ascCode}
          isBeingModified={appState.stepBeingModified === 'ascCode'}
          dispatch={dispatch}
          step="ascCode"
        />: null
      }
      {appState.target === 'wasm' ? 
        <StepWasm 
          key={`wasm-${appState.textSteps.ascCode.version}`}
          state={appState.wasmStep}
        />: null
      }
      <StepAudio 
        state={appState.audioStep}
      />
    </div>
  );
}

export default App;
