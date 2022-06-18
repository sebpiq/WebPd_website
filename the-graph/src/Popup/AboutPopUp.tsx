import React from 'react'
import styled from 'styled-components'
import H2 from '../styled-components/H2'
import { onMobile } from '../styled-components/media-queries'
import themeConfig from '../theme-config'

interface Props {}

const Container = styled.div`
    height: 100%;
    width: 100%;
    font-size: 130%;
    ${onMobile(`
        font-size: 100%;
    `)}
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: ${themeConfig.spacing.default};
    p {
        margin: 0;
        margin-bottom: ${themeConfig.spacing.default};
        &:last-child {
            margin-bottom: 0;
        }
    }
`

class AboutPopUp extends React.Component<Props> {
    render() {
        return (
            <Container>
                <H2>WebPd Patch Editor</H2>
                <p>
                    <b>To start patching, create / edit / delete objects</b>{' '}
                    right click or long tap on the canvas. A contextual menu
                    will then open with all available operations. Don't forget
                    to press the DSP button to start the sound !
                </p>
                <p>
                    <b>This is a demo</b> of the new implementation of{' '}
                    <a href="https://github.com/sebpiq/WebPd" target="_blank">
                        WebPd
                    </a>{' '}
                    which uses flowhub's{' '}
                    <a href="https://github.com/flowhub/the-graph/">
                        The Graph
                    </a>{' '}
                    as a user interface for programming a Pd Patch.
                </p>
            </Container>
        )
    }
}

export default AboutPopUp
