import * as fbpGraph from 'fbp-graph'
import NODE_VIEW_BUILDERS, { DEFAULT_ICON } from './node-view-builders'
import { Library } from './types'
import { addGraphNode, uiComponentName, UiEdgeMetadata, uiPortletId } from './model'

export const getPdJson = (uiGraph: fbpGraph.Graph): PdJson.Pd => {
    const patch: PdJson.Patch = {
        id: '0',
        args: [],
        inlets: [],
        outlets: [],
        nodes: {},
        connections: []
    }
    const pd: PdJson.Pd = { 
        patches: {
            '0': patch
        }, 
        arrays: {} 
    }

    uiGraph.nodes.forEach(node => {
        if (!node.metadata || !node.metadata.pdNode) {
            throw new Error(`Missing metadata.pdNode on node "${node.id}"`)
        }
        const pdNode: PdJson.Node = node.metadata.pdNode
        patch.nodes[pdNode.id] = pdNode
    })

    uiGraph.edges.forEach((edge) => {
        if (!edge.metadata || !edge.metadata.pdConnection) {
            throw new Error(`Missing metadata.pdConnection on edge "${edge.from.node} -> ${edge.to.node}"`)
        }
        patch.connections.push(edge.metadata.pdConnection)
    })

    return pd
}

export const loadPdJson = (pd: PdJson.Pd, engineSettings: PdEngine.Settings): fbpGraph.Graph => {
    const uiGraph = new fbpGraph.Graph('patch')
    const patches = Object.values(pd.patches)
    if (patches.length > 1) {
        throw new Error(`Pd file with multiple patches not supported`)
    }
    const patch = patches[0]

    Object.values(patch.nodes).forEach(pdNode => {
        // TODO : layout manage better
        const x = pdNode.layout.y * 5
        const y = pdNode.layout.x * 5
        addGraphNode(
            uiGraph, 
            pdNode.id, 
            pdNode.type,
            pdNode.args,
            {x, y}, 
            engineSettings
        )
    })

    Object.values(patch.connections).forEach(pdConnection => {
        const sourceNode = patch.nodes[pdConnection.source.nodeId]
        const sinkNode = patch.nodes[pdConnection.sink.nodeId]
        const sourceNodeViewBuilder = NODE_VIEW_BUILDERS[sourceNode.type]
        const sinkNodeViewBuilder = NODE_VIEW_BUILDERS[sinkNode.type]
        const { outlets: outletViews } = sourceNodeViewBuilder.build(sourceNode.args, engineSettings)
        const { inlets: inletViews } = sinkNodeViewBuilder.build(sinkNode.args, engineSettings)
        const { source, sink } = pdConnection
        const uiEdgeMetadata: UiEdgeMetadata = { pdConnection }
        uiGraph.addEdge(
            source.nodeId,
            uiPortletId(outletViews[source.portletId]),
            sink.nodeId,
            uiPortletId(inletViews[sink.portletId]),
            uiEdgeMetadata
        )
    })

    return uiGraph
}

export const generateLibrary = (pd: PdJson.Pd, engineSettings: PdEngine.Settings): Library => {
    const library: Library = {} 
    Object.values(pd.patches).forEach((patch) => {
        Object.values(patch.nodes).forEach(pdNode => {
            const nodeViewBuilder = NODE_VIEW_BUILDERS[pdNode.type]
            const componentName = uiComponentName(pdNode.type, pdNode.args, engineSettings)
            const { inlets, outlets } = nodeViewBuilder.build(pdNode.args, engineSettings)

            library[componentName] = {
                name: pdNode.type,
                description: 'missing description :\'(',
                iconsvg: nodeViewBuilder.icon ? nodeViewBuilder.icon : DEFAULT_ICON,
                inports: inlets.map(inlet => ({ name: inlet.name, type: inlet.type })),
                outports: outlets.map(outlet => ({ name: outlet.name, type: outlet.type })),
            }
        })
    })
    return library
}