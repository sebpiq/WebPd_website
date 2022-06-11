import React from 'react'
import styled from 'styled-components'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import { onDesktop } from './media-queries'
import themed from './themed'

const mixin = `
    font-family: ${themeConfig.fontFamilies.default};
    ${onDesktop(`
        font-size: 80%;
    `)}
    border: 1px solid transparent;
    padding: 1em;
    cursor: pointer;
    transition: border-color 250ms;
    &:disabled {
        text-decoration: line-through;
        opacity: 0.5;
    }
`

export default themed(styled.input<{ theme: UiTheme; colors: Colors }>`
    ${mixin}
    ${({ colors }) => `
        background: ${colors.primary};
        color: ${colors.text};
        &:hover, &:focus {
            border-color: ${colors.text};
        }
    `}
`)

export const Input2 = themed(styled.input<{ theme: UiTheme; colors: Colors }>`
    ${mixin}
    ${({ colors }) => `
        background: ${colors.secondary};
        color: ${colors.text2};
        &:hover, &:focus {
            border-color: ${colors.text2};
        }
    `}
`)
