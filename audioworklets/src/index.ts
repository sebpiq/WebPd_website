import { audioworkletWasm, addModule } from '@webpd/audioworklets'

const BIT_DEPTH = 64
const CHANNEL_COUNT = 1
const WASM_PATCHES: {[name: string]: ArrayBuffer | null} = {
    'osc': null,
    'play-array': null,
}
const SAMPLES: {[name: string]: Float64Array | null} = {
    'audio1': null,
}

const startButton = document.querySelector('button#start') as HTMLButtonElement
const patchesDiv = document.querySelector('div#patches') as HTMLDivElement

const context = new AudioContext()
let wasmNode: null | audioworkletWasm.WorkletNode

const initializeApp = async () => {
    await addModule(context, audioworkletWasm.WorkletProcessorCode)
    
    // Load wasm patches
    const patchNames = Object.keys(WASM_PATCHES)
    for (let name of patchNames) {
        WASM_PATCHES[name] = await loadWasmPatch(name)
        const button = document.createElement('button')
        button.innerHTML = name
        button.onclick = (function(name: string) {
            return () => {
                setWasmPatch(name)
            }
        })(name)
        patchesDiv.appendChild(button)
    }

    // Load audio samples
    const sampleNames = Object.keys(SAMPLES)
    for (let name of sampleNames) {
        SAMPLES[name] = await loadAudioSample(name)
    }
}

const startAudio = () => {
    context.resume()
    wasmNode = new audioworkletWasm.WorkletNode(context, CHANNEL_COUNT, BIT_DEPTH)
    wasmNode.connect(context.destination)
    startButton.style.display = 'none'
}

const loadWasmPatch = async (name: string) => {
    const url = `assets/wasm/${name}.wasm`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`unvalid response for ${url}: ${response.status}`)
    }
    return response.arrayBuffer()
}

const loadAudioSample = async (name: string) => {
    const url = `assets/audio/${name}.mp3`
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`unvalid response for ${url}: ${response.status}`)
    }
    const audioData = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(audioData)

    // !!! Loading only first channel of stereo audio
    return Float64Array.from(audioBuffer.getChannelData(0))
}

const setWasmPatch = (name: string) => {
    const wasmPatch = WASM_PATCHES[name]
    if (wasmPatch) {
        console.log(`set wasm patch ${name} : byte length ${wasmPatch.byteLength}`)
        wasmNode?.port.postMessage({
            type: 'WASM', payload: {
                wasmBuffer: wasmPatch, arrays: SAMPLES
            }
        })
    }
}

initializeApp().then(() => {
    startButton.style.display = 'block'
    startButton.onclick = startAudio
    console.log("audio initialized")
})