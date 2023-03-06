import {
    ControlModel,
    ControlsValues,
    createModels,
    initializeControlValues,
    PORTLET_ID,
} from './models'
import { createEngine } from './webpd-engine'
import { createViews } from './views'
import { renderControlViews, renderStructure } from './render'
import { assertNonNullable, nextTick } from './misc-utils'
import { PatchPlayer } from './PatchPlayer'
import { Artefacts, DspGraph, dspGraph, runtime } from 'webpd'

export const create = (
    artefacts: Artefacts,
    colorScheme: {
        next: () => string
    }
): PatchPlayer => {
    const pdJson = assertNonNullable(
        artefacts.pdJson,
        'artefacts.pdJson not defined'
    )

    const dspGraph = assertNonNullable(
        artefacts.dspGraph,
        'artefacts missing dspGraph'
    )

    const controlsValues: ControlsValues = {
        _values: {},
        _valueTransforms: {},
    }

    const controls = createModels(controlsValues, pdJson)

    const audioContext = new AudioContext()
    audioContext.suspend()

    return {
        rootElem: null,
        audioContext,
        webpdNode: null,
        pdJson,
        controls,
        controlsValues,
        controlsViews: createViews(controls),
        colorScheme,
        inletCallerSpecs: _collectInletCallerSpecs(controls, dspGraph.graph),
    }
}

export const start = async (
    patchPlayer: PatchPlayer,
    container: HTMLDivElement,
    artefacts: Artefacts
) => {
    const rootElem = document.createElement('div')
    container.appendChild(rootElem)
    // TODO
    // loadStateFromUrl()
    const ELEMS = renderStructure(rootElem)

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
    await runtime.registerWebPdWorkletNode(patchPlayer.audioContext)

    ELEMS.loadingLabel.innerHTML = 'generating GUI ...'
    await nextTick()

    renderControlViews(patchPlayer, ELEMS.controlsRoot)

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
    controls: Array<ControlModel>,
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

const _startSound = (patchPlayer: PatchPlayer) => {
    // https://github.com/WebAudio/web-audio-api/issues/345
    if (patchPlayer.audioContext.state === 'suspended') {
        patchPlayer.audioContext.resume()
    }
    initializeControlValues(patchPlayer)
}