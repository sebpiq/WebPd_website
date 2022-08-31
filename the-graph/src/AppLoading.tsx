import React from 'react'
import styled from 'styled-components'
import themed, { ThemedProps } from './styled-components/themed'
import themeConfig from './theme-config'

interface Props {
    text: string
}

const Container = themed(styled.div<ThemedProps>`
    z-index: ${themeConfig.zIndex.Popup};
    font-size: 200%;
    color: ${({ colors }) => colors.primary};
    background-color: ${({ colors }) => colors.bgPopup};
    position: fixed;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
`)

export default ({text}: Props) => {
    return (
        <Container>
            {text}
        </Container>
    )
}