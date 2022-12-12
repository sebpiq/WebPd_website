import React from "react";
import { WasmStepState } from "./appState";
import { download } from "./browser";
import './StepWasm.css'

interface Props {
    state: WasmStepState
}

const StepWasm: React.FunctionComponent<Props> = ({ 
    state,
}) => {

    const onDownload = () => {
        download('patch.wasm', state.buffer!, 'application/wasm')
    }

    return (
        <div className={`StepWasm`}>
            <button onClick={onDownload} disabled={!state.buffer}>
                Download .wasm
            </button>
            <div className="_version">patch version : {state.version}</div>
        </div>
    )
}

export default StepWasm