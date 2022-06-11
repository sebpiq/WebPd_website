import React from 'react'
import { connect } from 'react-redux'
import { POPUP_IMPORT, setPopup } from '../store/ui'
import MenuButton from './MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonImport = ({ setPopup }: Props) => {
    const onClick = () => {
        setPopup({ type: POPUP_IMPORT })
    }
    return <MenuButton onClick={onClick}>import</MenuButton>
}

export default connect(null, { setPopup })(ButtonImport)
