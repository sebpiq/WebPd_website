import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import NodeLibraryPopUp from './NodeLibraryPopUp'
import { AppState } from '../store'
import { getUiPopup } from '../store/selectors'
import { POPUP_NODE_LIBRARY, setPopup, Popup, POPUP_NODE_CREATE, POPUP_NODE_EDIT, POPUP_EXPORT } from '../store/ui'
import themeConfig from '../theme-config'
import NodeCreateEditPopUp from './NodeCreateEditPopUp'
import ThemedButton, { ThemedButton2 } from '../styled-components/ThemedButton'
import themed, { ThemedProps } from '../styled-components/themed'
import ExportPopUp from './ExportPopUp'

const Container = themed(styled.div<ThemedProps>`
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

const CloseButton = styled(ThemedButton2)`
    position: absolute;
    top: 0;
    right: 0;
`

interface Props {
    popup: Popup
    setPopup: typeof setPopup
}

class PopupComponent extends React.Component<Props> {

    constructor(props: Props) {
        super(props)
        this.escapedPressed = this.escapedPressed.bind(this)
    }

    componentDidMount(){
        document.addEventListener("keydown", this.escapedPressed, false)
    }

    componentWillUnmount(){
        document.removeEventListener("keydown", this.escapedPressed, false)
    }

    escapedPressed(event: KeyboardEvent) {
        const { setPopup } = this.props
        if (event.key === "Escape") {
            setPopup(null)
        }
    }

    render() {
        const { popup, setPopup } = this.props

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
            popupElem = <NodeCreateEditPopUp nodeType={popup.data.nodeType} />
        } else if (popup.type === POPUP_NODE_EDIT) {
            popupElem = <NodeCreateEditPopUp 
                nodeId={popup.data.nodeId} 
                nodeType={popup.data.nodeType} 
                nodeArgs={popup.data.nodeArgs}
            />
        } else if (popup.type === POPUP_EXPORT) {
            popupElem = <ExportPopUp />
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
}

export default connect(
    (state: AppState) => ({
        popup: getUiPopup(state),
    }), 
    { setPopup }
)(PopupComponent)