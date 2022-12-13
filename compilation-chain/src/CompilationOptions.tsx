import './CompilationOptions.css'
import { AppDispatcher, AppState } from "./appState"

interface Props {
    dispatch: AppDispatcher
    state: AppState['compilationOptions']
}

const CompilationOptions: React.FunctionComponent<Props> = ({ dispatch, state }) => {

    const onTargetChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
        const target = event.currentTarget.value as AppState['compilationOptions']['target']
        dispatch({
            type: 'COMPILATION_OPTIONS_SET', 
            payload: {target}
        })
    }

    const onBitDepthChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
        const bitDepth = parseInt(event.currentTarget.value) as AppState['compilationOptions']['bitDepth']
        dispatch({
            type: 'COMPILATION_OPTIONS_SET', 
            payload: {bitDepth}
        })
    }

    return (
        <div className={`CompilationOptions`}>
            <label>Compilation target</label>
            <select value={state.target} onChange={onTargetChange}>
                <option value="js-eval" selected={state.target === 'js-eval'}>Javascript</option>
                <option value="wasm" selected={state.target === 'wasm'}>Assemblyscript / WebAssembly</option>
            </select>
            <label>Bit depth</label>
            <select onChange={onBitDepthChange}>
                <option value={64} selected={state.bitDepth === 64}>64 bits</option>
                <option value={32} selected={state.bitDepth === 32}>32 bits</option>
            </select>
        </div>
    )
}

export default CompilationOptions