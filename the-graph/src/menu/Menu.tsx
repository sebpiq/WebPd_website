import React from 'react'
import styled from 'styled-components'
import themeConfig from '../theme-config'
import ButtonAddNode from './ButtonAddNode'
import ButtonExport from './ButtonExport'
import ToggleDsp from './ToggleDsp'
import ToggleTheme from './ToggleTheme'

const Container = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    z-index: ${themeConfig.zIndex.Menu}
    button {
        margin: ${themeConfig.spacing.default} 0em;
        margin-left: ${themeConfig.spacing.default};
        &:last-child {
            margin-right: ${themeConfig.spacing.default};
        }
    }
`

const Menu = () => {
    return (
        <Container>
            <ToggleDsp />
            <ToggleTheme />
            <ButtonAddNode />
            <ButtonExport />
        </Container>
    )
}

export default Menu