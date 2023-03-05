import styled from 'styled-components'
import React from 'react'
import { Artefacts } from 'webpd'
import { Filename } from '../components'

interface Props {
    pd: NonNullable<Artefacts['pd']>
    filename?: string
}

const Container = styled.div`
    position: relative;
`

const Pre = styled.pre`
    max-height: 50vh;
    overflow: auto;
    margin: 0;
    padding: 0;
    opacity: 0.3;
`

const PdFile: React.FunctionComponent<Props> = ({ pd, filename }) => {
    return (
        <Container>
            <Pre>{pd}</Pre>
            {filename ? <Filename>{filename}</Filename>: null}
        </Container>
    )
}

export default PdFile
