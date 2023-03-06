import styled from 'styled-components'
import { theme } from './theme'

export const H1 = styled.h1`
    font-size: 400%;
    color: ${theme.colors.colorScheme.next()};
    margin: 0;
    padding: 0;
    margin-bottom: ${theme.spacings.space1};
`

export const h2Mixin = `
    text-transform: uppercase;
    font-size: 110%;
    font-weight: bold;
`

export const H2 = styled.h2`
    ${h2Mixin}
    margin: 0;
    padding: 0;
    margin-bottom: ${theme.spacings.space1};
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

export const ButtonActive = styled(Button)`
    background-color: ${() => theme.colors.colorScheme.next()};
`

export const ButtonIconInline = styled(Button)`
    background: none;
    color: ${() => theme.colors.colorScheme.next()};
`

export const Select = styled.select`
    text-transform: uppercase;
    border: none;
    background-color: ${theme.colors.bg3};
`

const FilenameContainer = styled.span`
    position: absolute;
    top: ${theme.spacings.space0p1};
    right: ${theme.spacings.space0p1};
    color: ${theme.colors.fg2};
`

export const Filename: React.FunctionComponent<{ filename: string }> = ({
    filename,
}) => {
    const base = filename.split('/').slice(-1)[0] || null
    return <FilenameContainer>{base}</FilenameContainer>
}

export const Filesize = styled.span`
    position: absolute;
    top: ${theme.spacings.space0p1};
    left: ${theme.spacings.space0p1};
    color: ${theme.colors.fg2};
`

export const Or = styled.span`
    font-size: 120%;
    font-weight: bold;
    color: ${theme.colors.fg2}
`