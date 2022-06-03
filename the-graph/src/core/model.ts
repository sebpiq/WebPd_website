import * as fbpGraph from 'fbp-graph'
import NODE_VIEW_BUILDERS from './node-view-builders'
import { PortletView } from './types'
import { Point } from '../store/ui'

export interface UiNodeMetadata {
    x: number
    y: number
    label: string
    sublabel: string
    icon: string
    pdNode: PdJson.Node
}

export interface UiEdgeMetadata {
    pdConnection: PdJson.Connection
}

export const runGraphChangedCleaning = (uiGraph: fbpGraph.Graph, engineSettings: PdEngine.Settings) => {
    uiGraph.edges.forEach((edge) => {
        // If edge metadata doesn't exist, we crate it first
        if (!edge.metadata || !edge.metadata.pdConnection) {
            const sourceNode = (uiGraph.getNode(edge.from.node).metadata as UiNodeMetadata).pdNode
            const sinkNode = (uiGraph.getNode(edge.to.node).metadata as UiNodeMetadata).pdNode
            const sourceNodeViewBuilder = NODE_VIEW_BUILDERS[sourceNode.type]
            const sinkNodeViewBuilder = NODE_VIEW_BUILDERS[sinkNode.type]
            const { outlets: outletViews } = sourceNodeViewBuilder.build(sourceNode.args, engineSettings)
            const { inlets: inletViews } = sinkNodeViewBuilder.build(sinkNode.args, engineSettings)
            const uiEdgeMetadata: UiEdgeMetadata = {
                pdConnection: {
                    source: {nodeId: sourceNode.id, portletId: pdPortletId(edge.from.port, outletViews) },
                    sink: {nodeId: sinkNode.id, portletId: pdPortletId(edge.to.port, inletViews) },
                }
            }
            edge.metadata = uiEdgeMetadata
        }
    })
}

export const addGraphNode = (
    uiGraph: fbpGraph.Graph, 
    nodeId: PdJson.ObjectLocalId,
    nodeType: PdSharedTypes.NodeType, 
    nodeArgs: PdJson.ObjectArgs,
    position: Point, 
    engineSettings: PdEngine.Settings
) => {
    const uiNodeMetadata: UiNodeMetadata = {
        x: position.x,
        y: position.y,
        label: nodeType,
        icon: 'chevron-right',
        // We put at least a space otherwise ThGraph will put a default sublabel
        sublabel: nodeSublabel(nodeArgs),
        pdNode: {
            id: nodeId,
            type: nodeType,
            args: nodeArgs,
        },
    }
    uiGraph.addNode(nodeId, uiComponentName(nodeType, nodeArgs, engineSettings), uiNodeMetadata)
}

export const editGraphNode = (
    uiGraph: fbpGraph.Graph, 
    nodeId: PdJson.ObjectLocalId, 
    nodeArgs: PdJson.ObjectArgs
) => {
    const node = uiGraph.getNode(nodeId)
    const uiNodeMetadata = node.metadata as UiNodeMetadata
    const pdNode: PdJson.Node = {
        ...uiNodeMetadata.pdNode, 
        args: nodeArgs
    }
    uiGraph.setNodeMetadata(node.id, {
        ...node.metadata, 
        sublabel: nodeSublabel(pdNode.args),
        pdNode
    } as UiNodeMetadata)
}

export const nodeSublabel = (nodeArgs: PdJson.ObjectArgs) => 
    nodeArgs.map(v => v.toString()).join(' ') || ' '

// Pd nodes can have for a same node type variable inlet / outlet number. 
// This is the case, for example, of trigger.
// The-graph takes only a static definition of inports / outports for one component.
export const uiComponentName = (
    nodeType: PdSharedTypes.NodeType, 
    nodeArgs: PdJson.ObjectArgs, 
    engineSettings: PdEngine.Settings
) => {
    const nodeViewBuilder = NODE_VIEW_BUILDERS[nodeType]
    const { inlets, outlets } = nodeViewBuilder.build(nodeArgs, engineSettings)
    return `${nodeType}:${inlets.length}:${outlets.length}`
}

export const uiPortletId = (portletView: PortletView) => 
    portletView.name

export const pdPortletId = (uiPortletId: string, portletViews: Array<PortletView>): PdJson.PortletId => {
    let found: PdJson.PortletId = null
    for (let i = 0 ; i < portletViews.length ; i++) {
        const portletView = portletViews[i]
        if (portletView.name === uiPortletId) {
            found = i
            break
        }
    }
    if (found === null) {
        throw new Error(`unknown portlet "${uiPortletId}"`)
    }
    return found
}

export const generateId = (patch: PdJson.Patch): PdJson.ObjectLocalId => {
    const ids = Object.keys(patch.nodes)
    let newId = (+new Date()).toString()
    while (ids.includes(newId)) {
        newId = (+new Date()).toString()
    }
    return newId
}