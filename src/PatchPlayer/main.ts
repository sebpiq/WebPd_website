import { ControlsValues, createModels, initializeControlValues } from './models'
import { createViews } from './views'
import {
    renderCommentsViews,
    renderControlViews,
    renderStructure,
} from './render'
import { assertNonNullable, nextTick } from './misc-utils'
import { PatchPlayer, PatchPlayerWithSettings, Settings } from './types'
import { Build, AppGenerator, Browser } from 'webpd'

export const create = (artefacts: Build.Artefacts, patchUrl: string | null): PatchPlayer => {
    const dspGraph = assertNonNullable(
        artefacts.dspGraph,
        'artefacts.dspGraph not defined'
    )

    const controlsValues: ControlsValues = {
        values: {},
        transforms: {},
    }

    const { controls, comments } = createModels(dspGraph.pd, controlsValues)
    const { controlsViews, commentsViews } = createViews(controls, comments)

    const audioContext = new AudioContext()
    audioContext.suspend()

    return {
        rootElem: null,
        patchUrl,
        audioContext,
        webpdNode: null,
        pdJson: dspGraph.pd,
        controls,
        controlsValues,
        controlsViews,
        commentsViews,
        inletCallersSpecs: AppGenerator.collectGuiControlsInletCallerSpecs(controls, dspGraph.graph),
        settings: null,
    }
}

export const start = async (
    artefacts: Build.Artefacts,
    patchPlayerWithoutSettings: PatchPlayer,
    settings: Settings
) => {
    const patchPlayer: PatchPlayerWithSettings = {
        ...patchPlayerWithoutSettings,
        controlsValues: {
            ...patchPlayerWithoutSettings.controlsValues,
            values: settings.initialValues ? { ...settings.initialValues } : {},
        },
        settings,
    }

    const rootElem = document.createElement('div')

    patchPlayer.settings.container.appendChild(rootElem)
    // TODO
    // loadStateFromUrl()
    const ELEMS = renderStructure(rootElem)

    if (patchPlayer.settings.showCredits !== true) {
        ELEMS.creditsButton.style.display = 'none'
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
        _startSound(patchPlayer)
    }

    ELEMS.loadingLabel.innerHTML = 'loading assemblyscript compiler ...'
    console.log('PatchPlayer START')
    await Browser.initialize(patchPlayer.audioContext)

    ELEMS.loadingLabel.innerHTML = 'generating GUI ...'
    await nextTick()

    renderControlViews(patchPlayer, ELEMS.controlsRoot)
    renderCommentsViews(patchPlayer, ELEMS.controlsRoot)

    await nextTick()

    let stream: MediaStream | null = null
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
        console.error(`Failed to get microphone stream ${err}`)
    }
    patchPlayer.webpdNode = await createAudioNode(patchPlayer, stream, artefacts)
    patchPlayer.rootElem = rootElem

    ELEMS.loadingLabel.style.display = 'none'
    ELEMS.startButton.style.display = 'block'

    return patchPlayer
}

export const destroy = (patchPlayer: PatchPlayer) => {
    if (patchPlayer.rootElem) {
        patchPlayer.rootElem.innerHTML = ''
        patchPlayer.rootElem.remove()
        console.log('DESTROY PATCH PLAYER', patchPlayer.rootElem)
    }
    patchPlayer.webpdNode.disconnect()
    patchPlayer.audioContext.suspend()
}

export const createAudioNode = async (
    patchPlayer: PatchPlayer,
    stream: MediaStream | null,
    artefacts: Build.Artefacts
) => {
    if (!artefacts.compiledJs && !artefacts.wasm) {
        throw new Error(`Missing artefacts for creating the engine`)
    }

    const webpdNode = await Browser.run(
        patchPlayer.audioContext,
        (artefacts.compiledJs || artefacts.wasm)!,
        Browser.createDefaultRunSettings(patchPlayer.patchUrl || '.')
    )

    if (stream) {
        const sourceNode =
            patchPlayer.audioContext.createMediaStreamSource(stream)
        sourceNode.connect(webpdNode)
    }
    webpdNode.connect(patchPlayer.audioContext.destination)
    return webpdNode
}

const _startSound = (patchPlayer: PatchPlayerWithSettings) => {
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (patchPlayer.audioContext.state === 'suspended') {
        patchPlayer.audioContext.resume()
    }
    initializeControlValues(patchPlayer)
}

