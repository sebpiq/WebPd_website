import React from 'react'
import styled from 'styled-components'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import themed from './themed'

export default themed(styled.button<{ theme: UiTheme, colors: Colors }>`
    font-family: ${themeConfig.fontFamilies.default};
    border: 1px solid transparent;
    ${({ colors }) => `
        background: ${colors.bg};
        color: ${colors.text};
        &:hover {
            border-color: ${colors.text};
        }
    `}
    padding: 1em;
    cursor: pointer;
    transition: border-color 250ms;
`)