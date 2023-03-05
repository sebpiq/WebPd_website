import styled from 'styled-components'
import { theme } from './theme'

export const H1 = styled.h1`
    font-size: 400%;
    color: ${theme.colors.colorScheme.next()};
    margin: 0;
    padding: 0;
    margin-bottom: ${theme.spacings.space1}
`

export const H2 = styled.h2`
    text-transform: uppercase;
    font-size: 110%;
    margin: 0;
    padding: 0;
    margin-bottom: ${theme.spacings.space1}
`

export const Box = styled.div`
    background-color: ${theme.colors.bg2};
    margin: ${theme.spacings.space1} auto;
    padding: ${theme.spacings.space1};
    max-width: ${theme.dimensions.maxContentWidth};
`

export const Button = styled.button`
    border: none;
    cursor: pointer;
    background-color: ${theme.colors.bg3};
    text-transform: uppercase;
`

export const ActionButton = styled(Button)`
    background-color: ${() => theme.colors.colorScheme.next()};
`

export const Select = styled.select`
    text-transform: uppercase;
    border: none;
    background-color: ${theme.colors.bg3};
`

export const Filename = styled.span`
    position: absolute;
    top: ${theme.spacings.space0p1};
    right: ${theme.spacings.space0p1};
`

export const Filesize = styled.span`
    position: absolute;
    top: ${theme.spacings.space0p1};
    left: ${theme.spacings.space0p1};
`