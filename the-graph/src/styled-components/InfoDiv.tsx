import React from 'react'
import styled from 'styled-components'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'
import themed from './themed'

export default themed(styled.div<{ theme: UiTheme; colors: Colors }>`
    margin: ${themeConfig.spacing.default} 0;
    ${({ colors }) => `
        color: ${colors.text2};
    `}
`)
