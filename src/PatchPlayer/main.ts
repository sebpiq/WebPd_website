import { initializeValues, receiveMsgFromWebPd } from './controller'
import { buildViewsIndex, createViews } from './views'
import { renderViews, renderStructure } from './render'
import { assertNonNullable, nextTick } from './misc-utils'
import {
    Controller,
    PatchPlayer,
    PatchPlayerWithSettings,
    Settings,
} from './types'
import { Build, Browser, WebPdMetadata } from 'webpd'

export const create = async (
    artefacts: Build.Artefacts,
    patchUrl: string | null
): Promise<PatchPlayer> => {
    const compiledPatch = assertNonNullable(
        artefacts.javascript || artefacts.wasm,
        'artefacts.javascript or artefacts.wasm should be defined'
    )

    const engineMetadata = await Browser.readMetadata(compiledPatch)

    const controller: Controller = {
        values: {},
        functions: {},
    }

    const rootViews = createViews(
        engineMetadata.customMetadata as unknown as WebPdMetadata
    )

    const audioContext = new AudioContext()
    audioContext.suspend()

    return {
        rootElem: null,
        patchUrl,
        audioContext,
        webpdNode: null,
        controller,
        views: {
            root: rootViews,
            indexed: buildViewsIndex(rootViews),
        },
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
        controller: {
            ...patchPlayerWithoutSettings.controller,
            values: settings.initialValues ? { ...settings.initialValues } : {},
        },
        settings,
    }

    // ----- Create and initialize HTML structure of the patch player
    const rootElem = document.createElement('div')

    patchPlayer.settings.container.appendChild(rootElem)
    const htmlElements = renderStructure(rootElem)

    if (patchPlayer.settings.showCredits !== true) {
        htmlElements.creditsButton.style.display = 'none'
    }

    htmlElements.creditsButton.onclick = () => {
        if (htmlElements.creditsContainer.classList.contains('expanded')) {
            htmlElements.creditsContainer.classList.remove('expanded')
        } else {
            htmlElements.creditsContainer.classList.add('expanded')
        }
    }

    htmlElements.startButton.style.display = 'none'
    htmlElements.startButton.onclick = () => {
        htmlElements.loadingContainer.style.display = 'none'
        _startSound(patchPlayer)
    }

    htmlElements.loadingLabel.innerHTML = 'loading assemblyscript compiler ...'

    // ----- Initialize WebPd and render views
    console.log('PatchPlayer START')
    await Browser.initialize(patchPlayer.audioContext)

    htmlElements.loadingLabel.innerHTML = 'generating GUI ...'
    await nextTick()

    renderViews(patchPlayer, htmlElements.viewsRoot)

    await nextTick()

    let stream: MediaStream | null = null
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
        console.error(`Failed to get microphone stream ${err}`)
    }
    patchPlayer.webpdNode = await _createAudioNode(
        patchPlayer,
        stream,
        artefacts
    )
    patchPlayer.rootElem = rootElem

    htmlElements.loadingLabel.style.display = 'none'
    htmlElements.startButton.style.display = 'block'

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

const _createAudioNode = async (
    patchPlayer: PatchPlayerWithSettings,
    stream: MediaStream | null,
    artefacts: Build.Artefacts
) => {
    if (!artefacts.javascript && !artefacts.wasm) {
        throw new Error(`Missing artefacts for creating the engine`)
    }

    const webpdNode = await Browser.run(
        patchPlayer.audioContext,
        (artefacts.javascript || artefacts.wasm)!,
        Browser.defaultSettingsForRun(
            patchPlayer.patchUrl || '.',
            (...args) => receiveMsgFromWebPd(patchPlayer, ...args),
        )
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
    initializeValues(patchPlayer)
}
