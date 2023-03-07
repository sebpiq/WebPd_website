import { PdJson } from 'webpd'
import {
    sumPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
    Point,
    scalePoint,
} from './math-utils'
import { assertNonNullable } from './misc-utils'
import { ControlModel } from './models'

export const CONTAINER_EXTRA_SPACE = { x: 7, y: 12 }
const ATOM_HEIGHT_PD_PX = 15
const MSG_HEIGHT_PD_PX = 15
const DIGIT_WIDTH_PD_PX = 7

interface Control {
    type: 'control'
    label: string | null
    control: ControlModel
    dimensions: Point
    position: Point
}

interface ControlContainer {
    type: 'container'
    label: string | null
    control: ControlModel
    dimensions: Point
    children: Array<ControlView>
    position: Point
}

export type ControlView = Control | ControlContainer

export const createViews = (
    controls: Array<ControlModel>
): Array<ControlView> => {
    return _moveToOrigin(_createViewsRecurs(controls))
}

export const _createViewsRecurs = (
    controls: Array<ControlModel>
): Array<ControlView> => {
    const controlsViews: Array<ControlView> = controls.map((control) => {
        if (control.type === 'container') {
            const nestedViews = _moveToOrigin(
                _createViewsRecurs(control.children)
            )

            console.log(
                nestedViews
                    .slice(0, 5)
                    .map(
                        (v) =>
                            `${v.control.node.type}: ${v.dimensions.x},${v.dimensions.y}`
                    )
            )

            const view: ControlContainer = {
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
            return view
        } else {
            const view: Control = {
                type: 'control',
                label: _getNodeLabel(control.node),
                control,
                dimensions: _getDimensionsGrid(control.node),
                position: {
                    x: _quantizeSpace(_getLayout(control.node).x),
                    y: _quantizeSpace(_getLayout(control.node).y),
                },
            }
            return view
        }
    })

    return controlsViews
}

const _moveToOrigin = (
    controlViews: Array<ControlView>
): Array<ControlView> => {
    const nestedViewsBoundingBox = computePointsBoundingBox([
        ...controlViews.map((v) => v.position!),
        ...controlViews.map((v) => sumPoints(v.position!, v.dimensions)),
    ])

    // Apply offset to all the points so that the top-left-most control
    // matches with the position (0, 0).
    return controlViews.map((v) => ({
        ...v,
        position: sumPoints(
            v.position,
            scalePoint(nestedViewsBoundingBox.topLeft, -1)
        ),
    }))
}

const _getDimensionsGrid = (node: PdJson.Node) => {
    if (node.nodeClass !== 'control') {
        throw new Error(`Can only get dimension for control node`)
    }

    switch (node.type) {
        case 'floatatom':
        case 'symbolatom':
            console.log('ATOM', node.type, _getLayout(node))
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
