import './CompilationOptions.css'
import { AppDispatcher, AppState } from "./appState"

interface Props {
    dispatch: AppDispatcher
}

const CompilationOptions: React.FunctionComponent<Props> = ({ dispatch }) => {

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
            <select onChange={onTargetChange}>
                <option value="js-eval">Javascript</option>
                <option value="wasm">Assemblyscript / WebAssembly</option>
            </select>
            <label>Bit depth</label>
            <select onChange={onBitDepthChange}>
                <option value={64}>64 bits</option>
                <option value={32}>32 bits</option>
            </select>
        </div>
    )
}

export default CompilationOptions