import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { getUiTheme } from '../store/selectors'
import { UiTheme } from '../store/ui'
import themeConfig from '../theme-config'

const MenuButton = styled.button<{theme: UiTheme}>`
    font-family: ${themeConfig.fontFamilies.default};
    border: 1px solid transparent;
    ${({ theme }) => {
        const colors = theme === 'dark' ? themeConfig.colors.dark : themeConfig.colors.light
        return `
            background: ${colors.bg};
            color: ${colors.text};
            &:hover {
                border-color: ${colors.text};
            }
        `
    }}
    padding: 1em;
    cursor: pointer;
`

export default connect(
    (state: AppState) => ({
        theme: getUiTheme(state)
    })
)(MenuButton)