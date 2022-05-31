import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { NodeLibraryPopUp } from './NodeLibraryPopUp'
import { AppState } from '../store'
import { getUiPopup, getUiTheme } from '../store/selectors'
import { setPopup, UiPopup, UiTheme } from '../store/ui'
import themeConfig from '../theme-config'

const Container = styled.div<{theme: UiTheme}>`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    ${({ theme }) => {
        const colors = theme === 'dark' ? themeConfig.colors.dark : themeConfig.colors.light
        return `
            background: ${colors.bgPopup};
            color: ${colors.text};
        `
    }}
    z-index: ${themeConfig.zIndex.Popup};
`

const InnerContainer = styled.div``

const CloseButton = styled.button`
    cursor: pointer;
`

interface Props {
    popup: UiPopup
    theme: UiTheme
    setPopup: typeof setPopup
}

const Popup = ({ popup, theme, setPopup }: Props) => {
    const onCloseClick = () => {
        setPopup(null)
    }

    let popupElem: JSX.Element = null
    if (popup === 'addnode') {
        popupElem = <NodeLibraryPopUp />
    }

    if (!popupElem) {
        return null
    }

    return (
        <Container theme={theme}>
            <CloseButton onClick={onCloseClick}>X</CloseButton>
            <InnerContainer>
                {popupElem}
            </InnerContainer>
        </Container>
    )
}

export default connect(
    (state: AppState) => ({
        popup: getUiPopup(state),
        theme: getUiTheme(state)
    }), 
    { setPopup }
)(Popup)