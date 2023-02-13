import { buildGraphNodeId } from '@webpd/pd-json'
import { PORTLET_ID } from './pd-json'
import { CONTAINER_PADDING } from './views'

const GRID_SIZE_PX = 30
const LABEL_HEIGHT_GRID = 0.6

export const render = (STATE, parent, controlsViews = null) => {
    if (controlsViews === null) {
        controlsViews = STATE.controlsViews
    }
    controlsViews.forEach((controlView) => {
        if (controlView.type === 'container') {
            const childrenContainerElem = _renderContainer(STATE, parent, controlView)
            render(STATE, childrenContainerElem, controlView.children)
        } else if (controlView.type === 'control') {
            _renderControl(STATE, parent, controlView)
        } else {
            throw new Error(`unexpected control type ${controlView.type}`)
        }
    })
}

const _renderControl = (STATE, parent, controlView) => {
    const { node, patch } = controlView.control

    const color = STATE.colorScheme.next()

    const div = document.createElement('div')
    div.classList.add('control')
    div.id = `control-${patch.id}-${node.id}`
    div.style.left = `${
        controlView.position.x * GRID_SIZE_PX + CONTAINER_PADDING * GRID_SIZE_PX
    }px`
    div.style.top = `${
        controlView.position.y * GRID_SIZE_PX
    }px`
    div.style.width = `${controlView.dimensions.x * GRID_SIZE_PX}px`
    div.style.height = `${controlView.dimensions.y * GRID_SIZE_PX}px`
    parent.appendChild(div)

    if (controlView.label) {
        const labelDiv = _renderLabel(div, controlView.label)
        labelDiv.style.color = color
    }

    const innerDiv = document.createElement('div')
    div.appendChild(innerDiv)
    const nexusElem = _renderNexus(STATE, innerDiv, controlView)
    
    nexusElem.colorize('accent', color)
    nexusElem.colorize('fill', 'black')
    nexusElem.colorize('dark', color)
    nexusElem.colorize('mediumDark', '#222')
    nexusElem.colorize('mediumLight', '#333')

    return div
}

const _renderContainer = (_, parent, controlView) => {
    const div = document.createElement('div')
    div.classList.add('controls-container')

    div.style.left = `${controlView.position.x * GRID_SIZE_PX}px`
    div.style.top = `${controlView.position.y * GRID_SIZE_PX}px`
    div.style.width = `${(controlView.dimensions.x - CONTAINER_PADDING) * GRID_SIZE_PX}px`
    div.style.height = `${
        (controlView.dimensions.y - CONTAINER_PADDING) * GRID_SIZE_PX
    }px`
    div.style.padding = `${CONTAINER_PADDING * 0.5 * GRID_SIZE_PX}px`

    // div.style.backgroundColor = '#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6)
    if (controlView.label) {
        _renderLabel(div, controlView.label)
    }

    parent.appendChild(div)
    return div
}

const _renderLabel = (parent, label) => {
    const labelDiv = document.createElement('div')
    labelDiv.classList.add('label')
    labelDiv.innerHTML = label
    parent.appendChild(labelDiv)
    return labelDiv
}

const _renderNexus = (STATE, div, controlView) => {
    const { node, patch } = controlView.control
    const width = controlView.dimensions.x * GRID_SIZE_PX
    const height = (controlView.dimensions.y - LABEL_HEIGHT_GRID) * GRID_SIZE_PX

    let nexusElem
    switch (node.type) {
        case 'hsl':
            // TODO : case 'vsl':
            nexusElem = new Nexus.Add.Slider(div, {
                min: node.args[0],
                max: node.args[1],
                value: node.args[3],
                size: [width, height],
            })
            break

        case 'hradio':
            // TODO : case 'vradio':
            nexusElem = new Nexus.RadioButton(div, {
                numberOfButtons: node.args[0],
                active: node.args[2],
                size: [width, height],
            })
            break

        case 'bng':
            // TODO : case 'vradio':
            nexusElem = new Nexus.Button(div, {
                size: [height, height],
            })
            break

        case 'nbx':
        case 'floatatom':
            nexusElem = new Nexus.Number(div, {
                value: node.type === 'nbx' ? node.args[3] : 0,
                size: [width, height],
            })
            break

        case 'tgl':
            nexusElem = new Nexus.Toggle(div, {
                state: !!node.args[2],
                size: [width, height],
            })
            break

        default:
            throw new Error(`Not supported ${node.type}`)
    }

    let messageBuilder
    if (node.type === 'bng' || node.type === 'tgl') {
        messageBuilder = () => ['bang']
    } else {
        messageBuilder = (v) => [v]
    }
    nexusElem.on('change', (v) => {
        STATE.webpdNode.port.postMessage({
            type: 'inletCaller',
            payload: {
                nodeId: buildGraphNodeId(patch.id, node.id),
                portletId: PORTLET_ID,
                message: messageBuilder(v),
            },
        })
    })
    return nexusElem
}

export const generateColorScheme = (STATE) => {
    const colors = []
    const colorCount = 10
    const colorSchemeSelector = STATE.pdJson.patches[0].connections.length % 2

    switch (colorSchemeSelector) {
        case 0:
            for (let i = 0; i < colorCount; i++) {
                const r = 0 //+ (colorCount - i) * 100 / colorCount
                const g = 180 + (colorCount - i) * (240 - 180) / colorCount
                const b = 100 + i * 150 / colorCount
                colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
            }
            break
        case 1:
            for (let i = 0; i < colorCount; i++) {
                const r = 160 + i * 95 / colorCount
                const b = 80 + (colorCount - i) * 100 / colorCount
                const g = 0// + (colorCount - i) * 100 / colorCount
                colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
            }
            break

    
    }

    return {
        counter: 0,
        next () {
            return colors[this.counter++ % colors.length]
        }
    }
}