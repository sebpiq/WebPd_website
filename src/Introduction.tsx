import styled from 'styled-components'
import { Box, LinkActive } from './components'
// eslint-disable-next-line import/no-webpack-loader-syntax
import introUrl from '!!markdown-loader?modules!webpd/README.md'
import { useEffect, useState } from 'react'
import { theme } from './theme'
import { ReactComponent as GitHubLogoSvg } from './images/github-mark.svg'
import { ReactComponent as HeartSvg } from './images/heart.svg'

const INTRO_START = '<!-- intro start -->'
const INTRO_END = '<!-- intro end -->'

const Container = styled(Box)`
    background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0) 10%,
        ${theme.colors.bg2} 50%,
        ${theme.colors.bg2} 67%
    );
`

const H1 = styled.h1`
    position: relative;
    bottom: 0.15em;
    right: 0.08em;
    font-size: 600%;
    font-family: ${theme.fonts.title};
    color: ${theme.colors.colorScheme.next()};
    margin: 0;
    padding: 0;
    margin-bottom: ${theme.spacings.space2};
    line-height: 100%;
    letter-spacing: 0.3em;
    text-align: center;
`

const RenderedMarkdownContainer = styled.div`
    & > *:last-child {
        margin-bottom: 0;
    }
`

const ButtonsContainer = styled.div`
    margin-top: ${theme.spacings.space1};
    display: flex;
    flex-direction: row;
`

const buttonMixin = `
    font-size: 90%;
    padding: ${theme.spacings.space0p1};
    text-decoration: none;
    display: flex;
    flex-direction: row;
    align-items: center;
    width: fit-content;

    svg {
        height: 1em;
        width: 1em;
        display: inline;
        margin-left: 0.5em;
        path {
            fill: ${theme.colors.fg1};
        }
    }
`

const GitHubButton = styled(LinkActive)`
    ${buttonMixin}
`

const OpenCollectiveButton = styled(LinkActive)`
    ${buttonMixin}
    margin-left: ${theme.spacings.space1};
`

const Introduction = () => {
    const [mdText, setMdText] = useState<string | null>(null)
    useEffect(() => {
        const doRequest = async () => {
            const response = await fetch(introUrl)
            if (!response.ok) {
                throw new Error(`Failed to load text`)
            }
            let mdText = await response.text()
            mdText = mdText.slice(
                mdText.indexOf(INTRO_START) + INTRO_START.length,
                mdText.indexOf(INTRO_END)
            )
            setMdText(mdText)
        }
        doRequest()
    }, [])
    return (
        <Container>
            <H1>WebPd</H1>
            {mdText ? (
                <RenderedMarkdownContainer
                    dangerouslySetInnerHTML={{ __html: mdText }}
                />
            ) : null}
            <ButtonsContainer>
                <GitHubButton
                    href="https://github.com/sebpiq/WebPd"
                    target="_blank"
                    rel="noopener"
                >
                    Read more
                    <GitHubLogoSvg viewBox="0 0 97.627 96" />
                </GitHubButton>
                <OpenCollectiveButton
                    href="https://opencollective.com/webpd"
                    target="_blank"
                    rel="noopener"
                >
                    Donate
                    <HeartSvg />
                </OpenCollectiveButton>
            </ButtonsContainer>
        </Container>
    )
}

export default Introduction
