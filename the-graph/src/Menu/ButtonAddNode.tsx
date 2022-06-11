import React from 'react'
import { connect } from 'react-redux'
import { setPopup, POPUP_NODE_LIBRARY } from '../store/ui'
import MenuButton from './MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonAddNode = ({ setPopup }: Props) => {
    const onClick = () => {
        setPopup({ type: POPUP_NODE_LIBRARY })
    }
    return <MenuButton onClick={onClick}>add object</MenuButton>
}

export default connect(null, { setPopup })(ButtonAddNode)
