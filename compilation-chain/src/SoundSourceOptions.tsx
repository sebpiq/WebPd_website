/* eslint import/no-webpack-loader-syntax: off */
import './SoundSourceOptions.css'
import { AppDispatcher, AppState, SoundSource } from "./appState"
import TEST_OSC_PD from './patches/test-osc.pd'
import TEST_ADC_PD from './patches/test-adc.pd'
import TEST_WRITESF_PD from './patches/test-writesf.pd'
import TEST_READSF_PD from './patches/test-readsf.pd'
import TEST_SOUNDFILER_PD from './patches/test-soundfiler.pd'

const TEST_PATCHES = {
    'test-osc': TEST_OSC_PD,
    'test-adc': TEST_ADC_PD,
    'test-soundfiler': TEST_SOUNDFILER_PD,
    'test-writesf': TEST_WRITESF_PD,
    'test-readsf': TEST_READSF_PD,
}

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

    const onTestPatchLoad = (patchName: keyof typeof TEST_PATCHES): React.MouseEventHandler => () => {
        fetch(TEST_PATCHES[patchName])
            .then(response => response.text())
            .then(pdString => {
                dispatch({
                    type: 'TEXT_STEP_COMMIT',
                    payload: {
                        text: pdString,
                        step: 'pd',
                    }
                })
            })
    }

    return (
        <div className={`SoundSourceOptions`}>
            <div className='_panel'>
                <label>Sound Source</label>
                <select onChange={onSoundSourceChange} value={state.source}>
                    <option value={SoundSource.sample}>Xmas song</option>
                    <option value={SoundSource.microphone}>Microphone</option>
                </select>
            </div>
            <div className='_panel _test-patches'>
                <label>Test patches</label>
                <div>
                    <button onClick={onTestPatchLoad('test-osc')}>osc~ 220</button>
                    <button onClick={onTestPatchLoad('test-adc')}>adc~ bypass</button>
                    <button onClick={onTestPatchLoad('test-soundfiler')}>soundfiler</button>
                    <button onClick={onTestPatchLoad('test-writesf')}>writesf~</button>
                    <button onClick={onTestPatchLoad('test-readsf')}>readsf~</button>
                </div>
            </div>
        </div>
    )
}

export default SoundSourceOptions