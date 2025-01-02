import { assertNonNullable } from './misc-utils'
import { getCurrentValue, registerView } from './controller'
import {
    CommentView,
    ContainerView,
    ControlOrContainerView,
    ControlView,
    PatchPlayerWithSettings,
    Point,
} from './types'
import { CONTAINER_EXTRA_SPACE } from './views'

const FONT_FAMILY = 'Rajdhani'
const GRID_SIZE_PX = 3
const LABEL_HEIGHT_GRID = 5
const SLIDER_SIZE_RATIO = 1.2

const HTML_STRUCTURE = `
    <div id="splash-container">
        <div id="loading"></div>
        <button id="start">START</button>
    </div>

    <div id="patch-controls">
        <div id="views-root"></div>
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
        viewsRoot: assertNonNullable(
            rootElem.querySelector('#views-root') as HTMLDivElement,
            'viewsRoot not found'
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

export const renderViews = (
    patchPlayer: PatchPlayerWithSettings,
    parentElem: HTMLElement
) => {
    _renderViewsRecurs(
        patchPlayer,
        parentElem,
        patchPlayer.views.root,
        null
    )
}

const _renderViewsRecurs = (
    patchPlayer: PatchPlayerWithSettings,
    parentElem: HTMLElement,
    children: Array<ControlView | ContainerView | CommentView>,
    parent: ContainerView | null
) => {
    children.forEach((view) => {
        if (view.type === 'comment') {
            _renderComment(patchPlayer, parentElem, view)
        } else if (view.type === 'container') {
            const childrenContainerElem = _renderContainer(
                patchPlayer,
                parentElem,
                view
            )
            _renderViewsRecurs(
                patchPlayer,
                childrenContainerElem,
                view.children,
                view
            )
        } else if (view.type === 'control') {
            _renderControl(
                patchPlayer,
                parentElem,
                view,
                _getContainerPadding(parent ? _hasLabel(parent) : false)
            )
        }
    })
}

const _renderContainer = (
    _: PatchPlayerWithSettings,
    parent: HTMLElement,
    containerView: ContainerView
) => {
    const div = document.createElement('div')
    div.classList.add('controls-container')

    const containerPadding = _getContainerPadding(_hasLabel(containerView))

    div.style.left = `${_scaleSpace(containerView.position.x)}px`
    div.style.top = `${_scaleSpace(containerView.position.y)}px`
    div.style.width = `${_scaleSpace(containerView.dimensions.x)}px`
    div.style.height = `${_scaleSpace(containerView.dimensions.y)}px`
    div.style.paddingTop = `${_scaleSpace(containerPadding.top)}px`
    div.style.paddingBottom = `${_scaleSpace(containerPadding.bottom)}px`
    div.style.paddingRight = `${_scaleSpace(containerPadding.right)}px`
    div.style.paddingLeft = `${_scaleSpace(containerPadding.left)}px`

    if (_hasLabel(containerView)) {
        _renderLabel(div, containerView.label!)
    }

    parent.appendChild(div)
    return div
}

const _renderComment = (
    _: PatchPlayerWithSettings,
    parentElem: HTMLElement,
    commentView: CommentView
) => {
    const div = document.createElement('div')
    div.classList.add('comment')
    div.innerHTML = commentView.text
    parentElem.appendChild(div)
    div.style.left = `${_scaleSpace(commentView.position.x)}px`
    div.style.top = `${_scaleSpace(commentView.position.y)}px`
    return div
}

const _renderControl = (
    patchPlayer: PatchPlayerWithSettings,
    parent: HTMLElement,
    controlView: ControlView,
    containerPadding: ReturnType<typeof _getContainerPadding>
) => {
    const { nodeId, pdNode } = controlView

    const color = patchPlayer.settings.colorScheme.next()

    const div = document.createElement('div')
    div.classList.add('control')
    div.classList.add(pdNode.type)
    div.id = `control-${nodeId}`
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
    const { pdNode, nodeId } = controlView
    const storedValue = getCurrentValue(patchPlayer, nodeId)

    let nexusElem
    let nexusElemOptions: {[k: string]: string | number} = {}
    switch (pdNode.type) {
        case 'hsl':
        case 'vsl':
            if (pdNode.type === 'hsl') {
                height *= SLIDER_SIZE_RATIO
            } else {
                width *= SLIDER_SIZE_RATIO
            }
            nexusElem = new Nexus.Add.Slider(div, {
                min: pdNode.args[0],
                max: pdNode.args[1],
                value: storedValue !== undefined ? storedValue : pdNode.args[3],
                size: [width, height],
            })
            break

        case 'hradio':
        case 'vradio':
            nexusElem = new Nexus.RadioButton(div, {
                numberOfButtons: pdNode.args[0],
                active:
                    storedValue !== undefined ? storedValue : pdNode.args[2],
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
                text: pdNode.args.join(' '),
            })
            break

        case 'nbx':
        case 'floatatom':
            if (pdNode.args[0] < pdNode.args[1]) {
                // Not sure what's the max but if limits are too big, NexusUI Number wont work.
                nexusElemOptions.min = Math.max(pdNode.args[0], -1e15)
                nexusElemOptions.max = Math.min(pdNode.args[1], 1e15)
            }
            nexusElem = new Nexus.Number(div, {
                value:
                    storedValue !== undefined
                        ? storedValue
                        : pdNode.type === 'nbx'
                        ? pdNode.args[3]
                        : 0,
                size: [width, height],
                ...nexusElemOptions,
            })
            break

        case 'tgl':
            nexusElem = new Nexus.Button(div, {
                mode: 'toggle',
                state:
                    storedValue !== undefined ? storedValue : !!pdNode.args[2],
                size: [width, height],
            })
            break

        case 'symbolatom':
            nexusElem = new Nexus.TextButton(div, {
                size: [width, height],
                state: false,
                text: 'SYMBOLATOM NOT SUPPORTED',
            })
            break

        case 'cnv':
            nexusElem = new Nexus.TextButton(div, {
                size: [width, height],
                state: false,
                text: 'CNV NOT SUPPORTED',
            })
            break

        default:
            throw new Error(`Not supported ${pdNode.type}`)
    }

    controlView.nexusElem = nexusElem
    registerView(patchPlayer, controlView)
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

const _hasLabel = (view: ControlOrContainerView) =>
    !!(view.label && view.label.length)
