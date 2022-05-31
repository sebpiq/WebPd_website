import React from 'react'
import * as fbpGraph from 'fbp-graph'
import TheGraph from 'the-graph'
import { AppState } from './store'
import { getModelGraph, getModelGraphVersion, getUiPanX, getUiPanY, getUiScale } from './store/selectors'
import { connect } from 'react-redux'
import styled from 'styled-components'

const Container = styled.div`
    position: absolute;
    right: 0px;
    bottom: 0px;
`

export interface Props {
    panX: number,
    panY: number,
    scale: number,
    graph: fbpGraph.Graph,
    graphVersion: number,
}

const MiniMap = ({ 
    panX, panY, scale, graph
}: Props) => {
    // Attach nav
    function fitGraphInView() {
        const editor = document.getElementById('editor')
        console.log('EDITOR TRIGGERFIT')
        ;(editor as any).triggerFit()
    }

    function panEditorTo() {}

    const view = [
        panX,
        panY,
        window.innerWidth,
        window.innerHeight,
    ]
    const props = {
        height: 162,
        width: 216,
        graph,
        onTap: fitGraphInView,
        onPanTo: panEditorTo,
        viewrectangle: view,
        viewscale: scale,
    }

    return (
        <Container>
            <TheGraph.nav.Component {...props} />
        </Container>
    )
}

export default connect(
    (state: AppState) => ({
        panX: getUiPanX(state),
        panY: getUiPanY(state),
        scale: getUiScale(state),
        graph: getModelGraph(state),
        // Force re-rendering of mini-map everytime the graph is modified
        graphVersion: getModelGraphVersion(state)
    })
)(MiniMap)