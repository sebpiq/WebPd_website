import { PdJson } from 'webpd'
import {
    sumPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
    Point,
    scalePoint,
} from './math-utils'
import { assertNonNullable } from './misc-utils'
import {
    CommentModel,
    ContainerModel,
    ControlModel,
    ControlTreeModel,
} from './models'

export const CONTAINER_EXTRA_SPACE = { x: 7, y: 12 }
const ATOM_HEIGHT_PD_PX = 15
const MSG_HEIGHT_PD_PX = 15
const DIGIT_WIDTH_PD_PX = 7

export interface ControlView {
    type: 'control'
    label: string | null
    control: ControlModel
    dimensions: Point
    position: Point
}

export interface ContainerView {
    type: 'container'
    label: string | null
    control: ContainerModel
    dimensions: Point
    children: Array<ControlTreeView>
    position: Point
}

export type ControlTreeView = ControlView | ContainerView

export interface CommentView {
    type: 'comment'
    text: string
    position: Point
}

export const createViews = (
    controls: Array<ControlTreeModel>,
    comments: Array<CommentModel>
): {
    controlsViews: Array<ControlTreeView>
    commentsViews: Array<CommentView>
} => {
    const [controlsViews, offset] = _moveToOrigin(
        _createControlsViewsRecurs(controls)
    )
    return {
        controlsViews,
        commentsViews: _createCommentsViews(comments).map((v) => ({
            ...v,
            position: sumPoints(v.position, offset),
        })),
    }
}

export const _createControlsViewsRecurs = (
    controls: Array<ControlTreeModel>
): Array<ControlTreeView> => {
    const controlsViews: Array<ControlTreeView> = controls.map((control) => {
        switch (control.type) {
            case 'container':
                const [nestedViews] = _moveToOrigin(
                    _createControlsViewsRecurs(control.children)
                )

                const containerView: ContainerView = {
                    type: 'container',
                    label:
                        typeof control.node.args[0] === 'string'
                            ? control.node.args[0]
                            : null,
                    control,
                    dimensions: sumPoints(
                        CONTAINER_EXTRA_SPACE,
                        computeRectangleDimensions(
                            computePointsBoundingBox([
                                ...nestedViews.map((c) => c.position!),
                                ...nestedViews.map((c) =>
                                    sumPoints(c.position!, c.dimensions)
                                ),
                            ])
                        )
                    ),
                    children: nestedViews,
                    position: {
                        x: _quantizeSpace(_getLayout(control.node).x),
                        y: _quantizeSpace(_getLayout(control.node).y),
                    },
                }
                return containerView

            case 'control':
                const controlView: ControlView = {
                    type: 'control',
                    label: _getNodeLabel(control.node),
                    control,
                    dimensions: _getDimensionsGrid(control.node),
                    position: {
                        x: _quantizeSpace(_getLayout(control.node).x),
                        y: _quantizeSpace(_getLayout(control.node).y),
                    },
                }
                return controlView
        }
    })

    return controlsViews
}

const _createCommentsViews = (
    comments: Array<CommentModel>
): Array<CommentView> =>
    comments.map((comment) => ({
        type: 'comment',
        text: comment.text,
        position: {
            x: _quantizeSpace(_getLayout(comment.node).x),
            y: _quantizeSpace(_getLayout(comment.node).y),
        },
    }))

const _moveToOrigin = (
    controlViews: Array<ControlTreeView>
): [Array<ControlTreeView>, Point] => {
    const nestedViewsBoundingBox = computePointsBoundingBox([
        ...controlViews.map((v) => v.position!),
        ...controlViews.map((v) => sumPoints(v.position!, v.dimensions)),
    ])

    const offset = scalePoint(nestedViewsBoundingBox.topLeft, -1)

    // Apply offset to all the points so that the top-left-most control
    // matches with the position (0, 0).
    return [
        controlViews.map((v) => ({
            ...v,
            position: sumPoints(v.position, offset),
        })),
        offset,
    ]
}

const _getDimensionsGrid = (node: PdJson.Node) => {
    if (node.nodeClass !== 'control') {
        throw new Error(`Can only get dimension for control node`)
    }

    switch (node.type) {
        case 'floatatom':
        case 'symbolatom':
            return {
                x: _quantizeSpace(
                    (_getLayout(node).widthInChars || 3) * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(ATOM_HEIGHT_PD_PX),
            }
        case 'bng':
        case 'tgl':
            return {
                x: _quantizeSpace(_getLayout(node).size),
                y: _quantizeSpace(_getLayout(node).size),
            }
        case 'nbx':
            return {
                x: _quantizeSpace(
                    (_getLayout(node).widthInChars || 3) * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(_getLayout(node).height),
            }
        case 'vradio':
            return {
                x: _quantizeSpace(_getLayout(node).size),
                y: _quantizeSpace(
                    _assertNumber(node.args[0]) *
                        _assertNumber(_getLayout(node).size)
                ),
            }
        case 'hradio':
            return {
                x: _quantizeSpace(
                    _assertNumber(node.args[0]) *
                        _assertNumber(_getLayout(node).size)
                ),
                y: _quantizeSpace(_getLayout(node).size),
            }
        case 'vsl':
        case 'hsl':
            return {
                x: _quantizeSpace(_getLayout(node).width),
                y: _quantizeSpace(_getLayout(node).height),
            }
        case 'msg':
            return {
                x: _quantizeSpace(
                    node.args.join(' ').length * DIGIT_WIDTH_PD_PX
                ),
                y: _quantizeSpace(MSG_HEIGHT_PD_PX),
            }
        case 'cnv':
            return {
                x: 0, y: 0
            }
        default:
            throw new Error(`unsupported type ${node.type}`)
    }
}

const _getNodeLabel = (node: PdJson.Node): string | null => {
    const layout = _getLayout(node)
    const label = (layout as any).label as string
    return label.length ? label : null
}

const _assertNumber = (val: PdJson.NodeArg) => {
    if (typeof val !== 'number') {
        throw new Error(`Expected ${val} to be a number`)
    }
    return val
}

const _quantizeSpace = (val?: number) => Math.round(_assertNumber(val) / 1) * 1

const _getLayout = <N extends PdJson.Node>(node: N): NonNullable<N['layout']> =>
    assertNonNullable(node.layout, 'expected node to have a layout')
