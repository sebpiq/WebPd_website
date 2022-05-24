import React from 'react'
import styled from 'styled-components'
import themeConfig from '../theme-config'
import ToggleDsp from './ToggleDsp'
import ToggleTheme from './ToggleTheme'

const Container = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    z-index: ${themeConfig.zIndex.Menu}
    button {
        margin: 1em 0em;
        margin-left: 1em;
        &:last-child {
            margin-right: 1em;
        }
    }
`

const Menu = () => {
    return (
        <Container>
            <ToggleDsp />
            <ToggleTheme />
        </Container>
    )
}

export default Menu