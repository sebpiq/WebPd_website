import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import NodeLibraryPopUp from './NodeLibraryPopUp'
import { AppState } from '../store'
import { getUiPopup } from '../store/selectors'
import { POPUP_NODE_LIBRARY, setPopup, Popup, UiTheme, POPUP_NODE_CREATE } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import NodeCreatePopUp from './NodeCreatePopUp'
import ThemedButton from '../styled-components/ThemedButton'
import themed from '../styled-components/themed'

const Container = themed(styled.div<{ theme: UiTheme, colors: Colors }>`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    ${({ colors }) => `
        background: ${colors.bgPopup};
        color: ${colors.text};
    `}
    z-index: ${themeConfig.zIndex.Popup};
`)

const InnerContainer = styled.div`
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`

const CloseButton = styled(ThemedButton)`
    position: absolute;
    top: 0;
    right: 0;
`

interface Props {
    popup: Popup
    setPopup: typeof setPopup
}

const PopupComponent = ({ popup, setPopup }: Props) => {
    if (!popup) {
        return null
    }

    const onCloseClick = () => {
        setPopup(null)
    }

    let popupElem: JSX.Element = null
    if (popup.type === POPUP_NODE_LIBRARY) {
        popupElem = <NodeLibraryPopUp />
    } else if (popup.type === POPUP_NODE_CREATE) {
        popupElem = <NodeCreatePopUp />
    }

    return (
        <Container>
            <CloseButton onClick={onCloseClick}>
                ×
            </CloseButton>
            <InnerContainer>
                {popupElem}
            </InnerContainer>
        </Container>
    )
}

export default connect(
    (state: AppState) => ({
        popup: getUiPopup(state),
    }), 
    { setPopup }
)(PopupComponent)