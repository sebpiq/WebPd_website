import styled from 'styled-components'
import ArtefactViewer from '../Artefacts/ArtefactViewer'
import { Box, H3, Or } from '../components'
import { useAppSelector } from '../store'
import {
    selectBuildInputArtefacts,
    selectBuildInputFilepath,
    selectBuildInputFocusOn,
    selectBuildInputFormat,
    selectBuildInputUrl,
} from '../store/build-input-selectors'
import FromLocalFile from './FromLocalFile'
import FromUrl from './FromUrl'

const Container = styled(Box)`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`

const Left = styled.div``
const Right = styled.div`
    max-width: 50%;
`

const InputContainer = styled.div`
    display: flex;
    flex-direction: column;
    & > * {
        display: inline-block;
    }
`

const Input = () => {
    const filepath = useAppSelector(selectBuildInputFilepath)
    const url = useAppSelector(selectBuildInputUrl)
    const inFormat = useAppSelector(selectBuildInputFormat)
    const artefacts = useAppSelector(selectBuildInputArtefacts)
    let inputPreview: JSX.Element | null = null

    if (inFormat && artefacts) {
        inputPreview = (
            <ArtefactViewer
                format={inFormat}
                artefacts={artefacts}
                filename={filepath || url || undefined}
            />
        )
    }

    return (
        <Container>
            <Left>
                <H3>Input</H3>
                <InputContainer>
                    <FromLocalFile /> <Or>OR</Or>{' '}
                    <FromUrl />
                </InputContainer>
            </Left>
            <Right>{inputPreview}</Right>
        </Container>
    )
}

export default Input
