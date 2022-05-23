import evalEngine, {
    ENGINE_ARRAYS_VARIABLE_NAME,
} from '@webpd/engine-live-eval'
import compile, { NODE_IMPLEMENTATIONS } from '@webpd/compiler-js'
import { uiToDsp } from './graph-conversion'
import { Engine } from '@webpd/engine-live-eval'
import * as fbpGraph from 'fbp-graph'

interface State {
    context: AudioContext,
    engine: Engine
}

let STATE: State

export const init = async () => {
    const context = new AudioContext()
    let engine = await evalEngine.create(context, {
        sampleRate: context.sampleRate,
        channelCount: 2,
    })
    STATE = {
        context,
        engine
    }
}

export const start = async (theGraph: fbpGraph.Graph) => {
    STATE.context.resume()
    STATE.engine = await evalEngine.init(STATE.engine)
    await setGraph(theGraph)
}

export const setGraph = async (theGraph: fbpGraph.Graph) => {
    const dspGraph = uiToDsp(theGraph)
    const code = await compile(dspGraph, NODE_IMPLEMENTATIONS, {
        ...STATE.engine.settings,
        arraysVariableName: ENGINE_ARRAYS_VARIABLE_NAME,
    })
    await evalEngine.run(STATE.engine, code, {})
}