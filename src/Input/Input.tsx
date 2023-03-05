import styled from 'styled-components'
import ArtefactViewer from '../Artefacts/ArtefactViewer'
import { Box, H2 } from '../components'
import { useAppSelector } from '../store'
import { selectBuildInputArtefacts, selectBuildInputFilepath, selectBuildInputFormat } from '../store/build-input-selectors'
import FromLocalFile from './FromLocalFile'
import FromUrl from './FromUrl'

const Left = styled.div``
const Right = styled.div`
    max-width: 50%;
`

const Container = styled(Box)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`

const Input = () => {
    const filepath = useAppSelector(selectBuildInputFilepath)
    const inFormat = useAppSelector(selectBuildInputFormat)
    const artefacts = useAppSelector(selectBuildInputArtefacts)
    let inputPreview: JSX.Element | null = null

    if (inFormat && artefacts) {
        inputPreview = (
            <ArtefactViewer
                format={inFormat}
                artefacts={artefacts}
                filename={filepath || undefined}
            />
        )
    }

    return (
        <Container>
            <Left>
                <H2>Choose a file</H2>
                <FromLocalFile /> OR <FromUrl />
            </Left>
            <Right>
                {inputPreview}
            </Right>
        </Container>
    )
}

export default Input
