import React from 'react'
import * as fbpGraph from 'fbp-graph'
import { GraphEdge } from 'fbp-graph/src/Types'
import TheGraph from 'the-graph'
import { connect } from 'react-redux'
import { AppState } from './store'
import { panScaleChanged } from './store/ui'
import { getModelGraph, getModelLibrary, getUiAppDimensions, getUiTheme } from './store/selectors'
import { UiLibrary, UiTheme } from './store/ui'
import styled from 'styled-components'

const Container = styled.div`
    background-color: transparent;
    position: absolute;
    top: 0;
    left: 0;
`

export interface Props {
    theme: UiTheme
    graph: fbpGraph.Graph
    library: UiLibrary,
    width: number
    height: number
    panChanged: typeof panScaleChanged
}

class GraphCanvas extends React.Component<Props> {

    render() {
        const { 
            theme,
            panChanged,
            library, 
            width,
            height,
            graph,
        } = this.props

        const themeClassName = `the-graph-${theme}`
    
        // Context menu specification
        const deleteNode = (graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) => {
            graph.removeNode(itemKey)
        }
        const deleteEdge = (graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) => {
            graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port)
        }
    
        const onPanScale = (x: number, y: number, scale: number) => {
            panChanged(-x, -y, scale)
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
    {panChanged: panScaleChanged}
)(GraphCanvas)