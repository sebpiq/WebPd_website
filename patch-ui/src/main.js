import {
    registerWebPdWorkletNode,
} from '@webpd/audioworklets'
import { loadPdJson } from './pd-json'
import { createModels } from './models'
import { createEngine } from './webpd-engine'
import { createViews } from './views'
import { render, generateColorScheme } from './render'
import { waitAscCompiler } from './wasm'

const ELEMS = {
    controlsRoot: document.querySelector('#controls-root'),
    startButton: document.querySelector('#start'),
    loadingLabel: document.querySelector('#loading'),
    loadingContainer: document.querySelector('#splash-container')
}
ELEMS.startButton.style.display = 'none'
const PATCH_URL = './ginger2.pd'

const STATE = {
    target: 'assemblyscript',
    audioContext: new AudioContext(),
    webpdNode: null,
    pdJson: null,
    controls: null,
    controlsViews: null,
}

ELEMS.startButton.onclick = () => {
    ELEMS.loadingContainer.style.display = 'none'
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (STATE.audioContext.state === 'suspended') {
        STATE.audioContext.resume()
    }
}

const _nextTick = () => new Promise((resolve) => setTimeout(resolve, 1))

const initializeApp = async () => {
    ELEMS.loadingLabel.innerHTML = 'loading assemblyscript compiler ...'
    await waitAscCompiler()
    await registerWebPdWorkletNode(STATE.audioContext)

    ELEMS.loadingLabel.innerHTML = `downloading patch ${PATCH_URL} ...`
    STATE.pdJson = await loadPdJson(PATCH_URL)

    ELEMS.loadingLabel.innerHTML = 'generating GUI ...'
    await _nextTick()

    STATE.controls = createModels(STATE)
    STATE.controlsViews = createViews(STATE)
    STATE.colorScheme = generateColorScheme(STATE)
    render(STATE, ELEMS.controlsRoot)

    ELEMS.loadingLabel.innerHTML = 'compiling engine ...'
    await _nextTick()

    STATE.webpdNode = await createEngine(STATE)
}

initializeApp()
    .then(() => {
        ELEMS.loadingLabel.style.display = 'none'
        ELEMS.startButton.style.display = 'block'
        console.log('APP READY')
    })
    .catch(() => {
        ELEMS.loadingLabel.innerHTML = 'ERROR :('
    })
