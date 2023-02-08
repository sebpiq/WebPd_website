import {
    registerWebPdWorkletNode,
} from '@webpd/audioworklets'
import { loadPdJson } from './pd-json'
import { getControlsFromPdJson } from './pd-json'
import { createEngine } from './webpd-engine'
import { adjustRootContainer, renderControlsGui } from './gui'

const CONTROLS_ROOT_CONTAINER_ELEM = document.querySelector('#controls-root')

const STATE = {
    audioContext: new AudioContext(),
    webpdNode: null,
    pdJson: null,
    controls: null
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
        STATE.controls = getControlsFromPdJson(pdJson, pdJson.patches['0'])
        STATE.webpdNode = createEngine(STATE)
        renderControlsGui(STATE, CONTROLS_ROOT_CONTAINER_ELEM)
        adjustRootContainer(CONTROLS_ROOT_CONTAINER_ELEM)
    })
