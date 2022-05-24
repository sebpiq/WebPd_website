import React from 'react'
import * as fbpGraph from 'fbp-graph'
import { GraphEdge } from 'fbp-graph/src/Types'
import TheGraph from 'the-graph'
import { connect } from 'react-redux'
import { AppState } from './store'
import { panScaleChanged } from './store/ui'
import { getUiGraph, getUiLibrary, getUiTheme } from './store/selectors'
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
    panChanged: typeof panScaleChanged
}

const GraphCanvas = ({ 
    theme,
    panChanged,
    library, 
    graph
}: Props) => {
    const themeClassName = `the-graph-${theme}`

    // Context menu specification
    function deleteNode(graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) {
        graph.removeNode(itemKey)
    }
    function deleteEdge(graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) {
        graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port)
    }

    function onPanScale(x: number, y: number, scale: number) {
        // TODO : not working ? 
        panChanged(x, y, scale)
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

    const props = {
        width: window.innerWidth,
        height: window.innerWidth,
        graph,
        library,
        menus: contextMenus,
        nodeIcons: {},
        onPanScale,
    }

    // editor.style.width = `${props.width}px`
    // editor.style.height = `${props.height}px`

    return (
        <Container className={themeClassName}>
            <TheGraph.App {...props} />
        </Container>
    )
}

export default connect(
    (state: AppState) => ({
        theme: getUiTheme(state),
        graph: getUiGraph(state),
        library: getUiLibrary(state),
    }),
    {panChanged: panScaleChanged}
)(GraphCanvas)