import {
    addPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
} from './math-utils'

export const PADDING = 0.5

export const createViews = (STATE, controls = null) => {
    if (controls === null) {
        controls = STATE.controls
    }

    const controlsViews = controls.map((control) => {
        if (control.type === 'container') {
            const nestedViews = createViews(STATE, control.children)
            return _buildContainerView(control, nestedViews)
        
        } else if (control.type === 'control') {
            return _buildControlView(control)
        }
    })

    const packer = new GrowingPacker()
    const blocks = controlsViews.map((c, i) => ({
        nodeLayout: c.control.node.layout,
        w: c.dimensions.x,
        h: c.dimensions.y,
        i,
    }))
    blocks.sort((a, b) => b.nodeLayout.x - a.nodeLayout.x)
    packer.fit(blocks)

    blocks.forEach((block) => {
        const controlView = controlsViews[block.i]
        controlView.position = { x: block.fit.x, y: block.fit.y }
    })
    return controlsViews
}

const _buildContainerView = (control, children) => ({
    type: 'container',
    label: control.node.args[0] || null,
    control,
    dimensions: addPoints({x: PADDING * 2, y: PADDING * 2}, computeRectangleDimensions(
        computePointsBoundingBox([
            ...children.map((c) => c.position), 
            ...children.map((c) => addPoints(c.position, c.dimensions))
        ])
    )),
    children,
    position: null,
})

const _buildControlView = (control) => ({
    type: 'control',
    label: control.node.layout.label.length ? control.node.layout.label: null,
    control,
    dimensions: _getDimensionsGrid(control.node.type, control.node.args),
    position: null,
})

const _getDimensionsGrid = (nodeType, nodeArgs) => {
    switch (nodeType) {
        case 'floatatom':
        case 'symbolatom':
            return { x: 2, y: 1 }
        case 'bng':
        case 'tgl':
            return { x: 1, y: 1 }
        case 'nbx':
            return { x: 2, y: 1 }
        case 'vradio':
            return { x: 1, y: nodeArgs[0] }
        case 'hradio':
            return { x: nodeArgs[0], y: 1 }
        case 'vsl':
            return { x: 1, y: 4 }
        case 'hsl':
            return { x: 4, y: 1 }
        default:
            throw new Error(`unsupported type ${nodeType}`)
    }
}