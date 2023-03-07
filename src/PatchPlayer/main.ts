import {
    ControlTreeModel,
    ControlsValues,
    createModels,
    initializeControlValues,
    PORTLET_ID,
} from './models'
import { createEngine } from './webpd-engine'
import { createViews } from './views'
import {
    renderCommentsViews,
    renderControlViews,
    renderStructure,
} from './render'
import { assertNonNullable, nextTick } from './misc-utils'
import { PatchPlayer, PatchPlayerWithSettings, Settings } from './types'
import { Artefacts, DspGraph, dspGraph, runtime } from 'webpd'

export const create = (artefacts: Artefacts): PatchPlayer => {
    const pdJson = assertNonNullable(
        artefacts.pdJson,
        'artefacts.pdJson not defined'
    )

    const dspGraph = assertNonNullable(
        artefacts.dspGraph,
        'artefacts missing dspGraph'
    )

    const controlsValues: ControlsValues = {
        values: {},
        transforms: {},
    }

    const { controls, comments } = createModels(controlsValues, pdJson)

    const { controlsViews, commentsViews } = createViews(controls, comments)

    const audioContext = new AudioContext()
    audioContext.suspend()

    return {
        rootElem: null,
        audioContext,
        webpdNode: null,
        pdJson,
        controls,
        controlsValues,
        controlsViews,
        commentsViews,
        settings: null,
        inletCallerSpecs: _collectInletCallerSpecs(controls, dspGraph.graph),
    }
}

export const start = async (
    artefacts: Artefacts,
    patchPlayerWithoutSettings: PatchPlayer,
    settings: Settings
) => {
    const patchPlayer: PatchPlayerWithSettings = {
        ...patchPlayerWithoutSettings,
        controlsValues: {
            ...patchPlayerWithoutSettings.controlsValues,
            values: settings.initialValues ? {...settings.initialValues} : {},
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
    await runtime.registerWebPdWorkletNode(patchPlayer.audioContext)

    ELEMS.loadingLabel.innerHTML = 'generating GUI ...'
    await nextTick()

    renderControlViews(patchPlayer, ELEMS.controlsRoot)
    renderCommentsViews(patchPlayer, ELEMS.controlsRoot)

    await nextTick()

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    patchPlayer.webpdNode = await createEngine(patchPlayer, stream, artefacts)
    patchPlayer.rootElem = rootElem

    ELEMS.loadingLabel.style.display = 'none'
    ELEMS.startButton.style.display = 'block'
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

const _collectInletCallerSpecs = (
    controls: Array<ControlTreeModel>,
    graph: DspGraph.Graph,
    inletCallerSpecs: {
        [nodeId: string]: Array<DspGraph.PortletId>
    } = {}
) => {
    controls.forEach((control) => {
        if (control.type === 'container') {
            inletCallerSpecs = _collectInletCallerSpecs(
                control.children,
                graph,
                inletCallerSpecs
            )
        } else if (control.type === 'control') {
            const nodeId = dspGraph.buildGraphNodeId(
                control.patch.id,
                control.node.id
            )
            const portletId = PORTLET_ID
            if (!graph[nodeId]) {
                return
            }
            inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || []
            inletCallerSpecs[nodeId].push(portletId)
        }
    })
    return inletCallerSpecs
}

const _startSound = (patchPlayer: PatchPlayerWithSettings) => {
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (patchPlayer.audioContext.state === 'suspended') {
        patchPlayer.audioContext.resume()
    }
    initializeControlValues(patchPlayer)
}
