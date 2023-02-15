import {
    registerWebPdWorkletNode,
} from '@webpd/audioworklets'
import { loadPdJson } from './pd-json'
import { createModels } from './models'
import { createEngine } from './webpd-engine'
import { createViews } from './views'
import { render, generateColorScheme } from './render'
import { waitAscCompiler } from './wasm'
import { nextTick } from './misc-utils'
import { STATE, loadStateFromUrl } from './state'

const ELEMS = {
    controlsRoot: document.querySelector('#controls-root'),
    startButton: document.querySelector('#start'),
    creditsContainer: document.querySelector('#credits'),
    creditsButton: document.querySelector('#credits button'),
    loadingLabel: document.querySelector('#loading'),
    loadingContainer: document.querySelector('#splash-container')
}

ELEMS.creditsButton.onclick = () => {
    if (ELEMS.creditsContainer.classList.contains('expanded')) {
        ELEMS.creditsContainer.classList.remove('expanded')
    } else {
        ELEMS.creditsContainer.classList.add('expanded')
    }
}

ELEMS.startButton.style.display = 'none'
ELEMS.startButton.onclick = () => {
    ELEMS.loadingContainer.style.display = 'none'
    startSound()
}

STATE.audioContext.suspend()
const startSound = () => {
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (STATE.audioContext.state === 'suspended') {
        STATE.audioContext.resume()
    }
    STATE.controlsValues.initialize()
}

const initializeApp = async () => {
    loadStateFromUrl()

    ELEMS.loadingLabel.innerHTML = 'loading assemblyscript compiler ...'
    await waitAscCompiler()
    await registerWebPdWorkletNode(STATE.audioContext)

    ELEMS.loadingLabel.innerHTML = `downloading patch ${STATE.params.patch} ...`
    STATE.pdJson = await loadPdJson(STATE.params.patch)

    ELEMS.loadingLabel.innerHTML = 'generating GUI ...'
    await nextTick()

    STATE.controls = createModels(STATE)
    STATE.controlsViews = createViews(STATE)
    STATE.colorScheme = generateColorScheme(STATE)
    render(STATE, ELEMS.controlsRoot)

    ELEMS.loadingLabel.innerHTML = `compiling${STATE.params.target === 'assemblyscript' ? ' Web Assembly ': ' '}engine ...`
    await nextTick()

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    STATE.webpdNode = await createEngine(STATE, stream)
}

initializeApp()
    .then(() => {
        ELEMS.loadingLabel.style.display = 'none'
        ELEMS.startButton.style.display = 'block'
        console.log('APP READY')
    })
    .catch((err) => {
        ELEMS.loadingLabel.innerHTML = 'ERROR :( <br/>' + err.message
        console.error(err)
    })
