import React from 'react'
import styled from 'styled-components'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import themed from './themed'

export default themed(styled.h2<{ theme: UiTheme; colors: Colors }>`
    ${({ colors }) => `
        color: ${colors.primary};
    `}
`)
