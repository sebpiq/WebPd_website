import * as fbpGraph from 'fbp-graph'
import NODE_VIEW_BUILDERS, { DEFAULT_ICON } from './node-view-builders'
import compileToCode, { NODE_IMPLEMENTATIONS } from '@webpd/compiler-js'
import compileToDspGraph from '@webpd/dsp-graph'
import { Library } from './types'
import {
    addGraphNode,
    getGraphNode,
    generateComponentName,
    GraphNodeWithMetadata,
} from './model'
import { audioworkletJsEval } from '@webpd/audioworklets'
import { compileAs } from './assemblyscript'
import { GLOBS_VARIABLE_NAME } from './constants'

export const graphToPd = (graph: fbpGraph.Graph): PdJson.Pd => {
    const patch: PdJson.Patch = {
        id: '0',
        args: [],
        inlets: [],
        outlets: [],
        nodes: {},
        connections: [],
    }
    const pd: PdJson.Pd = {
        patches: {
            '0': patch,
        },
        arrays: {},
    }

    graph.nodes.forEach((node: GraphNodeWithMetadata) => {
        if (!node.metadata || !node.metadata.pdNode) {
            throw new Error(`Missing metadata.pdNode on node "${node.id}"`)
        }
        const pdNode: PdJson.Node = {
            ...node.metadata.pdNode,
            layout: {
                ...graphPointToPd(node.metadata.x, node.metadata.y),
            },
        }
        patch.nodes[pdNode.id] = pdNode
    })

    graph.edges.forEach((edge) => {
        const sourceNode = getGraphNode(graph, edge.from.node)
        const sinkNode = getGraphNode(graph, edge.to.node)
        const pdConnection: PdJson.Connection = {
            source: {
                nodeId: sourceNode.id,
                portletId:
                    sourceNode.metadata.pdPortletLookup.outlets[edge.from.port],
            },
            sink: {
                nodeId: sinkNode.id,
                portletId:
                    sinkNode.metadata.pdPortletLookup.inlets[edge.to.port],
            },
        }
        patch.connections.push(pdConnection)
    })

    return pd
}

export const pdToGraph = (
    pd: PdJson.Pd,
    engineSettings: PdEngine.Settings
): fbpGraph.Graph => {
    const graph = new fbpGraph.Graph('patch')
    const patches = Object.values(pd.patches)
    if (patches.length > 1) {
        throw new Error(`Pd file with multiple patches not supported`)
    }
    const patch = patches[0]

    Object.values(patch.nodes).forEach((pdNode) => {
        const { x, y } = pdPointToGraph(pdNode.layout.x, pdNode.layout.y)
        addGraphNode(
            graph,
            pdNode.id,
            pdNode.type,
            pdNode.args,
            { x, y },
            engineSettings
        )
    })

    Object.values(patch.connections).forEach((pdConnection) => {
        const sourceNode = patch.nodes[pdConnection.source.nodeId]
        const sinkNode = patch.nodes[pdConnection.sink.nodeId]
        const sourceNodeViewBuilder = NODE_VIEW_BUILDERS[sourceNode.type]
        const sinkNodeViewBuilder = NODE_VIEW_BUILDERS[sinkNode.type]
        const { outlets: outletViews } = sourceNodeViewBuilder.build(
            sourceNode.args,
            engineSettings
        )
        const { inlets: inletViews } = sinkNodeViewBuilder.build(
            sinkNode.args,
            engineSettings
        )
        const { source, sink } = pdConnection
        graph.addEdge(
            source.nodeId,
            outletViews[source.portletId].name,
            sink.nodeId,
            inletViews[sink.portletId].name
        )
    })

    return graph
}

export const pdToLibrary = (
    pd: PdJson.Pd,
    engineSettings: PdEngine.Settings
): Library => {
    const library: Library = {}
    Object.values(pd.patches).forEach((patch) => {
        Object.values(patch.nodes).forEach((pdNode) => {
            const nodeViewBuilder = NODE_VIEW_BUILDERS[pdNode.type]
            const componentName = generateComponentName(
                pdNode.type,
                pdNode.args,
                engineSettings
            )
            const { inlets, outlets } = nodeViewBuilder.build(
                pdNode.args,
                engineSettings
            )

            library[componentName] = {
                name: pdNode.type,
                description: "missing description :'(",
                iconsvg: nodeViewBuilder.icon
                    ? nodeViewBuilder.icon
                    : DEFAULT_ICON,
                inports: inlets.map((inlet) => ({
                    name: inlet.name,
                    type: inlet.type,
                })),
                outports: outlets.map((outlet) => ({
                    name: outlet.name,
                    type: outlet.type,
                })),
            }
        })
    })
    return library
}

export const pdToJsCode = (pd: PdJson.Pd, settings: PdEngine.Settings) => {
    const dspGraph = compileToDspGraph(pd)
    return compileToCode(dspGraph, NODE_IMPLEMENTATIONS, {
        ...settings,
        target: 'javascript',
        arraysVariableName: GLOBS_VARIABLE_NAME,
    })
}

export const pdToWasm = async (pd: PdJson.Pd, settings: PdEngine.Settings): Promise<ArrayBuffer> => {
    const dspGraph = compileToDspGraph(pd)
    const code = compileToCode(dspGraph, NODE_IMPLEMENTATIONS, {
        ...settings,
        bitDepth: 64,
        target: 'assemblyscript',
        arraysVariableName: GLOBS_VARIABLE_NAME,
    })
    return compileAs(code)
}

const pdPointToGraph = (x: number, y: number) => ({
    x: y * 4,
    y: x,
})

const graphPointToPd = (x: number, y: number) => ({
    x: y,
    y: x / 4,
})
