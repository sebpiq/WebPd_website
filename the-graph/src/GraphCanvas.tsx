import React from 'react'
import * as fbpGraph from 'fbp-graph'
import { GraphEdge, GraphNode } from 'fbp-graph/src/Types'
import TheGraph from 'the-graph'
import { connect } from 'react-redux'
import { AppState } from './store'
import { POPUP_NODE_EDIT, POPUP_NODE_LIBRARY, setPanScale, setPopup } from './store/ui'
import { getModelGraph, getModelLibrary, getUiAppDimensions, getUiTheme } from './store/selectors'
import { UiLibrary, UiTheme } from './store/ui'
import styled from 'styled-components'
import { getGraphNode } from './core/model'

const Container = styled.div`
    background-color: transparent;
    position: absolute;
    top: 0;
    left: 0;

    svg {
        .icon image {
            pointer-events: none;
        }

        .context-node-rect, .context-node-icon {
            display: none;
        }
    }
`

export interface Props {
    theme: UiTheme
    graph: fbpGraph.Graph
    library: UiLibrary,
    width: number
    height: number
    setPanScale: typeof setPanScale
    setPopup: typeof setPopup
}

class GraphCanvas extends React.Component<Props> {

    render() {
        const { 
            theme,
            setPanScale,
            setPopup,
            library, 
            width,
            height,
            graph,
        } = this.props

        const themeClassName = `the-graph-${theme}`
    
        // Context menu specification
        const deleteNode = (graph: fbpGraph.Graph, nodeId: string, _: GraphNode) => {
            graph.removeNode(nodeId)
        }

        const editNode = (graph: fbpGraph.Graph, nodeId: string) => {
            const node = getGraphNode(graph, nodeId)
            setPopup({
                type: POPUP_NODE_EDIT, 
                data: {
                    nodeArgs: node.metadata.pdNode.args,
                    nodeType: node.metadata.pdNode.type,
                    nodeId: node.metadata.pdNode.id,
                }
            })
        }

        const addNode = () => {
            setPopup({ type: POPUP_NODE_LIBRARY })
        }

        const deleteEdge = (graph: fbpGraph.Graph, _: string, item: GraphEdge) => {
            graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port)
        }
    
        const onPanScale = (x: number, y: number, scale: number) => {
            setPanScale(-x, -y, scale)
        }
    
        const contextMenus: any = {
            main: {
                icon: 'long-arrow-right',
                s4: {
                    icon: 'plus',
                    iconLabel: 'add object',
                    action: addNode,
                },
            },
            selection: null,
            nodeInport: null,
            nodeOutport: null,
            graphInport: null,
            graphOutport: null,
            edge: {
                s4: {
                    icon: 'trash',
                    iconLabel: 'delete',
                    action: deleteEdge,
                },
            },
            node: {
                icon: 'cogs',
                n4: {
                    icon: 'cogs',
                    iconLabel: 'edit',
                    action: editNode,
                },
                s4: {
                    icon: 'trash',
                    iconLabel: 'delete',
                    action: deleteNode,
                },
            },
        }
    
        if (this.refs.theGraphContainer) {
            // TODO : really ugly and causes bugs (grid is fxcked when size changed and we're panning)
            const theGraphElem = (this.refs.theGraphContainer as HTMLDivElement).children.item(0) as HTMLElement
            theGraphElem.style.width = `${width}px`
            theGraphElem.style.height = `${height}px`
            const canvas = theGraphElem.querySelector('canvas')
            const svg = theGraphElem.querySelector('svg')
            canvas.width = width
            canvas.height = height
            svg.setAttribute('width', `${width}px`)
            svg.setAttribute('height', `${height}px`)
        }

        const props = {
            width,
            height,
            graph,
            library,
            menus: contextMenus,
            nodeIcons: {},
            onPanScale,
        }
    
        return (
            <Container className={themeClassName}>
                <div ref="theGraphContainer">
                    <TheGraph.App {...props} />
                </div>
            </Container>
        )
    }
}

export default connect(
    (state: AppState) => {
        const appDimensions = getUiAppDimensions(state)
        return {
            theme: getUiTheme(state),
            graph: getModelGraph(state),
            library: getModelLibrary(state),
            width: appDimensions.width,
            height: appDimensions.height,
        }
    },
    {setPanScale, setPopup}
)(GraphCanvas)