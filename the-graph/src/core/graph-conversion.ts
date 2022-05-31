import { NODE_BUILDERS } from '@webpd/dsp-graph'
import TheGraph from 'the-graph'
import parsePd from '@webpd/pd-parser'
import * as fbpGraph from 'fbp-graph'
import { GraphNode } from 'fbp-graph/src/Types'
import {GraphJson} from 'fbp-graph/src/Types'
import NODE_VIEW_BUILDERS from './node-view-builders'
import { Library, PortletView, UiEdgeMetadata, UiNodeMetadata } from './types'

// export const uiToPd = (uiGraph: fbpGraph.Graph, engineSettings: PdEngine.Settings): PdJson.Pd => {
//     const patch: PdJson.Patch = {
//         id: '0',
//         args: [],
//         inlets: [],
//         outlets: [],
//         nodes: {},
//         connections: []
//     }
//     const pd: PdJson.Pd = { 
//         patches: {
//             '0': patch
//         }, 
//         arrays: {} 
//     }

//     uiGraph.nodes.forEach(node => {
//         if (!node.metadata || !node.metadata.pdNode) {
//             console.log('NO NODE META', node)
//             // uiGraph.addNode(pdNode.id, uiComponentName(pdNode, engineSettings), uiNodeMetadata)
//             const uiNodeMetadata: UiNodeMetadata = {
//                 pdNode: {
//                     id: node.id,
//                     type: pdComponentName(node),
//                     args: 
//                 }
//             }
//         }
//         const pdNode: PdJson.Node = node.metadata.pdNode
//         patch.nodes[pdNode.id] = pdNode
//     })

//     uiGraph.edges.forEach((edge) => {
//         // If edge metadata doesn't exist, we crate it first
//         if (!edge.metadata || !edge.metadata.pdConnection) {
//             const sourceNode = (uiGraph.getNode(edge.from.node).metadata as UiNodeMetadata).pdNode
//             const sinkNode = (uiGraph.getNode(edge.to.node).metadata as UiNodeMetadata).pdNode
//             const sourceNodeViewBuilder = NODE_VIEW_BUILDERS[sourceNode.type]
//             const sinkNodeViewBuilder = NODE_VIEW_BUILDERS[sinkNode.type]
//             const { outlets: outletViews } = sourceNodeViewBuilder.build(sourceNode.args, engineSettings)
//             const { inlets: inletViews } = sinkNodeViewBuilder.build(sinkNode.args, engineSettings)
//             const uiEdgeMetadata: UiEdgeMetadata = {
//                 pdConnection: {
//                     source: {nodeId: sourceNode.id, portletId: pdPortletId(edge.from.port, outletViews) },
//                     sink: {nodeId: sinkNode.id, portletId: pdPortletId(edge.to.port, inletViews) },
//                 }
//             }
//             edge.metadata = uiEdgeMetadata
//         }
//         patch.connections.push(edge.metadata.pdConnection)
//     })

//     // uiGraph.nodes.forEach((theGraphNode) => {
//     //     const nodeId = theGraphNode.id
//     //     const type = theGraphNode.component
//     //     const args = nodesArgs[nodeId] || {}
//     //     const sources = nodesSources[nodeId] || {}
//     //     const sinks = nodesSinks[nodeId] || {}
//     //     let extraArgs: Partial<PdDspGraph.Node> = {}
//     //     dspGraph[nodeId] = {
//     //         ...extraArgs,
//     //         id: nodeId,
//     //         type,
//     //         args,
//     //         sources,
//     //         sinks,
//     //         ...NODE_BUILDERS[type].build(args),
//     //     }
//     // })

//     return pd
// }

export const uiToPd = (uiGraph: fbpGraph.Graph, engineSettings: PdEngine.Settings): PdJson.Pd => {
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

export const attachEdgeMetadata = (uiGraph: fbpGraph.Graph, engineSettings: PdEngine.Settings) => {
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

// export const jsonToUi = async (graphData: GraphJson): Promise<fbpGraph.Graph> => {
//     // fbpGraph.graph.loadJSON(JSON.stringify(graphData), (err, graph) => {
//     const loadPromise = new Promise<fbpGraph.Graph>((resolve, reject) => {
//         fbpGraph.graph.loadJSON(graphData, (err, graph) => {
//             if (err) {
//                 reject(err)
//             } else {
//                 resolve(graph)
//             }
//         })
//     })
//     const graph = await loadPromise
//     return graph
// }

export const pdToUi = async (pd: PdJson.Pd, engineSettings: PdEngine.Settings) => {
    const uiGraph = new fbpGraph.Graph('patch')
    const patches = Object.values(pd.patches)
    if (patches.length > 1) {
        throw new Error(`Pd file with multiple patches not supported`)
    }
    const patch = patches[0]

    Object.values(patch.nodes).forEach(pdNode => {
        const uiNodeMetadata: UiNodeMetadata = {
            x: pdNode.layout.y,
            y: pdNode.layout.x,
            label: pdNode.type,
            icon: 'chevron-right',
            pdNode
        }
        uiGraph.addNode(pdNode.id, uiComponentName(pdNode, engineSettings), uiNodeMetadata)
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

export const pdFileToPd = async (pdFile: string) => 
    parsePd(pdFile)

export const pdToLibrary = (pd: PdJson.Pd, engineSettings: PdEngine.Settings): Library => {
    const library: Library = {} 
    // TheGraph.library.libraryFromGraph(uiGraph)

    Object.values(pd.patches).forEach((patch) => {
        Object.values(patch.nodes).forEach(node => {
            const nodeViewBuilder = NODE_VIEW_BUILDERS[node.type]
            const componentName = uiComponentName(node, engineSettings)
            const { inlets, outlets } = nodeViewBuilder.build(node.args, engineSettings)

            library[componentName] = {
                name: node.type,
                description: 'missing description :\'(',
                icon: 'chevron-right',
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

const pdComponentName = (uiNode: GraphNode) => {
    const parts = uiNode.component.split(':')
    return parts.slice(0, -2).join(':')
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
