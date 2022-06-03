import React from 'react'
import * as fbpGraph from 'fbp-graph'
import TheGraph from 'the-graph'
import { AppState } from './store'
import { getModelGraph, getModelGraphVersion, getUiPanScale } from './store/selectors'
import { connect } from 'react-redux'
import styled from 'styled-components'
import themeConfig from './theme-config'
import { Point, setPanScale } from './store/ui'

const Container = styled.div`
    position: absolute;
    right: ${themeConfig.spacing.default};
    bottom: ${themeConfig.spacing.default};
`

export interface Props {
    panX: number,
    panY: number,
    scale: number,
    graph: fbpGraph.Graph,
    graphVersion: number,
    setPanScale: typeof setPanScale
}

const MiniMap = ({ 
    panX, panY, scale, graph, setPanScale
}: Props) => {
    // Attach nav
    function fitGraphInView() {
        // const editor = document.getElementById('editor')
        console.log('EDITOR TRIGGERFIT')
        // ;(editor as any).triggerFit()
    }

    function panEditorTo(point: Point) {
    }

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
    (state: AppState) => {
        const panScale = getUiPanScale(state)
        return {
            panX: panScale.x,
            panY: panScale.y,
            scale: panScale.scale,
            graph: getModelGraph(state),
            // Force re-rendering of mini-map everytime the graph is modified
            graphVersion: getModelGraphVersion(state)
        }
    }, 
    { setPanScale }
)(MiniMap)