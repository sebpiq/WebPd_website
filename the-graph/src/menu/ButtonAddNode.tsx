import React from 'react'
import { connect } from 'react-redux'
import { setPopup, POPUP_NODE_LIBRARY } from '../store/ui'
import ThemedButton from '../styled-components/ThemedButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonAddNode = ({ setPopup }: Props) => {
    const onClick = () => { setPopup({type: POPUP_NODE_LIBRARY}) }
    return (
        <ThemedButton onClick={onClick}>
            Add object
        </ThemedButton>
    )
}

export default connect(null, { setPopup })(ButtonAddNode)