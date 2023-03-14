import styled from 'styled-components'
import ArtefactViewer from '../Artefacts/ArtefactViewer'
import { Button, CompilationBox, CompilationBoxLeft, CompilationBoxRight, H3, Or } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import buildInput from '../store/build-input'
import {
    selectBuildInputArtefacts,
    selectBuildInputFilepath,
    selectBuildInputFormat,
    selectBuildInputUrl,
} from '../store/build-input-selectors'
import { theme } from '../theme'
import FromExample from './FromExample'
import FromLocalFile from './FromLocalFile'
import FromUrl from './FromUrl'

const Container = styled(CompilationBox)`
    position: relative;
`

const InputContainer = styled.div`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex: auto;
    & > * {
        display: inline-block;
        @media (max-width: ${theme.devices.mobile.maxWidth}px) {
            /* Match all objects except Or */
            &:nth-child(2n+1) {
                width: 100%;
                text-align: center;
                background-color: ${theme.colors.bg1};
            }
        }
    }
`

const Input = () => {
    const dispatch = useAppDispatch()
    const filepath = useAppSelector(selectBuildInputFilepath)
    const url = useAppSelector(selectBuildInputUrl)
    const inFormat = useAppSelector(selectBuildInputFormat)
    const artefacts = useAppSelector(selectBuildInputArtefacts)
    const onClear = () => {
        dispatch(buildInput.actions.clear())
    }

    return (
        <Container>
            <CompilationBoxLeft>
                <H3>→ input</H3>
            </CompilationBoxLeft>
            <CompilationBoxRight>
                {inFormat && artefacts ? (
                    <>
                    <ArtefactViewer
                        format={inFormat}
                        artefacts={artefacts}
                        filename={filepath || url || undefined}
                        extraButtons={[<Button key="clear" onClick={onClear}>clear</Button>]}
                    />
                    </>
                ) : (
                    <InputContainer>
                        <FromLocalFile /> <Or>OR</Or> <FromUrl /> <Or>OR</Or> <FromExample />
                    </InputContainer>
                )}
            </CompilationBoxRight>
        </Container>
    )
}

export default Input
