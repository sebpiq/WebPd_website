import {
    registerWebPdWorkletNode,
} from '@webpd/audioworklets'
import { loadPdJson } from './pd-json'
import { createModels } from './models'
import { createEngine } from './webpd-engine'
import { createViews } from './views'
import { render } from './render'

const CONTROLS_ROOT_CONTAINER_ELEM = document.querySelector('#controls-root')

const STATE = {
    audioContext: new AudioContext(),
    webpdNode: null,
    pdJson: null,
    controls: null,
    controlsViews: null,
}

document.querySelector('#start').onclick = () => {
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (STATE.audioContext.state === 'suspended') {
        STATE.audioContext.resume()
    }
}

const initializeApp = async () => {
    await registerWebPdWorkletNode(STATE.audioContext)
}

initializeApp()
    .then(() => loadPdJson('./ginger2.pd'))
    .then((pdJson) => {
        STATE.pdJson = pdJson
        STATE.controls = createModels(STATE)
        STATE.webpdNode = createEngine(STATE)
        STATE.controlsViews = createViews(STATE)
        STATE
        render(STATE, CONTROLS_ROOT_CONTAINER_ELEM)
    })
