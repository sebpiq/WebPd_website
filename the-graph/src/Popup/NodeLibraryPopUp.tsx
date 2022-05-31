import React from 'react'
import { connect } from 'react-redux'
import styled from "styled-components"
import NODE_VIEW_BUILDERS from "../core/node-view-builders"
import { POPUP_NODE_CREATE, setPopup } from '../store/ui'
import ThemedButton from '../styled-components/ThemedButton'

interface Props {
    setPopup: typeof setPopup
}

const Container = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    grid-gap: 0.5em;
    height: 100%;
    width: 100%;
    padding: 0.5em;
`

const NodeTile = styled(ThemedButton)`
    aspect-ratio: 1;
    font-size: 150%;
`

const NodeLibraryPopUp = ({ setPopup }: Props) => {
    const nodeTiles = Object.entries(NODE_VIEW_BUILDERS).map(([nodeType]) => {
        const onTileClick = () => setPopup({ type: POPUP_NODE_CREATE, data: { nodeType } })
        return (
            <NodeTile onClick={onTileClick}>{nodeType}</NodeTile>
        )
    })
    return (
        <Container>
            {nodeTiles}
        </Container>
    )
}

export default connect(null, { setPopup })(NodeLibraryPopUp)