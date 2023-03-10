import styled from 'styled-components'
import { Box } from './components'
// eslint-disable-next-line import/no-webpack-loader-syntax
import introUrl from '!!markdown-loader?modules!webpd/README.md'
import { useEffect, useState } from 'react'
import { theme } from './theme'

const INTRO_START = '<!-- intro start -->'
const INTRO_END = '<!-- intro end -->'

const Container = styled(Box)`
    background: linear-gradient(180deg, rgba(0,0,0,0) 10%, ${theme.colors.bg2} 50%, ${theme.colors.bg2} 67%); 
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

const Introduction = () => {
    const [mdText, setMdText] = useState<string | null>(null)
    useEffect(() => {
        const doRequest = async () => {
            const response = await fetch(introUrl)
            if (!response.ok) {
                throw new Error(`Failed to load text`)
            }
            let mdText = await response.text()
            mdText = mdText.slice(mdText.indexOf(INTRO_START) + INTRO_START.length, mdText.indexOf(INTRO_END))
            setMdText(mdText)
        }
        doRequest()
    }, [])
    return (
        <Container>
            <H1>WebPd</H1>
            {mdText ? <RenderedMarkdownContainer dangerouslySetInnerHTML={{__html: mdText }} />: null}
        </Container>
    )
}

export default Introduction
