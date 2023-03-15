import styled from 'styled-components'
import { Box, Button, H2, H3 } from './components'
import { useAppSelector } from './store'
import { selectArtefacts } from './store/artefacts-selectors'
import { download } from './utils'

const Container = styled(Box)``

const JsonContainer = styled.pre`
    max-height: 25vh;
    overflow: auto;
`

const Debug = () => {
    const artefacts = useAppSelector(selectArtefacts)

    const onDowloadPdJson = () => {
        download(
            'debug.pd.json',
            JSON.stringify(artefacts.pdJson, null, 2),
            'application/json'
        )
    }

    const onDowloadDspGraph = () => {
        download(
            'debug.dsp-graph.json',
            JSON.stringify(artefacts.dspGraph, null, 2),
            'application/json'
        )
    }

    return (
        <Container>
            <H2>Debugging</H2>

            {artefacts.pdJson ? (
                <>
                    <H3>
                        Pd JSON{' '}
                        <Button onClick={onDowloadPdJson}>Download</Button>
                    </H3>
                    <JsonContainer>
                        {JSON.stringify(artefacts.pdJson, null, 2)}
                    </JsonContainer>
                </>
            ) : null}

            {artefacts.dspGraph ? (
                <>
                    <H3>
                        DSP Graph{' '}
                        <Button onClick={onDowloadDspGraph}>Download</Button>
                    </H3>
                    <JsonContainer>
                        {JSON.stringify(artefacts.dspGraph, null, 2)}
                    </JsonContainer>
                </>
            ) : null}
        </Container>
    )
}

export default Debug
