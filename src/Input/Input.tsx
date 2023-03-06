import styled from 'styled-components'
import ArtefactViewer from '../Artefacts/ArtefactViewer'
import { Box, H2, Or } from '../components'
import { useAppSelector } from '../store'
import {
    selectBuildInputArtefacts,
    selectBuildInputFilepath,
    selectBuildInputFocusOn,
    selectBuildInputFormat,
    selectBuildInputUrl,
} from '../store/build-input-selectors'
import { theme } from '../theme'
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

const InputContainer = styled.div<{ startsWithUrl: boolean }>`
    display: flex;
    flex-direction: ${(props) =>
        props.startsWithUrl ? 'column-reverse': 'column'};
    & > * {
        display: inline-block;
    }
`

const Input = () => {
    const filepath = useAppSelector(selectBuildInputFilepath)
    const url = useAppSelector(selectBuildInputUrl)
    const focusOn = useAppSelector(selectBuildInputFocusOn)
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
                <H2>Choose a file</H2>
                <InputContainer startsWithUrl={focusOn === 'url'}>
                    <FromLocalFile isActive={focusOn === 'local'} /> <Or>OR</Or>{' '}
                    <FromUrl isActive={focusOn === 'url'} />
                </InputContainer>
            </Left>
            <Right>{inputPreview}</Right>
        </Container>
    )
}

export default Input
