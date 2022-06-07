import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { getUiMobileMenuExpanded } from '../store/selectors'
import { setMobileMenuExpanded, UiTheme } from '../store/ui'
import { onDesktop, onMobile } from '../styled-components/media-queries'
import themed from '../styled-components/themed'
import themeConfig, { Colors } from '../theme-config'
import BurgerMenu from './BurgerMenu'
import ButtonAbout from './ButtonAbout'
import ButtonAddNode from './ButtonAddNode'
import ButtonExport from './ButtonExport'
import ToggleDsp from './ToggleDsp'
import ToggleTheme from './ToggleTheme'

const Container = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    z-index: ${themeConfig.zIndex.Menu}
`

const DesktopContainer = styled.div`
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

const MobileContainer = themed(styled.div<{expanded: boolean, colors: Colors, theme: UiTheme}>`
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    transition: background-color 500ms;
    background-color: rgba(0, 0, 0, 0);
    ${props => `
        height: ${props.expanded ? '100vh': 'auto'};
        background-color: ${props.colors.bgPopup};
    `}    
    padding: ${themeConfig.spacing.default};
    ${onDesktop(`
        display: none;
    `)}
`)

const MobileMenuItems = styled.div<{expanded: boolean}>`
    transition: height 200ms;
    overflow: hidden;
    ${props => `
        height: ${props.expanded ? '400px': '0px'};
        ${props.expanded ? 
            `padding-top: 1em;`
        : ``}
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
        const {expanded, setMobileMenuExpanded} = this.props

        const menuItems = [
            <ToggleDsp />,
            <ToggleTheme />,
            <ButtonAddNode />,
            <ButtonExport />,
            <ButtonAbout />,
        ]

        const onBurgerClick = () => {
            setMobileMenuExpanded(!expanded)
        }

        return (
            <Container>
                <DesktopContainer>
                    {menuItems}
                </DesktopContainer>
                <MobileContainer expanded={expanded}>
                    <BurgerMenuContainer>
                        <BurgerMenu onClick={onBurgerClick}></BurgerMenu>
                    </BurgerMenuContainer>
                    <MobileMenuItems expanded={expanded}>
                        {menuItems}
                    </MobileMenuItems>
                </MobileContainer>
            </Container>
        )
    }
}

export default connect(
    (state: AppState) => ({ expanded: getUiMobileMenuExpanded(state) }),
    {setMobileMenuExpanded}
)(Menu)