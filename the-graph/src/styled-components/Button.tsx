import React from 'react'
import styled from 'styled-components'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import { onDesktop } from './media-queries'
import themed from './themed'

const mixin = `
    font-family: ${themeConfig.fontFamilies.default};
    border: 1px solid transparent;
    padding: 1em;
    cursor: pointer;
    transition: border-color 250ms;
    ${onDesktop(`
        font-size: 80%;
    `)}
`

export default themed(styled.button<{ theme: UiTheme, colors: Colors }>`
    ${mixin}
    ${({ colors }) => `
        background-color: ${colors.primary};
        color: ${colors.text};
        &:hover {
            border-color: ${colors.text};
        }
    `}
`)

export const ThemedButton2 = themed(styled.button<{ theme: UiTheme, colors: Colors }>`
    ${mixin}
    ${({ colors }) => `
        background-color: ${colors.secondary};
        color: ${colors.text2};
        &:hover {
            border-color: ${colors.text2};
        }
    `}
`)