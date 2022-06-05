import React from 'react'
import { connect } from 'react-redux'
import { POPUP_EXPORT, setPopup } from '../store/ui'
import ThemedButton from '../styled-components/ThemedButton'

interface Props {
    setPopup: typeof setPopup
}

const ButtonExport = ({ setPopup }: Props) => {
    const onClick = () => { setPopup({ type: POPUP_EXPORT }) }
    return (
        <ThemedButton onClick={onClick}>
            export
        </ThemedButton>
    )
}

export default connect(null, { setPopup })(ButtonExport)