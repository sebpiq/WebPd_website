import React from 'react'
import { connect } from 'react-redux'
import { POPUP_ABOUT, setPopup } from '../store/ui'
import ThemedButton from '../styled-components/ThemedButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonAbout = ({ setPopup }: Props) => {
    const onClick = () => { setPopup({ type: POPUP_ABOUT }) }
    return (
        <ThemedButton onClick={onClick}>
            about
        </ThemedButton>
    )
}

export default connect(null, { setPopup })(ButtonAbout)