import parse from '@webpd/pd-parser'
import { CONTROL_TYPE, buildGraphNodeId } from '@webpd/pd-json'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    areRectanglesEqual,
} from './math-utils'

const EM_1_SIZE = 3

export const PORTLET_ID = '0'

export const loadPdJson = async (url) => {
    const response = await fetch(url)
    const pdFile = await response.text()
    return parse(pdFile)
}

export const getControlsFromPdJson = (pd, patch, viewport=null) => {
    if (viewport === null) {
        viewport = {
            topLeft: { x: -Infinity, y: -Infinity },
            bottomRight: { x: Infinity, y: Infinity },
        }
    }

    const controls = []
    Object.values(patch.nodes).forEach((node) => {
        if (node.type === 'pd') {
            const subpatch = pd.patches[node.patchId]
            if (!subpatch.layout.graphOnParent) {
                return
            }

            const toSubpatchCoords = makeTranslationTransform(
                { x: node.layout.x, y: node.layout.y },
                { x: subpatch.layout.viewportX, y: subpatch.layout.viewportY }
            )
            const parentViewport = {
                topLeft: toSubpatchCoords(viewport.topLeft),
                bottomRight: toSubpatchCoords(viewport.bottomRight),
            }
            const subpatchViewport = {
                topLeft: {
                    x: subpatch.layout.viewportX,
                    y: subpatch.layout.viewportY,
                },
                bottomRight: {
                    x:
                        subpatch.layout.viewportX +
                        subpatch.layout.viewportWidth,
                    y:
                        subpatch.layout.viewportY +
                        subpatch.layout.viewportHeight,
                },
            }
            const visibleSubpatchViewport = computeRectanglesIntersection(
                parentViewport,
                subpatchViewport
            )

            if (visibleSubpatchViewport === null) {
                return
            }

            controls.push({
                type: 'container',
                controls: getControlsFromPdJson(
                    pd,
                    subpatch,
                    visibleSubpatchViewport
                ),
                boundingBox: {
                    topLeft: { x: node.layout.x, y: node.layout.y },
                    bottomRight: {
                        x:
                            node.layout.x +
                            visibleSubpatchViewport.bottomRight.x -
                            visibleSubpatchViewport.topLeft.x,
                        y:
                            node.layout.y +
                            visibleSubpatchViewport.bottomRight.y -
                            visibleSubpatchViewport.topLeft.y,
                    },
                },
            })

        } else if (node.type in CONTROL_TYPE) {
            const nodeBoundingBox = _getPdNodeBoundingBox(node)
            const intersectionWithViewport = computeRectanglesIntersection(
                viewport,
                nodeBoundingBox
            )
            // We only take nodes that are entirely inside viewport
            // Therefore, we expect intersection of the node's bounding box
            // with viewport to be itself.
            if (
                intersectionWithViewport === null ||
                !areRectanglesEqual(nodeBoundingBox, intersectionWithViewport)
            ) {
                return
            }

            const graphNodeId = buildGraphNodeId(patch.id, node.id)
            controls.push({
                graphNodeId,
                type: 'control',
                pdNode: node,
                boundingBox: nodeBoundingBox,
            })
        }
    })
    return controls
}

const _getPdNodeBoundingBox = (node) => {
    let width = node.layout.width
    let height = node.layout.height
    switch (node.type) {
        case 'floatatom':
        case 'symbolatom':
            height = EM_1_SIZE * 5
            width = width * 5
            break
        case 'bng':
        case 'tgl':
            width = node.layout.size
            height = node.layout.size
            break
        case 'nbx':
            width = node.layout.widthDigits * EM_1_SIZE * 2
            break
        case 'vradio':
            width = node.layout.size 
            height = node.layout.size * node.args[0]
            break
        case 'hradio':
            width = node.layout.size * node.args[0]
            height = node.layout.size
            break

    }
    return {
        topLeft: {
            x: node.layout.x,
            y: node.layout.y,
        },
        bottomRight: {
            x: node.layout.x + width,
            y: node.layout.y + height,
        },
    }
}
