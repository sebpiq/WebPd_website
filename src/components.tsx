import styled from 'styled-components'
import { theme } from './theme'

export const H2 = styled.h2`
    font-family: ${theme.fonts.title};
    font-size: 140%;
    color: ${theme.colors.colorScheme.next()};
    margin: 0;
    padding: 0;
`

export const H3 = styled.h3`
    text-transform: uppercase;
    font-weight: bold;
    font-family: ${theme.fonts.title};
    margin: 0;
    padding: 0;
`

export const Box = styled.div`
    background-color: ${theme.colors.bg2};
    margin: ${theme.spacings.space1} auto 0 auto;
    padding: ${theme.spacings.space1};
    width: 100%;
    max-width: ${theme.dimensions.maxContentWidth};
`

const buttonMixin = `
    border: none;
    cursor: pointer;
    background-color: ${theme.colors.bg3};
`

const buttonActiveMixin = `
    font-family: ${theme.fonts.title};
`

export const Button = styled.button`
    ${buttonMixin}
`

export const ButtonActive = styled(Button)`
    ${buttonActiveMixin}
    background-color: ${() => theme.colors.colorScheme.next()};
`

export const Select = styled.select`
    border: none;
    background-color: ${theme.colors.bg1p5};
    cursor: pointer;
`

const FilenameContainer = styled.span`
    position: absolute;
    bottom: ${theme.spacings.space0p1};
    right: ${theme.spacings.space0p1};
    color: ${theme.colors.fg1p5};
`

export const Filename: React.FunctionComponent<{ filename: string }> = ({
    filename,
}) => {
    const base = filename.split('/').slice(-1)[0] || null
    return <FilenameContainer>{base}</FilenameContainer>
}

export const Filesize = styled.span`
    position: absolute;
    bottom: ${theme.spacings.space0p1};
    left: ${theme.spacings.space0p1};
    color: ${theme.colors.fg1p5};
`

export const fileViewportMixin = `
    height: 20vh;
    max-height: 10em;
    user-select: none;
`

export const Or = styled.span`
    font-size: 120%;
    font-weight: bold;
    color: ${theme.colors.fg2};
    min-width: 1.5em;
    @media (max-width: ${theme.devices.mobile.maxWidth}px) {
        text-align: center;
    }
`

export const Hint = styled.div`
    color: ${theme.colors.fg2};
    ::before {
        content: '→ ';
    }
    a {
        color: ${theme.colors.fg2};
    }
`

export const CompilationBox = styled(Box)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
`

export const CompilationBoxLeft = styled.div`
    min-width: 6.5rem;
    transform: translateX(-20%);
`

export const CompilationBoxRight = styled.div`
    flex: auto;
`

const SpinnerContainer = styled.div`
    font-family: ${theme.fonts.title};
    color: ${theme.colors.colorScheme.next()};
`

export const Spinner: React.FunctionComponent<{ text: string, className?:string }> = ({
    text, className
}) => {
    return <SpinnerContainer className={className}>{text}</SpinnerContainer>
}

export const ArtefactButtonsContainer = styled.div`
& > * {
    font-size: 90%;
    margin-right: ${theme.spacings.space0p1};
    &:last-child {
        margin-right: 0;
    }
}
`