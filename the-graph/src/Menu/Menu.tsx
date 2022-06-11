import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { getUiMobileMenuExpanded } from '../store/selectors'
import { setMobileMenuExpanded, setPopup, UiTheme } from '../store/ui'
import { onDesktop, onMobile } from '../styled-components/media-queries'
import themed from '../styled-components/themed'
import themeConfig, { Colors } from '../theme-config'
import BurgerMenu from './BurgerMenu'
import ButtonAbout from './ButtonAbout'
import ButtonAddNode from './ButtonAddNode'
import ButtonArrays from './ButtonArrays'
import ButtonExport from './ButtonExport'
import ButtonImport from './ButtonImport'
import ToggleDsp from './ToggleDsp'

const Container = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    z-index: ${themeConfig.zIndex.Menu};
`

const DesktopContainer = styled.div`
    width: 100vw;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    ${onMobile(`
        display: none;
    `)}
    button {
        margin: ${themeConfig.spacing.default} 0em;
        margin-left: ${themeConfig.spacing.default};
        &:last-child {
            margin-right: ${themeConfig.spacing.default};
        }
    }
`

const DesktopMenuItemsLeft = styled.div``
const DesktopMenuItemsRight = styled.div``

const MobileContainer = themed(styled.div<{
    expanded: boolean
    colors: Colors
    theme: UiTheme
}>`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    transition: background-color 500ms;
    background-color: rgba(0, 0, 0, 0);
    ${(props) => `
        height: ${props.expanded ? '100vh' : 'auto'};
        ${props.expanded ? 'width: 100vw;' : ''}
        ${props.expanded ? `background-color: ${props.colors.bgPopup};` : ''}
    `}    
    padding: ${themeConfig.spacing.default};
    ${onDesktop(`
        display: none;
    `)}
`)

const MobileMenuItems = styled.div<{ expanded: boolean }>`
    transition: height 200ms;
    overflow: hidden;
    ${(props) => `
        height: ${props.expanded ? '400px' : '0px'};
        ${props.expanded ? `padding-top: 1em;` : ``}
    `}
    button {
        display: block;
        width: 100%;
        margin-bottom: calc(${themeConfig.spacing.default} / 2);
    }
`

const BurgerMenuContainer = styled.div`
    text-align: left;
`

interface Props {
    expanded: boolean
    setMobileMenuExpanded: typeof setMobileMenuExpanded
}

class Menu extends React.Component<Props> {
    render() {
        const { expanded, setMobileMenuExpanded } = this.props

        const menuItemsLeft = [<ToggleDsp />]

        const menuItemsRight = [
            <ButtonAddNode />,
            <ButtonArrays />,
            <ButtonImport />,
            <ButtonExport />,
            <ButtonAbout />,
        ]

        const onBurgerClick = () => {
            setMobileMenuExpanded(!expanded)
        }

        const onClickMobileContainer = () => {
            setMobileMenuExpanded(false)
        }

        return (
            <Container>
                <DesktopContainer>
                    <DesktopMenuItemsLeft>{menuItemsLeft}</DesktopMenuItemsLeft>
                    <DesktopMenuItemsRight>
                        {menuItemsRight}
                    </DesktopMenuItemsRight>
                </DesktopContainer>
                <MobileContainer
                    expanded={expanded}
                    onClick={onClickMobileContainer}
                >
                    <BurgerMenuContainer>
                        <BurgerMenu onClick={onBurgerClick}></BurgerMenu>
                    </BurgerMenuContainer>
                    <MobileMenuItems expanded={expanded}>
                        {menuItemsLeft}
                        {menuItemsRight}
                    </MobileMenuItems>
                </MobileContainer>
            </Container>
        )
    }
}

export default connect(
    (state: AppState) => ({ expanded: getUiMobileMenuExpanded(state) }),
    { setMobileMenuExpanded }
)(Menu)
