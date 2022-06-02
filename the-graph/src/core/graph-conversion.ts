import * as fbpGraph from 'fbp-graph'
import NODE_VIEW_BUILDERS, { DEFAULT_ICON } from './node-view-builders'
import { Library, PortletView, UiEdgeMetadata, UiNodeMetadata } from './types'
import { Point } from '../store/ui'

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

export const updateEdgeMetadata = (uiGraph: fbpGraph.Graph, engineSettings: PdEngine.Settings) => {
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

export const addNode = (uiGraph: fbpGraph.Graph, pdNode: PdJson.Node, position: Point, engineSettings: PdEngine.Settings) => {
    const uiNodeMetadata: UiNodeMetadata = {
        x: position.x,
        y: position.y,
        label: pdNode.type,
        icon: 'chevron-right',
        // We put at least a space otherwise ThGraph will put a default sublabel
        sublabel: pdNode.args.map(v => v.toString()).join(' ') || ' ',
        pdNode,
    }
    uiGraph.addNode(pdNode.id, uiComponentName(pdNode, engineSettings), uiNodeMetadata)
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
        addNode(uiGraph, pdNode, {x, y}, engineSettings)
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
        Object.values(patch.nodes).forEach(node => {
            const nodeViewBuilder = NODE_VIEW_BUILDERS[node.type]
            const componentName = uiComponentName(node, engineSettings)
            const { inlets, outlets } = nodeViewBuilder.build(node.args, engineSettings)

            library[componentName] = {
                name: node.type,
                description: 'missing description :\'(',
                iconsvg: nodeViewBuilder.icon ? nodeViewBuilder.icon : DEFAULT_ICON,
                inports: inlets.map(inlet => ({ name: inlet.name, type: inlet.type })),
                outports: outlets.map(outlet => ({ name: outlet.name, type: outlet.type })),
            }
        })
    })
    return library
}

// Pd nodes can have for a same node type variable inlet / outlet number. 
// This is the case, for example, of trigger.
// The-graph takes only a static definition of inports / outports for one component.
const uiComponentName = (node: PdJson.Node, engineSettings: PdEngine.Settings) => {
    const nodeViewBuilder = NODE_VIEW_BUILDERS[node.type]
    const { inlets, outlets } = nodeViewBuilder.build(node.args, engineSettings)
    return `${node.type}:${inlets.length}:${outlets.length}`
}

const uiPortletId = (portletView: PortletView) => 
    portletView.name

const pdPortletId = (uiPortletId: string, portletViews: Array<PortletView>): PdJson.PortletId => {
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

// const library = {
//   basic: {
//     name: 'osc~',
//     description: 'basic demo component',
//     icon: 'eye',
//     inports: [
//       { name: 'in0', type: 'all' },
//       { name: 'in1', type: 'all' },
//     ],
//     outports: [
//       { name: 'out', type: 'all' },
//     ],
//   },
//   tall: {
//     name: 'tall',
//     description: 'tall demo component',
//     icon: 'cog',
//     inports: [
//       { name: 'in0', type: 'all' },
//       { name: 'in1', type: 'all' },
//       { name: 'in2', type: 'all' },
//       { name: 'in3', type: 'all' },
//       { name: 'in4', type: 'all' },
//       { name: 'in5', type: 'all' },
//       { name: 'in6', type: 'all' },
//       { name: 'in7', type: 'all' },
//       { name: 'in8', type: 'all' },
//       { name: 'in9', type: 'all' },
//       { name: 'in10', type: 'all' },
//       { name: 'in11', type: 'all' },
//       { name: 'in12', type: 'all' },
//     ],
//     outports: [
//       { name: 'out0', type: 'all' },
//     ],
//   },
// };
