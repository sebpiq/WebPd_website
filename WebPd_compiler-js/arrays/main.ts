import * as evalEngine from '@webpd/engine-live-eval/src'
import { createButton } from '@webpd/shared/src/example-helpers'
import compile from '../../src/compile'
import pEvent from 'p-event'
import NODE_BUILDERS from '@webpd/dsp-graph'
import NODE_IMPLEMENTATIONS from '../../src/nodes'
import { Engine } from '@webpd/engine-live-eval/src/types'
import { setInlet } from '../../src/api'
import { ENGINE_ARRAYS_VARIABLE_NAME } from '@webpd/engine-live-eval/src/constants'

const SAMPLE_URL = '/sample.mp3'
const CONTEXT = new AudioContext()
const TABPLAY_LEFT_ID = 'tabplayLeft'
const TABPLAY_RIGHT_ID = 'tabplayRight'
const METRO_ID = 'metro'
const SAMPLE_LEFT_ARRAY_NAME = 'SAMPLE_LEFT'
const SAMPLE_RIGHT_ARRAY_NAME = 'SAMPLE_RIGHT'

const metroArgs = { rate: 2200 }
const tabplayLeftArgs = { arrayName: SAMPLE_LEFT_ARRAY_NAME }
const tabplayRightArgs = { arrayName: SAMPLE_RIGHT_ARRAY_NAME }

const graph: PdDspGraph.Graph = {
    [METRO_ID]: {
        id: METRO_ID,
        type: 'metro',
        args: metroArgs,
        sinks: {
            '0': [
                { nodeId: TABPLAY_LEFT_ID, portletId: '0' }, 
                { nodeId: TABPLAY_RIGHT_ID, portletId: '0' },
            ],
        },
        sources: {},
        ...NODE_BUILDERS['metro'].build(metroArgs),
    },
    [TABPLAY_LEFT_ID]: {
        id: TABPLAY_LEFT_ID,
        type: 'tabplay~',
        args: tabplayLeftArgs,
        sources: {
            '0': [{ nodeId: METRO_ID, portletId: '0' }],
        },
        sinks: {
            '0': [{ nodeId: 'dac', portletId: '0' }],
        },
        ...NODE_BUILDERS['tabplay~'].build(tabplayLeftArgs),
    },
    [TABPLAY_RIGHT_ID]: {
        id: TABPLAY_RIGHT_ID,
        type: 'tabplay~',
        args: tabplayRightArgs,
        sources: {
            '0': [{ nodeId: METRO_ID, portletId: '0' }],
        },
        sinks: {
            '0': [{ nodeId: 'dac', portletId: '1' }],
        },
        ...NODE_BUILDERS['tabplay~'].build(tabplayRightArgs),
    },
    dac: {
        id: 'dac',
        type: 'dac~',
        args: {},
        sinks: {},
        sources: {
            '0': [{ nodeId: TABPLAY_LEFT_ID, portletId: '0' }],
            '1': [{ nodeId: TABPLAY_RIGHT_ID, portletId: '0' }],
        },
        isEndSink: true,
        ...NODE_BUILDERS['dac~'].build({}),
    },
}

const loadSample = async (audioContext: AudioContext) => {
    const response = await fetch(SAMPLE_URL)
    const audioData = await response.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(audioData)
    const arrays: Array<Float32Array> = []
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        arrays.push(audioBuffer.getChannelData(ch))
    }
    return arrays
}

const startMetro = (engine: Engine) => {
    evalEngine.callPort(engine, ...setInlet(METRO_ID, '0', ['bang']))
}

const stopMetro = (engine: Engine) => {
    evalEngine.callPort(engine, ...setInlet(METRO_ID, '0', ['stop']))
}

const main = async () => {
    let engine = await evalEngine.create(CONTEXT, {
        sampleRate: CONTEXT.sampleRate,
        channelCount: 2,
    })
    const startButton = createButton('Start')
    const sampleArrays = await loadSample(CONTEXT)
    await pEvent(startButton, 'click')

    engine = await evalEngine.init(engine)
    const code = await compile(graph, NODE_IMPLEMENTATIONS, {
        ...engine.settings,
        arraysVariableName: ENGINE_ARRAYS_VARIABLE_NAME,
    })
    await evalEngine.run(engine, code, {
        [SAMPLE_LEFT_ARRAY_NAME]: sampleArrays[0],
        [SAMPLE_RIGHT_ARRAY_NAME]: sampleArrays[1],
    })

    const startMetroButton = createButton('Start metro')
    startMetroButton.onclick = () => startMetro(engine)
    const stopMetroButton = createButton('Stop metro')
    stopMetroButton.onclick = () => stopMetro(engine)

    return engine
}

main().then((engine) => {
    console.log('app started')
    ;(window as any).webPdEngine = engine
})
