import React from 'react'
import * as fbpGraph from 'fbp-graph'
import { GraphEdge, GraphNode } from 'fbp-graph/src/Types'
import TheGraph from 'the-graph'
import { connect } from 'react-redux'
import { AppState } from './store'
import { POPUP_NODE_EDIT, setPanScale, setPopup } from './store/ui'
import { getModelGraph, getModelLibrary, getUiAppDimensions, getUiTheme } from './store/selectors'
import { UiLibrary, UiTheme } from './store/ui'
import styled from 'styled-components'
import { UiNodeMetadata } from './core/types'

const Container = styled.div`
    background-color: transparent;
    position: absolute;
    top: 0;
    left: 0;

    svg {
        .icon image {
            pointer-events: none;
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
        const deleteNode = (graph: fbpGraph.Graph, itemKey: string, item: GraphNode) => {
            graph.removeNode(itemKey)
        }

        const editNode = (_: fbpGraph.Graph, __: string, item: GraphNode) => {
            const uiNodeMetadata = item.metadata as UiNodeMetadata
            if (!uiNodeMetadata) {
                throw new Error(`Node "${item.id}" has no metadata`)
            }
            const pdNode = uiNodeMetadata.pdNode
            setPopup({
                type: POPUP_NODE_EDIT, 
                data: {
                    nodeArgs: pdNode.args,
                    nodeType: pdNode.type,
                    nodeId: pdNode.id,
                }
            })
        }

        const deleteEdge = (graph: fbpGraph.Graph, _: string, item: GraphEdge) => {
            graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port)
        }
    
        const onPanScale = (x: number, y: number, scale: number) => {
            setPanScale(-x, -y, scale)
        }
    
        const contextMenus: any = {
            main: null,
            selection: null,
            nodeInport: null,
            nodeOutport: null,
            graphInport: null,
            graphOutport: null,
            edge: {
                icon: 'long-arrow-right',
                s4: {
                    icon: 'trash',
                    iconLabel: 'delete',
                    action: deleteEdge,
                },
            },
            node: {
                n4: {
                    icon: 'cog',
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