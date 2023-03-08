import styled from 'styled-components'
import { Box, H1 } from './components'
import { theme } from './theme'
// eslint-disable-next-line import/no-webpack-loader-syntax
import introUrl from '!!markdown-loader?modules!webpd/README.md'
import { useEffect, useState } from 'react'

const Container = styled(Box)`
    background: rgb(0,0,0);
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, ${theme.colors.bg2} 50%, ${theme.colors.bg2} 67%); 
`

const RenderedMarkdownContainer = styled.div``

const Introduction = () => {
    const [mdText, setMdText] = useState<string | null>(null)
    useEffect(() => {
        const doRequest = async () => {
            const response = await fetch(introUrl)
            if (!response.ok) {
                throw new Error(`Failed to load text`)
            }
            setMdText(await response.text())
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
