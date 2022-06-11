import React from 'react'
import { connect } from 'react-redux'
import { POPUP_ARRAYS, setPopup } from '../store/ui'
import MenuButton from './MenuButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonArrays = ({ setPopup }: Props) => {
    const onClick = () => {
        setPopup({ type: POPUP_ARRAYS })
    }
    return <MenuButton onClick={onClick}>arrays</MenuButton>
}

export default connect(null, { setPopup })(ButtonArrays)
