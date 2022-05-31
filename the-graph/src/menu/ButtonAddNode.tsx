import React from 'react'
import { connect } from 'react-redux'
import { setPopup } from '../store/ui'
import MenuButton from '../styled-components/MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonAddNode = ({ setPopup }: Props) => {
    const onClick = () => { setPopup('addnode') }
    return (
        <MenuButton onClick={onClick}>
            Add object
        </MenuButton>
    )
}

export default connect(null, { setPopup })(ButtonAddNode)