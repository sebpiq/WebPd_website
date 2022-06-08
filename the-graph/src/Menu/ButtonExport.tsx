import React from 'react'
import { connect } from 'react-redux'
import { POPUP_EXPORT, setPopup } from '../store/ui'
import MenuButton from './MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonExport = ({ setPopup }: Props) => {
    const onClick = () => { setPopup({ type: POPUP_EXPORT }) }
    return (
        <MenuButton onClick={onClick}>
            export
        </MenuButton>
    )
}

export default connect(null, { setPopup })(ButtonExport)