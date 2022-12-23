import './SoundSourceOptions.css'
import { AppDispatcher, AppState, SoundSource } from "./appState"

interface Props {
    dispatch: AppDispatcher
    state: AppState['soundSourceOptions']
}

const SoundSourceOptions: React.FunctionComponent<Props> = ({ dispatch, state }) => {

    const onSoundSourceChange: React.ChangeEventHandler<HTMLSelectElement> = (event) => {
        const source = parseInt(event.currentTarget.value) as any
        dispatch({
            type: 'SOUND_SOURCE_OPTIONS_SET', 
            payload: {source}
        })
    }

    return (
        <div className={`SoundSourceOptions`}>
            <label>Sound Source</label>
            <select onChange={onSoundSourceChange} value={state.source}>
                <option value={SoundSource.sample}>Xmas song</option>
                <option value={SoundSource.microphone}>Microphone</option>
            </select>
        </div>
    )
}

export default SoundSourceOptions