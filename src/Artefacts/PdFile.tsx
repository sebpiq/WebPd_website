import styled from 'styled-components'
import React from 'react'
import { Build } from 'webpd'
import { Filename } from '../components'
import { theme } from '../theme'

interface Props {
    pd: NonNullable<Build.Artefacts['pd']>
    filename?: string
    extraButtons?: Array<JSX.Element>
}

const Container = styled.div`
    position: relative;
    background-color: ${theme.colors.bg1p5};
`

const Pre = styled.pre`
    letter-spacing: 0.1em;
    max-height: ${theme.dimensions.maxArtefactHeight};
    overflow: auto;
    margin: 0;
    padding: 0;
    opacity: 0.3;
    user-select: none;
`

const ButtonsContainer = styled.div`
    position: absolute;
    top: calc(${theme.spacings.space0p1});
    right: calc(${theme.spacings.space0p1});
`

const PdFile: React.FunctionComponent<Props> = ({
    pd,
    filename,
    extraButtons,
}) => {
    return (
        <Container>
            <Pre>{pd}</Pre>
            {filename ? <Filename filename={filename} /> : null}
            {extraButtons ? (
                <ButtonsContainer>{extraButtons}</ButtonsContainer>
            ) : null}
        </Container>
    )
}

export default PdFile
