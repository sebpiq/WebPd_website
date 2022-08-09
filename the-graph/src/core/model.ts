import * as fbpGraph from 'fbp-graph'
import NODE_VIEW_BUILDERS from './node-view-builders'
import { GraphNode } from 'fbp-graph/src/Types'
import { Point, Settings } from './types'

type PortletLookupMap = { [portletGraphName: string]: PdJson.PortletId }

export interface NodeMetadata {
    x: number
    y: number
    label: string
    sublabel: string
    icon: string
    pdNode: PdJson.Node
    pdPortletLookup: {
        outlets: PortletLookupMap
        inlets: PortletLookupMap
    }
}

export interface GraphNodeWithMetadata extends GraphNode {
    id: PdJson.ObjectLocalId
    metadata: NodeMetadata
}

export const getGraphNode = (
    graph: fbpGraph.Graph,
    nodeId: PdJson.ObjectLocalId
): GraphNodeWithMetadata => {
    const node = graph.getNode(nodeId)
    if (!hasNodeMetadata(node)) {
        throw new Error(`Node "${nodeId}" doesn't have metadata`)
    }
    return node
}

export const addGraphNode = (
    graph: fbpGraph.Graph,
    nodeId: PdJson.ObjectLocalId,
    nodeType: PdSharedTypes.NodeType,
    nodeArgs: PdJson.ObjectArgs,
    position: Point,
    engineSettings: Settings
) => {
    // Building the lookup map to find pd portlet ids from graph portlet name
    const nodeViewBuilder = NODE_VIEW_BUILDERS[nodeType]
    const { outlets: outletViews, inlets: inletViews } = nodeViewBuilder.build(
        nodeArgs,
        engineSettings
    )
    const outletsLookup: PortletLookupMap = {}
    const inletsLookup: PortletLookupMap = {}
    outletViews.forEach((outletView, portletId) => {
        outletsLookup[outletView.name] = portletId
    })
    inletViews.forEach((inletView, portletId) => {
        inletsLookup[inletView.name] = portletId
    })

    const nodeMetadata: NodeMetadata = {
        x: position.x,
        y: position.y,
        label: nodeType,
        icon: 'chevron-right',
        // We put at least a space otherwise ThGraph will put a default sublabel
        sublabel: generateSublabel(nodeArgs),
        pdNode: {
            id: nodeId,
            type: nodeType,
            args: nodeArgs,
        },
        pdPortletLookup: {
            outlets: outletsLookup,
            inlets: inletsLookup,
        },
    }
    graph.addNode(
        nodeId,
        generateComponentName(nodeType, nodeArgs, engineSettings),
        nodeMetadata
    )
}

// TODO : handle case when editing node args changes the node's in/outlets
export const editGraphNode = (
    graph: fbpGraph.Graph,
    nodeId: PdJson.ObjectLocalId,
    nodeArgs: PdJson.ObjectArgs
) => {
    const node = graph.getNode(nodeId)
    if (!hasNodeMetadata(node)) {
        throw new Error(`Node "${nodeId}" doesn't have metadata`)
    }
    const pdNode: PdJson.Node = {
        ...node.metadata.pdNode,
        args: nodeArgs,
    }
    graph.setNodeMetadata(node.id, {
        ...node.metadata,
        sublabel: generateSublabel(pdNode.args),
        pdNode,
    } as NodeMetadata)
}

export const generateSublabel = (nodeArgs: PdJson.ObjectArgs) =>
    nodeArgs.map((v) => v.toString()).join(' ') || ' '

// Pd nodes can have for a same node type variable inlet / outlet number.
// This is the case, for example, of trigger.
// The-graph takes only a static definition of inports / outports for one component.
export const generateComponentName = (
    nodeType: PdSharedTypes.NodeType,
    nodeArgs: PdJson.ObjectArgs,
    engineSettings: Settings
) => {
    const nodeViewBuilder = NODE_VIEW_BUILDERS[nodeType]
    const { inlets, outlets } = nodeViewBuilder.build(nodeArgs, engineSettings)
    return `${nodeType}:${inlets.length}:${outlets.length}`
}

export const generateId = (patch: PdJson.Patch): PdJson.ObjectLocalId => {
    const ids = Object.keys(patch.nodes)
    let newId = (+new Date()).toString()
    while (ids.includes(newId)) {
        newId = (+new Date()).toString()
    }
    return newId
}

const hasNodeMetadata = (node: GraphNode): node is GraphNodeWithMetadata => {
    return !!node.metadata && node.metadata.pdNode
}
