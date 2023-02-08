import { PORTLET_ID } from './pd-json'

const SCALE_SIZE = { x: 2, y: 3 }
const SCALE_POSITION = { x: 2, y: 4 }

export const renderControlsGui = (STATE, containerDiv, controls = null) => {
    const { webpdNode } = STATE
    if (controls === null) {
        controls = STATE.controls
    }

    controls.forEach((control) => {
        if (control.type === 'container') {
            if (control.controls.length === 0) {
                return
            }
            renderControlsGui(
                STATE,
                _createControlsContainerDiv(containerDiv, control),
                control.controls
            )

        } else if (control.type === 'control') {
            const controlDiv = _createControlDiv(containerDiv, control)
            const node = control.pdNode
            const width = control.boundingBox.bottomRight.x - control.boundingBox.topLeft.x
            const height = control.boundingBox.bottomRight.y - control.boundingBox.topLeft.y
            let messageBuilder = (v) => [v]

            let controlView = null
            switch (node.type) {
                case 'hsl':
                // TODO : case 'vsl':
                    controlView = Nexus.Add.Slider(controlDiv, {
                        min: node.args[0],
                        max: node.args[1],
                        value: node.args[3],
                        size: [
                            width * SCALE_SIZE.x,
                            height * SCALE_SIZE.y,
                        ],
                    })
                    break

                case 'hradio':
                    // TODO : case 'vradio':
                    controlView = new Nexus.RadioButton(controlDiv, {
                        numberOfButtons: node.args[0],
                        active: node.args[2],
                        size: [
                            width * SCALE_SIZE.x,
                            height * SCALE_SIZE.y,
                        ],
                    })
                    break

                case 'bng':
                    // TODO : case 'vradio':
                    controlView = new Nexus.Button(controlDiv, {
                        size: [
                            width * SCALE_SIZE.x,
                            height * SCALE_SIZE.y,
                        ],
                    })
                    messageBuilder = () => ['bang']
                    break

                case 'nbx':
                case 'floatatom':
                    controlView = new Nexus.Number(controlDiv, {
                        value: node.type === 'nbx' ? node.args[3]: 0,
                        size: [
                            width * SCALE_SIZE.x,
                            height * SCALE_SIZE.y,
                        ],
                    })
                    break

                case 'tgl':
                    controlView = new Nexus.Toggle(controlDiv, {
                        state: !!node.args[2],
                        size: [
                            width * SCALE_SIZE.x,
                            height * SCALE_SIZE.y,
                        ],
                    })
                    messageBuilder = () => ['bang']
                    break

            }
            if (controlView) {
                controlView.on('change', (v) => {
                    webpdNode.port.postMessage({
                        type: 'inletCaller',
                        payload: {
                            nodeId: control.graphNodeId,
                            portletId: PORTLET_ID,
                            message: messageBuilder(v),
                        },
                    })
                })
            }
        }
    })
}

export const adjustRootContainer = (rootContainer) => {
    const minX = Math.min(
        ...Array.from(rootContainer.childNodes).map((elem) => {
            const x = parseInt(elem.style.left)
            if (isNaN(x)) {
                throw new Error(`invalid style for elem`, elem)
            }
            return x
        })
    )
    rootContainer.childNodes.forEach((elem) => {
        elem.style.transform = `translateX(${minX * -1}px)`
    })
}

const _createControlDiv = (parent, control) => {
    const node = control.pdNode
    const graphNodeId = control.graphNodeId
    const div = document.createElement('div')
    div.classList.add('control')
    div.style.left = `${node.layout.x * SCALE_POSITION.x}px`
    div.style.top = `${node.layout.y * SCALE_POSITION.y}px`
    div.id = `control-${graphNodeId}`
    if (node.layout.label) {
        const label = document.createElement('div')
        label.classList.add('label')
        label.innerHTML = node.layout.label
        div.appendChild(label)
    }

    parent.appendChild(div)
    return div
}

const _createControlsContainerDiv = (parent, control) => {
    const div = document.createElement('div')
    div.classList.add('controls-container')
    div.style.left = `${control.boundingBox.topLeft.x * SCALE_POSITION.x}px`
    div.style.top = `${control.boundingBox.topLeft.y * SCALE_POSITION.y}px`
    parent.appendChild(div)
    return div
}
