import parse from '@webpd/pd-parser'
import { toDspGraph as rawToDspGraph } from '@webpd/pd-json'
import compile from '@webpd/compiler-js'
import { NODE_BUILDERS, NODE_IMPLEMENTATIONS } from '@webpd/pd-registry'
import { CompileTarget, StepId } from './appState'

export const CHANNEL_COUNT = 2

export const JS_EVAL_STEPS: Array<StepId> = ['pd', 'pdJson', 'dspGraph', 'jsCode', 'audio']
export const WASM_STEPS: Array<StepId> = ['pd', 'pdJson', 'dspGraph', 'ascCode', 'wasm', 'audio']

export const buildStepList = (target: CompileTarget, currentStep: StepId) => {
    if (target === 'js-eval') {
        return JS_EVAL_STEPS.slice(JS_EVAL_STEPS.indexOf(currentStep))
    } else if (target === 'wasm') {
        return WASM_STEPS.slice(WASM_STEPS.indexOf(currentStep))
    } else {
        throw new Error(`invalid target ${target}`)
    }
}

export const toPdJson = (text: string) => {
    return JSON.stringify(parse(text), undefined, 2)
}

export const toDspGraph = (text: string) => {
    try {
        const pdJson = JSON.parse(text)
        const dspGraph = rawToDspGraph(pdJson, NODE_BUILDERS)
        return JSON.stringify(dspGraph, undefined, 2)
    } catch(err) {
        console.error(`INVALID INPUT : \n${text}`)
        console.error((err as Error).stack)
        throw new OperationError((err as any).toString())
    }
}

export const toJs = (text: string) => {
    try {
        const dspGraph = JSON.parse(text) as any
        return compile(dspGraph, NODE_IMPLEMENTATIONS as any, { audioSettings: {channelCount: CHANNEL_COUNT, bitDepth: 64}, target: 'javascript' })
    } catch(err) {
        console.error(`INVALID INPUT : \n${text}`)
        console.error((err as Error).stack)
        throw new OperationError((err as any).toString())
    }
}

export const toAsc = (text: string) => {
    try {
        const dspGraph = JSON.parse(text) as any
        return compile(dspGraph, NODE_IMPLEMENTATIONS as any, { audioSettings: {channelCount: CHANNEL_COUNT, bitDepth: 64}, target: 'assemblyscript' })
    } catch(err) {
        console.error(`INVALID INPUT : \n${text}`)
        console.error((err as Error).stack)
        throw new OperationError((err as any).toString())
    }
}

export const compileAsc = async (code: string): Promise<ArrayBuffer> => {
    const { error, binary, stderr } = await (window as any).asc.compileString(code, {
        optimizeLevel: 3,
        runtime: "stub",
        exportRuntime: true,
    })
    if (error) {
        throw new Error(stderr.toString())
    }
    return binary.buffer
}

class OperationError extends Error {}