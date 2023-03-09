import styled from 'styled-components'
import OutputSelector from './OutputSelector'
import ExtraOptions from './ExtraOptions'
import {
    ButtonActive,
    CompilationBox,
    CompilationBoxLeft,
    CompilationBoxRight,
    H3,
} from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import { selectBuildInputArtefacts } from '../store/build-input-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import artefacts, { BUILD_STATUS } from '../store/artefacts'
import { theme } from '../theme'
import { selectBuildOutputHasExtraOptions } from '../store/shared-selectors'
import { selectArtefactsBuildStatus } from '../store/artefacts-selectors'
import { Artefacts } from '../Artefacts'
import { selectConsoleErrors } from '../store/console-selectors'

const Container = styled(CompilationBox)``

const ButtonContainer = styled.div`
    margin-top: ${theme.spacings.space2};
`

const ButtonGo = styled(ButtonActive)`
    font-size: 150%;
    padding: 0.1em 0.5em;
`

const BuildConfig = () => {
    const dispatch = useAppDispatch()
    const inputArtefacts = useAppSelector(selectBuildInputArtefacts)
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const buildStatus = useAppSelector(selectArtefactsBuildStatus)
    const hasExtraOptions = useAppSelector(selectBuildOutputHasExtraOptions)
    const errors = useAppSelector(selectConsoleErrors)

    const onGo = () => {
        dispatch(artefacts.actions.startBuild())
    }

    if (!inputArtefacts) {
        return null
    }

    return (
        <Container>
            <CompilationBoxLeft>
                <H3>← output</H3>
            </CompilationBoxLeft>
            <CompilationBoxRight>
                {outFormat &&
                !errors &&
                buildStatus === BUILD_STATUS.SUCCESS ? (
                    <Artefacts />
                ) : (
                    <>
                        <OutputSelector />
                        {outFormat && hasExtraOptions ? <ExtraOptions /> : null}
                        <ButtonContainer>
                            <ButtonGo onClick={onGo}>Go !</ButtonGo>
                        </ButtonContainer>
                    </>
                )}
            </CompilationBoxRight>
        </Container>
    )
}

export default BuildConfig
