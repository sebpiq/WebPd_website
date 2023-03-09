import styled from 'styled-components'
import ArtefactViewer from '../Artefacts/ArtefactViewer'
import { CompilationBox, CompilationBoxLeft, CompilationBoxRight, H3, Or } from '../components'
import { useAppSelector } from '../store'
import {
    selectBuildInputArtefacts,
    selectBuildInputFilepath,
    selectBuildInputFormat,
    selectBuildInputUrl,
} from '../store/build-input-selectors'
import FromLocalFile from './FromLocalFile'
import FromUrl from './FromUrl'

const Container = styled(CompilationBox)``

const InputContainer = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: auto;
    margin-top: 1rem;
    & > * {
        display: inline-block;
    }
`

const Input = () => {
    const filepath = useAppSelector(selectBuildInputFilepath)
    const url = useAppSelector(selectBuildInputUrl)
    const inFormat = useAppSelector(selectBuildInputFormat)
    const artefacts = useAppSelector(selectBuildInputArtefacts)

    return (
        <Container>
            <CompilationBoxLeft>
                <H3>→ input</H3>
            </CompilationBoxLeft>
            <CompilationBoxRight>
                {inFormat && artefacts ? (
                    <ArtefactViewer
                        format={inFormat}
                        artefacts={artefacts}
                        filename={filepath || url || undefined}
                    />
                ) : (
                    <InputContainer>
                        <FromLocalFile /> <Or>OR</Or> <FromUrl />
                    </InputContainer>
                )}
            </CompilationBoxRight>
        </Container>
    )
}

export default Input
