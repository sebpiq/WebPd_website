import { assertNonNullable } from './misc-utils'
import { getControlValue, setControlValue } from './models'
import {
    PatchPlayer,
} from './PatchPlayer'
import { CONTAINER_PADDING, ControlView } from './views'

const GRID_SIZE_PX = 30
const LABEL_HEIGHT_GRID = 0.6
const SLIDER_SIZE_RATIO = 0.9
const BUTTON_SIZE_RATIO = 0.8
const HTML_STRUCTURE = `
    <div id="splash-container">
        <div id="loading"></div>
        <button id="start">START</button>
    </div>

    <div id="patch-controls">
        <div id="controls-root"></div>
    </div>

    <div id="credits">
        <button>Credits</button>
        <div class="content">
        <div>Sound made using <a href="https://github.com/sebpiq/WebPd/" target="_blank" rel="noopener noreferrer" >WebPd</a>.</div>
        <div>UI made using <a href="https://nexus-js.github.io/ui/" target="_blank" rel="noopener noreferrer" >NexusUI</a>.</div>
        <div>Demo source code available <a href="https://github.com/sebpiq/WebPd_demos/" target="_blank" rel="noopener noreferrer" >here</a>.</div>
        <div>Patch ginger2.pd by <a href="http://www.martin-brinkmann.de/pd-patches.html" target="_blank" rel="noopener noreferrer" >Martin Brinkmann</a>.</div>
        </div>
    </div>
`

export const renderStructure = (rootElem: HTMLDivElement) => {
    rootElem.innerHTML = HTML_STRUCTURE
    return {
        controlsRoot: assertNonNullable(
            rootElem.querySelector('#controls-root') as HTMLDivElement,
            'controlsRoot not found'
        ),
        startButton: assertNonNullable(
            rootElem.querySelector('#start') as HTMLButtonElement,
            'startButton not found'
        ),
        loadingLabel: assertNonNullable(
            rootElem.querySelector('#loading') as HTMLDivElement,
            'loadingLabel not found'
        ),
        loadingContainer: assertNonNullable(
            rootElem.querySelector('#splash-container') as HTMLDivElement,
            'loadingContainer not found'
        ),
        creditsButton: assertNonNullable(
            rootElem.querySelector('#credits button') as HTMLDivElement,
            'creditsButton not found'
        ),
        creditsContainer: assertNonNullable(
            rootElem.querySelector('#credits') as HTMLDivElement,
            'creditsContainer not found'
        ),
    }
}

export const renderControlViews = (
    patchPlayer: PatchPlayer,
    parent: HTMLElement,
    controlsViews: Array<ControlView> | null = null
) => {
    if (controlsViews === null) {
        controlsViews = patchPlayer.controlsViews!
    }
    controlsViews.forEach((controlView) => {
        if (controlView.type === 'container') {
            const childrenContainerElem = _renderContainer(
                patchPlayer,
                parent,
                controlView
            )
            renderControlViews(
                patchPlayer,
                childrenContainerElem,
                controlView.children
            )
        } else if (controlView.type === 'control') {
            _renderControl(patchPlayer, parent, controlView)
        }
    })
}

const _renderControl = (
    patchPlayer: PatchPlayer,
    parent: HTMLElement,
    controlView: ControlView
) => {
    const { node, patch } = controlView.control

    const color = patchPlayer.colorScheme.next()
    const position = assertNonNullable(
        controlView.position,
        'point is not defined'
    )

    const div = document.createElement('div')
    div.classList.add('control')
    div.id = `control-${patch.id}-${node.id}`
    div.style.left = `${
        position.x * GRID_SIZE_PX + CONTAINER_PADDING * 0.5 * GRID_SIZE_PX
    }px`
    div.style.top = `${
        position.y * GRID_SIZE_PX + CONTAINER_PADDING * 0.5 * GRID_SIZE_PX
    }px`
    div.style.width = `${controlView.dimensions.x * GRID_SIZE_PX}px`
    div.style.height = `${controlView.dimensions.y * GRID_SIZE_PX}px`
    parent.appendChild(div)

    const labelDiv = _renderLabel(div, controlView.label || '')
    labelDiv.style.color = color

    const innerDiv = document.createElement('div')
    div.appendChild(innerDiv)
    const nexusElem = _renderNexus(patchPlayer, innerDiv, controlView)

    nexusElem.colorize('accent', color)
    nexusElem.colorize('fill', 'black')
    nexusElem.colorize('dark', color)
    nexusElem.colorize('mediumDark', '#222')
    nexusElem.colorize('mediumLight', '#333')

    return div
}

const _renderContainer = (
    _: PatchPlayer,
    parent: HTMLElement,
    controlView: ControlView
) => {
    const div = document.createElement('div')
    div.classList.add('controls-container')
    const position = assertNonNullable(
        controlView.position,
        'point is not defined'
    )

    div.style.left = `${position.x * GRID_SIZE_PX}px`
    div.style.top = `${position.y * GRID_SIZE_PX}px`
    div.style.width = `${
        (controlView.dimensions.x - CONTAINER_PADDING) * GRID_SIZE_PX
    }px`
    div.style.height = `${
        (controlView.dimensions.y - CONTAINER_PADDING) * GRID_SIZE_PX
    }px`
    div.style.padding = `${CONTAINER_PADDING * 0.5 * GRID_SIZE_PX}px`
    if (controlView.label) {
        _renderLabel(div, controlView.label)
    }

    parent.appendChild(div)
    return div
}

const _renderLabel = (parent: HTMLElement, label: string) => {
    const labelDiv = document.createElement('div')
    labelDiv.classList.add('label')
    labelDiv.innerHTML = label
    labelDiv.style.height = `${LABEL_HEIGHT_GRID * GRID_SIZE_PX}px`
    parent.appendChild(labelDiv)
    return labelDiv
}

const _renderNexus = (
    patchPlayer: PatchPlayer,
    div: HTMLDivElement,
    controlView: ControlView
) => {
    const { node } = controlView.control
    let width = controlView.dimensions.x * GRID_SIZE_PX
    let height = (controlView.dimensions.y - LABEL_HEIGHT_GRID) * GRID_SIZE_PX
    const storedValue = getControlValue(patchPlayer, controlView.control)

    let nexusElem
    switch (node.type) {
        case 'hsl':
        case 'vsl':
            if (node.type === 'hsl') {
                height *= SLIDER_SIZE_RATIO
            } else {
                width *= SLIDER_SIZE_RATIO
            }
            nexusElem = new Nexus.Add.Slider(div, {
                min: node.args[0],
                max: node.args[1],
                value: storedValue !== undefined ? storedValue : node.args[3],
                size: [width, height],
            })
            break

        case 'hradio':
        case 'vradio':
            nexusElem = new Nexus.RadioButton(div, {
                numberOfButtons: node.args[0],
                active: storedValue !== undefined ? storedValue : node.args[2],
                size: [width, height],
            })
            break

        case 'bng':
            nexusElem = new Nexus.Button(div, {
                size: [height, height],
            })
            break

        case 'msg':
            nexusElem = new Nexus.TextButton(div, {
                size: [width, height],
                text: node.args.join(' '),
            })
            break

        case 'nbx':
        case 'floatatom':
            nexusElem = new Nexus.Number(div, {
                value:
                    storedValue !== undefined
                        ? storedValue
                        : node.type === 'nbx'
                        ? node.args[3]
                        : 0,
                size: [width, height * BUTTON_SIZE_RATIO],
            })
            break

        case 'tgl':
            nexusElem = new Nexus.Button(div, {
                mode: 'toggle',
                state: storedValue !== undefined ? storedValue : !!node.args[2],
                size: [width, height],
            })
            break

        default:
            throw new Error(`Not supported ${node.type}`)
    }

    nexusElem.on('change', (v: number) => setControlValue(patchPlayer, controlView.control, v))
    return nexusElem
}
