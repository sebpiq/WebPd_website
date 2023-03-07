import { Point } from './math-utils'
import { assertNonNullable } from './misc-utils'
import { getControlValue, setControlValue } from './models'
import { PatchPlayerWithSettings } from './types'
import { CONTAINER_EXTRA_SPACE, ControlTreeView, ControlView } from './views'

const FONT_FAMILY = 'Rajdhani'
const GRID_SIZE_PX = 4
const LABEL_HEIGHT_GRID = 4
const SLIDER_SIZE_RATIO = 1.2

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
    patchPlayer: PatchPlayerWithSettings,
    parentElem: HTMLElement
) => {
    _renderControlViewsRecurs(
        patchPlayer,
        parentElem,
        patchPlayer.controlsViews,
        null
    )
}

export const renderCommentsViews = (
    patchPlayer: PatchPlayerWithSettings,
    parentElem: HTMLElement
) => {
    patchPlayer.commentsViews.forEach((commentView) => {
        const div = document.createElement('div')
        div.classList.add('comment')
        div.innerHTML = commentView.text
        parentElem.appendChild(div)
        div.style.left = `${_scaleSpace(commentView.position.x)}px`
        div.style.top = `${_scaleSpace(commentView.position.y)}px`
    })
}

const _renderControlViewsRecurs = (
    patchPlayer: PatchPlayerWithSettings,
    parentElem: HTMLElement,
    children: Array<ControlTreeView>,
    parent: ControlTreeView | null
) => {
    children.forEach((controlView) => {
        if (controlView.type === 'container') {
            const childrenContainerElem = _renderContainer(
                patchPlayer,
                parentElem,
                controlView
            )
            _renderControlViewsRecurs(
                patchPlayer,
                childrenContainerElem,
                controlView.children,
                controlView
            )
        } else if (controlView.type === 'control') {
            _renderControl(
                patchPlayer,
                parentElem,
                controlView,
                _getContainerPadding(parent ? _hasLabel(parent) : false)
            )
        }
    })
}

const _renderContainer = (
    _: PatchPlayerWithSettings,
    parent: HTMLElement,
    controlView: ControlTreeView
) => {
    const div = document.createElement('div')
    div.classList.add('controls-container')

    const containerPadding = _getContainerPadding(_hasLabel(controlView))

    div.style.left = `${_scaleSpace(controlView.position.x)}px`
    div.style.top = `${_scaleSpace(controlView.position.y)}px`
    div.style.width = `${_scaleSpace(controlView.dimensions.x)}px`
    div.style.height = `${_scaleSpace(controlView.dimensions.y)}px`
    div.style.paddingTop = `${_scaleSpace(containerPadding.top)}px`
    div.style.paddingBottom = `${_scaleSpace(containerPadding.bottom)}px`
    div.style.paddingRight = `${_scaleSpace(containerPadding.right)}px`
    div.style.paddingLeft = `${_scaleSpace(containerPadding.left)}px`

    if (_hasLabel(controlView)) {
        _renderLabel(div, controlView.label!)
    }

    parent.appendChild(div)
    return div
}

const _renderControl = (
    patchPlayer: PatchPlayerWithSettings,
    parent: HTMLElement,
    controlView: ControlView,
    containerPadding: ReturnType<typeof _getContainerPadding>
) => {
    const { node, patch } = controlView.control

    const color = patchPlayer.settings.colorScheme.next()

    const div = document.createElement('div')
    div.classList.add('control')
    div.classList.add(node.type)
    div.id = `control-${patch.id}-${node.id}`
    div.style.left = `${_scaleSpace(
        controlView.position.x + containerPadding.left
    )}px`
    div.style.top = `${_scaleSpace(
        controlView.position.y + containerPadding.top
    )}px`
    div.style.width = `${_scaleSpace(controlView.dimensions.x)}px`
    div.style.height = `${_scaleSpace(controlView.dimensions.y)}px`
    parent.appendChild(div)

    if (_hasLabel(controlView)) {
        const labelDiv = _renderLabel(div, controlView.label || '')
        labelDiv.style.color = color
    }

    const innerDiv = document.createElement('div')
    div.appendChild(innerDiv)

    const nexusDimensions: Point = {
        x: _scaleSpace(controlView.dimensions.x),
        y: _scaleSpace(
            controlView.dimensions.y -
                (_hasLabel(controlView) ? LABEL_HEIGHT_GRID : 0)
        ),
    }
    const nexusElem = _renderNexus(
        patchPlayer,
        innerDiv,
        controlView,
        nexusDimensions
    )

    nexusElem.colorize('accent', color)
    nexusElem.colorize('fill', 'black')
    nexusElem.colorize('dark', color)
    nexusElem.colorize('mediumDark', '#222')
    nexusElem.colorize('mediumLight', '#333')
    nexusElem.element.style.fontFamily = FONT_FAMILY

    return div
}

const _renderLabel = (parent: HTMLElement, label: string) => {
    const labelDiv = document.createElement('div')
    labelDiv.classList.add('label')
    labelDiv.innerHTML = label
    labelDiv.style.height = `${_scaleSpace(LABEL_HEIGHT_GRID)}px`
    parent.appendChild(labelDiv)
    return labelDiv
}

const _renderNexus = (
    patchPlayer: PatchPlayerWithSettings,
    div: HTMLDivElement,
    controlView: ControlView,
    dimensions: Point
) => {
    let { x: width, y: height } = dimensions
    const { node } = controlView.control
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
                size: [width, height],
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

    nexusElem.on('change', (v: number) =>
        setControlValue(patchPlayer, controlView.control, v)
    )
    return nexusElem
}

const _scaleSpace = (v: number) => v * GRID_SIZE_PX

const _getContainerPadding = (hasLabel: boolean) => ({
    top: hasLabel
        ? CONTAINER_EXTRA_SPACE.y - CONTAINER_EXTRA_SPACE.x / 2
        : CONTAINER_EXTRA_SPACE.y / 2,
    left: CONTAINER_EXTRA_SPACE.x / 2,
    right: CONTAINER_EXTRA_SPACE.x / 2,
    bottom: hasLabel
        ? CONTAINER_EXTRA_SPACE.x / 2
        : CONTAINER_EXTRA_SPACE.y / 2,
})

const _hasLabel = (controlView: ControlTreeView) =>
    !!(controlView.label && controlView.label.length)
