import { CONTROL_TYPE, dspGraph, DspGraph } from 'webpd'
import { PdJson } from 'webpd'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    isPointInsideRectangle,
    sumPoints,
    Rectangle,
    round,
} from './math-utils'
import { sendMsgToWebPd } from './misc-utils'
import { PatchPlayer } from './PatchPlayer'

export const PORTLET_ID = '0'

export type ValueTransform = (v: number) => string | number

export interface ControlsValues {
    _values: { [nodeId: string]: string | number }
    _valueTransforms: { [nodeId: string]: ValueTransform }
}

export interface ControlModel {
    type: 'control'
    patch: PdJson.Patch
    node: PdJson.ControlNode
}

export interface ContainerModel {
    type: 'container'
    patch: PdJson.Patch
    node: PdJson.Node
    children: Array<ControlTreeModel>
}

export type ControlTreeModel = ControlModel | ContainerModel

export interface CommentModel {
    type: 'comment'
    patch: PdJson.Patch
    node: PdJson.Node
    text: string
}

export const getPdNode = (
    pdJson: PdJson.Pd,
    [patchId, nodeId]: [PdJson.GlobalId, PdJson.LocalId]
) => pdJson.patches[patchId].nodes[nodeId]

export const createModels = (
    controlsValues: ControlsValues,
    pdJson: PdJson.Pd
) => {
    const rootPatch = pdJson.patches['0']

    // We make sure all controls are inside a container at top level for easier layout
    const controlsModels = _createModelsRecursive(
        controlsValues,
        pdJson,
        rootPatch
    ).map((control) => {
        const controlContainer: ContainerModel = {
            type: 'container',
            patch: control.patch,
            node: control.node,
            children: [control],
        }
        return control.type === 'control' ? controlContainer : control
    })

    return {
        controls: controlsModels,
        comments: Object.values(rootPatch.nodes)
            .filter((node) => node.type === 'text')
            .map((node) => {
                const comment: CommentModel = {
                    type: 'comment',
                    patch: rootPatch,
                    node,
                    text: node.args[0]!.toString(),
                }
                return comment
            }),
    }
}

export const _createModelsRecursive = (
    controlsValues: ControlsValues,
    pdJson: PdJson.Pd,
    patch: PdJson.Patch,
    viewport: Rectangle | null = null
): Array<ControlModel | ContainerModel> => {
    if (viewport === null) {
        viewport = {
            topLeft: { x: -Infinity, y: -Infinity },
            bottomRight: { x: Infinity, y: Infinity },
        }
    }

    const controls: Array<ControlModel | ContainerModel> = []
    Object.values(patch.nodes).forEach((node) => {
        if (node.type === 'pd' && node.nodeClass === 'subpatch') {
            const subpatch = pdJson!.patches[node.patchId]
            const nodeLayout = _assertNodeLayout(node.layout)

            if (!subpatch.layout!.graphOnParent) {
                return
            }

            const subpatchLayout = _assertPatchLayout(subpatch.layout)

            // 1. we convert all coordinates to the subpatch coords system
            const toSubpatchCoords = makeTranslationTransform(
                { x: nodeLayout.x, y: nodeLayout.y },
                { x: subpatchLayout.viewportX, y: subpatchLayout.viewportY }
            )
            const parentViewport = {
                topLeft: toSubpatchCoords(viewport!.topLeft),
                bottomRight: toSubpatchCoords(viewport!.bottomRight),
            }

            const topLeft = {
                x: subpatchLayout.viewportX,
                y: subpatchLayout.viewportY,
            }
            const subpatchViewport = {
                topLeft,
                bottomRight: sumPoints(topLeft, {
                    x: subpatchLayout.viewportWidth,
                    y: subpatchLayout.viewportHeight,
                }),
            }

            // 2. we compute the visible intersection in the subpatch coords system
            // and call the function for the subpatch
            const visibleSubpatchViewport = computeRectanglesIntersection(
                parentViewport,
                subpatchViewport
            )

            if (visibleSubpatchViewport === null) {
                return
            }

            const children = _createModelsRecursive(
                controlsValues,
                pdJson,
                subpatch,
                visibleSubpatchViewport
            )

            const control: ContainerModel = {
                type: 'container',
                patch,
                node,
                children,
            }
            controls.push(control)

            // 3. When we get ab actual control node, we see if it is inside the
            // visible viewport (which was previously transformed to local coords).
        } else if (node.type in CONTROL_TYPE && node.nodeClass === 'control') {
            const nodeLayout = _assertNodeLayout(node.layout)
            if (
                !isPointInsideRectangle(
                    {
                        x: nodeLayout.x,
                        y: nodeLayout.y,
                    },
                    viewport!
                )
            ) {
                return
            }

            const control: ControlModel = {
                type: 'control',
                patch,
                node,
            }

            let valueTransform: ValueTransform = (v) => v
            if (node.type === 'bng' || node.type === 'msg') {
                valueTransform = () => 'bang'
            } else if (node.type === 'tgl') {
                valueTransform = (v) => +v
            }

            _registerControlValue(controlsValues, control, valueTransform)

            controls.push(control)
        }
    })
    return controls
}

export const setControlValue = (
    patchPlayer: PatchPlayer,
    control: ControlModel,
    rawValue: number
) => {
    const { node, patch } = control
    const nodeId = dspGraph.buildGraphNodeId(patch.id, node.id)
    const valueTransform = patchPlayer.controlsValues._valueTransforms[nodeId]
    if (!valueTransform) {
        throw new Error(`no value transform for ${nodeId}`)
    }
    _setControlValue(patchPlayer, nodeId, valueTransform(rawValue)!)
}

export const getControlValue = (patchPlayer: PatchPlayer, control: ControlModel) => {
    const { node, patch } = control
    const nodeId = dspGraph.buildGraphNodeId(patch.id, node.id)
    return patchPlayer.controlsValues._values[nodeId]
}

export const initializeControlValues = (patchPlayer: PatchPlayer) => {
    Object.entries(patchPlayer.controlsValues._values).forEach(
        ([nodeId, value]) => {
            _setControlValue(patchPlayer, nodeId, value)
        }
    )
}

const _registerControlValue = (
    controlsValues: ControlsValues,
    control: ControlModel,
    valueTransform: ValueTransform
) => {
    const { node, patch } = control
    const nodeId = dspGraph.buildGraphNodeId(patch.id, node.id)
    controlsValues._valueTransforms[nodeId] = valueTransform
}

const _setControlValue = (
    patchPlayer: PatchPlayer,
    nodeId: DspGraph.NodeId,
    value: string | number
) => {
    patchPlayer.controlsValues._values[nodeId] = value
    // TODO
    // const url = new URL(window.location)
    Object.entries(patchPlayer.controlsValues._values).forEach(
        ([nodeId, value]) => {
            const paramValue = typeof value === 'number' ? round(value) : value
            // TODO
            // url.searchParams.set(nodeId, JSON.stringify(paramValue))
        }
    )
    // TODO
    // window.history.replaceState({}, document.title, url)
    sendMsgToWebPd(patchPlayer, nodeId, [value])
}

const _assertNodeLayout = (layout: PdJson.Node['layout']) => {
    if (!layout) {
        throw new Error(`Missing node layout`)
    }
    const x = layout.x
    const y = layout.y
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error(`Missing node layout attributes`)
    }
    return {
        x,
        y,
    }
}

const _assertPatchLayout = (layout: PdJson.Patch['layout']) => {
    if (!layout) {
        throw new Error(`Missing patch layout`)
    }
    const viewportX = layout.viewportX
    const viewportY = layout.viewportY
    const viewportWidth = layout.viewportWidth
    const viewportHeight = layout.viewportHeight
    if (
        typeof viewportX !== 'number' ||
        typeof viewportY !== 'number' ||
        typeof viewportWidth !== 'number' ||
        typeof viewportHeight !== 'number'
    ) {
        debugger
        throw new Error(`Missing patch layout attributes`)
    }
    return {
        viewportX,
        viewportY,
        viewportWidth,
        viewportHeight,
    }
}
