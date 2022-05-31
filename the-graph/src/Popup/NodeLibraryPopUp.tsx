import React from 'react'
import styled from "styled-components"
import NODE_VIEW_BUILDERS from "../core/node-view-builders"
import MenuButton from '../styled-components/MenuButton'

const Container = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    grid-gap: 5px;
`

const NodeTile = styled(MenuButton)`
    aspect-ratio: 1;
    font-size: 150%;
`

export const NodeLibraryPopUp = () => {
    const nodeTiles = Object.entries(NODE_VIEW_BUILDERS).map(([nodeType, nodeViewBuilder]) => {
        return (
            <NodeTile>{nodeType}</NodeTile>
        )
    })
    return (
        <Container>
            {nodeTiles}
        </Container>
    )
}