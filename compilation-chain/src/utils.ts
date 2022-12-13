import { StepId, CompileTarget } from "./appState"

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

export const download = (filename: string, data: string | ArrayBuffer, mimetype: string) => {
    const blob = new Blob([data], { type: mimetype })
    if ((window.navigator as any).msSaveOrOpenBlob) {
        ;(window.navigator as any).msSaveBlob(blob, filename)
    } else {
        const elem = window.document.createElement('a')
        elem.href = window.URL.createObjectURL(blob)
        elem.download = filename
        document.body.appendChild(elem)
        elem.click()
        document.body.removeChild(elem)
    }
}