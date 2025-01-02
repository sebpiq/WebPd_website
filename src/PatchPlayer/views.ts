import { WebPdMetadata, PdJson } from 'webpd'
import {
    sumPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
    scalePoint,
} from './math-utils'
import {
    BaseView,
    CommentView,
    ContainerView,
    ControlOrContainerView,
    ControlView,
    Point,
    RootView,
    ViewsIndex,
} from './types'

export const CONTAINER_EXTRA_SPACE = { x: 7, y: 12 }
const ATOM_HEIGHT_PD_PX = 15
const MSG_HEIGHT_PD_PX = 15
const DIGIT_WIDTH_PD_PX = 7

export const createViews = (
    webPdMetadata: WebPdMetadata
): Array<RootView> => {
    const controlOrContainerViews = _createViewsRecurs(
        webPdMetadata.pdGui,
        webPdMetadata
    )
    const containerViews = _wrapSingleControlViews(controlOrContainerViews)
    // Move all controls and comments so that the top-left-most *control*
    // matches with the position (0, 0).
    const offset = _computeBoundingBoxOffset(containerViews)
    return _moveByOffset(
        [...containerViews, ..._createCommentsViews(webPdMetadata)],
        offset
    )
}

export const _createViewsRecurs = (
    pdGui: WebPdMetadata['pdGui'],
    webPdMetadata: WebPdMetadata
): Array<ControlOrContainerView> =>
    pdGui
        .filter((pdGuiNode) => pdGuiNode.nodeClass !== 'text')
        .map((pdGuiNode) => {
            // TODO : fix `any` here
            const pdNode: PdJson.Node = (webPdMetadata.pdNodes as any)[
                pdGuiNode.patchId
            ][pdGuiNode.pdNodeId]
            if (!pdNode) {
                console.log('CUSTOM METADATA', webPdMetadata)
                throw new Error(
                    `no pd node ${pdGuiNode.pdNodeId} for patch ${pdGuiNode.patchId}`
                )
            }

            switch (pdGuiNode.nodeClass) {
                case 'subpatch':
                    if (pdNode.nodeClass !== 'subpatch') {
                        throw new Error(
                            `unexpected pdNode class ${pdNode.nodeClass}`
                        )
                    }
                    const nestedViews = _moveToOrigin(
                        _createViewsRecurs(
                            pdGuiNode.children,
                            webPdMetadata
                        )
                    )

                    const containerView: ContainerView = {
                        type: 'container',
                        label:
                            typeof pdNode.args[0] === 'string'
                                ? pdNode.args[0]
                                : null,
                        dimensions: sumPoints(
                            CONTAINER_EXTRA_SPACE,
                            computeRectangleDimensions(
                                computePointsBoundingBox([
                                    ...nestedViews.map((c) => c.position),
                                    ...nestedViews.map((c) =>
                                        sumPoints(c.position, c.dimensions)
                                    ),
                                ])
                            )
                        ),
                        children: nestedViews,
                        position: {
                            x: _quantizeSpace(pdNode.layout.x),
                            y: _quantizeSpace(pdNode.layout.y),
                        },
                    }
                    return containerView

                case 'control':
                    if (pdNode.nodeClass !== 'control') {
                        throw new Error(
                            `unexpected pdNode class ${pdNode.nodeClass}`
                        )
                    }

                    const controlView: ControlView = {
                        type: 'control',
                        label: pdNode.layout.label || '',
                        pdNode,
                        nodeId: pdGuiNode.nodeId,
                        nexusElem: null,
                        dimensions: _getDimensionsGrid(pdNode),
                        position: {
                            x: _quantizeSpace(pdNode.layout.x),
                            y: _quantizeSpace(pdNode.layout.y),
                        },
                    }
                    return controlView

                default:
                    throw new Error(
                        `unexpected control type ${(pdGuiNode as any).type}`
                    )
            }
        })

export const buildViewsIndex = (views: Array<RootView>): ViewsIndex => {
    const index: ViewsIndex = {}
    _buildViewsIndexRecurs(
        views.filter((view): view is ContainerView => view.type !== 'comment'),
        index
    )
    return index
}

export const _buildViewsIndexRecurs = (
    views: Array<ControlOrContainerView>,
    index: ViewsIndex
) => {
    views.forEach((view) => {
        if (view.type === 'control') {
            index[view.nodeId] = view
        } else {
            _buildViewsIndexRecurs(view.children, index)
        }
    })
}

const _wrapSingleControlViews = (
    views: Array<ControlOrContainerView>
): Array<ContainerView> =>
    views.map((view) => {
        switch (view.type) {
            case 'container':
                return view
            case 'control':
                return {
                    type: 'container',
                    label: null,
                    children: [
                        {
                            ...view,
                            position: { x: 0, y: 0 },
                        },
                    ],
                    dimensions: sumPoints(
                        CONTAINER_EXTRA_SPACE,
                        view.dimensions
                    ),
                    position: view.position,
                }
            default:
                throw new Error(`unexpected view type ${(view as any).type}`)
        }
    })

const _createCommentsViews = (
    webPdMetadata: WebPdMetadata
): Array<CommentView> =>
    webPdMetadata.pdGui
        .filter((pdGuiNode) => pdGuiNode.nodeClass === 'text')
        .map((pdGuiNode) => {
            const pdNode = _assertPdNode(
                webPdMetadata,
                pdGuiNode.patchId,
                pdGuiNode.pdNodeId
            )
            return {
                type: 'comment',
                text: pdNode.args[0]?.toString() || '',
                position: {
                    x: _quantizeSpace(pdNode.layout.x),
                    y: _quantizeSpace(pdNode.layout.y),
                },
            }
        })

/**
 * Compute the offset of the controls' bouding box, i.e. offset to the top-left-most control.
 */
const _computeBoundingBoxOffset = (views: Array<ControlOrContainerView>) => {
    const nestedViewsBoundingBox = computePointsBoundingBox([
        ...views.map((v) => v.position),
        ...views.map((v) => sumPoints(v.position, v.dimensions)),
    ])
    return scalePoint(nestedViewsBoundingBox.topLeft, -1)
}

const _moveByOffset = <View extends BaseView>(
    views: Array<View>,
    offset: Point
): Array<View> =>
    views.map((v) => ({
        ...v,
        position: sumPoints(v.position, offset),
    }))

const _moveToOrigin = (views: Array<ControlOrContainerView>) =>
    // Apply offset to all the points so that the top-left-most control
    // matches with the position (0, 0).
    _moveByOffset(views, _computeBoundingBoxOffset(views))

const _getDimensionsGrid = (pdNode: PdJson.Node) => {
    if (pdNode.nodeClass !== 'control') {
        throw new Error(`Can only get dimension for control node`)
    }

    switch (pdNode.type) {
        case 'floatatom':
        case 'symbolatom':
            return {
                x: _quantizeSpace(
                    (pdNode.layout.widthInChars || 3) * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(ATOM_HEIGHT_PD_PX),
            }
        case 'bng':
        case 'tgl':
            return {
                x: _quantizeSpace(pdNode.layout.size),
                y: _quantizeSpace(pdNode.layout.size),
            }
        case 'nbx':
            return {
                x: _quantizeSpace(
                    (pdNode.layout.widthInChars || 3) * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(pdNode.layout.height),
            }
        case 'vradio':
            return {
                x: _quantizeSpace(pdNode.layout.size),
                y: _quantizeSpace(
                    _assertNumber(pdNode.args[0]) *
                        _assertNumber(pdNode.layout.size)
                ),
            }
        case 'hradio':
            return {
                x: _quantizeSpace(
                    _assertNumber(pdNode.args[0]) *
                        _assertNumber(pdNode.layout.size)
                ),
                y: _quantizeSpace(pdNode.layout.size),
            }
        case 'vsl':
        case 'hsl':
            return {
                x: _quantizeSpace(pdNode.layout.width),
                y: _quantizeSpace(pdNode.layout.height),
            }
        case 'msg':
            return {
                x: _quantizeSpace(
                    pdNode.args.join(' ').length * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(MSG_HEIGHT_PD_PX),
            }
        case 'cnv':
            return {
                x: 0,
                y: 0,
            }
        default:
            throw new Error(`unsupported type ${pdNode.type}`)
    }
}

const _assertNumber = (val: PdJson.NodeArg) => {
    if (typeof val !== 'number') {
        throw new Error(`Expected ${val} to be a number`)
    }
    return val
}

const _quantizeSpace = (val?: number) => Math.round(_assertNumber(val) / 1) * 1

const _assertPdNode = (
    webPdMetadata: WebPdMetadata,
    patchId: PdJson.GlobalId,
    pdNodeId: PdJson.LocalId
) => {
    // TODO : fix `any` here
    const pdNodes: { [id: string]: PdJson.Node } = (
        webPdMetadata.pdNodes as any
    )[patchId]
    if (!pdNodes) {
        console.log('CUSTOM METADATA', webPdMetadata)
        throw new Error(`no pd patch found fo ${patchId}`)
    }
    const pdNode = pdNodes[pdNodeId]
    if (!pdNode) {
        console.log('CUSTOM METADATA', webPdMetadata)
        throw new Error(
            `no pd node found for patch ${patchId} node ${pdNodeId}`
        )
    }
    return pdNode
}
