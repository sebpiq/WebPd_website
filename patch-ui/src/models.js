import parse from '@webpd/pd-parser'
import { CONTROL_TYPE } from '@webpd/pd-json'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    isPointInsideRectangle,
    addPoints,
} from './math-utils'

export const PORTLET_ID = '0'

export const loadPdJson = async (url) => {
    const response = await fetch(url)
    const pdFile = await response.text()
    return parse(pdFile)
}

export const getPdNode = (pdJson, [patchId, nodeId]) =>
    pdJson.patches[patchId].nodes[nodeId]

export const createModels = (STATE) => 
    // We make sure all controls are inside a container at top level for easier layout
    _createModelsRecursive(STATE, STATE.pdJson.patches['0'])
    .map((control) =>
            control.type === 'control'
                ? _buildContainerModel(control.patch, control.node, [control])
                : control
        )

export const _createModelsRecursive = (STATE, patch, viewport = null) => {
    const { pdJson } = STATE
    if (viewport === null) {
        viewport = {
            topLeft: { x: -Infinity, y: -Infinity },
            bottomRight: { x: Infinity, y: Infinity },
        }
    }

    const controls = []
    Object.values(patch.nodes).forEach((node) => {
        if (node.type === 'pd') {
            const subpatch = pdJson.patches[node.patchId]
            if (!subpatch.layout.graphOnParent) {
                return
            }

            // 1. we convert all coordinates to the subpatch coords system
            const toSubpatchCoords = makeTranslationTransform(
                { x: node.layout.x, y: node.layout.y },
                { x: subpatch.layout.viewportX, y: subpatch.layout.viewportY }
            )
            const parentViewport = {
                topLeft: toSubpatchCoords(viewport.topLeft),
                bottomRight: toSubpatchCoords(viewport.bottomRight),
            }

            const topLeft = {
                x: subpatch.layout.viewportX,
                y: subpatch.layout.viewportY,
            }
            const subpatchViewport = {
                topLeft,
                bottomRight: addPoints(topLeft, {
                    x: subpatch.layout.viewportWidth,
                    y: subpatch.layout.viewportHeight,
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
                STATE,
                subpatch,
                visibleSubpatchViewport
            )

            controls.push(_buildContainerModel(patch, node, children))

            // 3. When we get ab actual control node, we see if it is inside the
            // visible viewport (which was previously transformed to local coords).
        } else if (node.type in CONTROL_TYPE) {
            if (
                !isPointInsideRectangle(
                    {
                        x: node.layout.x,
                        y: node.layout.y,
                    },
                    viewport
                )
            ) {
                return
            }
            controls.push(_buildControlModel(patch, node))
        }
    })
    return controls
}

const _buildContainerModel = (patch, node, children) => ({
    type: 'container',
    patch,
    node,
    children,
})

const _buildControlModel = (patch, node) => ({
    type: 'control',
    patch,
    node,
})
