import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import NodeLibraryPopUp from './NodeLibraryPopUp'
import { AppState } from '../store'
import { getUiPopup } from '../store/selectors'
import {
    POPUP_NODE_LIBRARY,
    setPopup,
    Popup,
    POPUP_NODE_CREATE,
    POPUP_NODE_EDIT,
    POPUP_EXPORT,
    POPUP_ABOUT,
    POPUP_ARRAYS,
    POPUP_IMPORT,
    POPUP_COMPILATION_ERROR,
} from '../store/ui'
import themeConfig from '../theme-config'
import NodeCreateEditPopUp from './NodeCreateEditPopUp'
import { Button2 } from '../styled-components/Button'
import themed, { ThemedProps } from '../styled-components/themed'
import ExportPopUp from './ExportPopUp'
import AboutPopUp from './AboutPopUp'
import ArraysPopUp from './ArraysPopUp'
import ImportPopUp from './ImportPopUp'
import CompilationErrorPopUp from './CompilationErrorPopUp'

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
    padding: calc(3 * ${themeConfig.spacing.default}) 0;
    max-width: 800px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`

const CloseButton = styled(Button2)`
    font-size: 200%;
    padding: 0.1em 0.3em;
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

    componentDidMount() {
        document.addEventListener('keydown', this.escapedPressed, false)
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.escapedPressed, false)
    }

    escapedPressed(event: KeyboardEvent) {
        const { setPopup } = this.props
        if (event.key === 'Escape') {
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
            popupElem = (
                <NodeCreateEditPopUp
                    nodeId={popup.data.nodeId}
                    nodeType={popup.data.nodeType}
                    nodeArgs={popup.data.nodeArgs}
                />
            )
        } else if (popup.type === POPUP_EXPORT) {
            popupElem = <ExportPopUp />
        } else if (popup.type === POPUP_ABOUT) {
            popupElem = <AboutPopUp />
        } else if (popup.type === POPUP_ARRAYS) {
            popupElem = <ArraysPopUp />
        } else if (popup.type === POPUP_IMPORT) {
            popupElem = <ImportPopUp />
        } else if (popup.type === POPUP_COMPILATION_ERROR) {
            popupElem = <CompilationErrorPopUp />
        }

        return (
            <Container>
                <CloseButton onClick={onCloseClick}>×</CloseButton>
                <InnerContainer>{popupElem}</InnerContainer>
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
