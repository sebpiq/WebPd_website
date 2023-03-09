import styled from 'styled-components'
import React from 'react'
import { Artefacts } from 'webpd'
import { Filename } from '../components'
import { theme } from '../theme'

interface Props {
    pd: NonNullable<Artefacts['pd']>
    filename?: string
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
`

const PdFile: React.FunctionComponent<Props> = ({ pd, filename }) => {
    return (
        <Container>
            <Pre>{pd}</Pre>
            {filename ? <Filename filename={filename} />: null}
        </Container>
    )
}

export default PdFile
