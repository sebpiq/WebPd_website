import React from 'react'
import { connect } from 'react-redux'
import { POPUP_ABOUT, setPopup } from '../store/ui'
import MenuButton from './MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonAbout = ({ setPopup }: Props) => {
    const onClick = () => {
        setPopup({ type: POPUP_ABOUT })
    }
    return <MenuButton onClick={onClick}>about</MenuButton>
}

export default connect(null, { setPopup })(ButtonAbout)
