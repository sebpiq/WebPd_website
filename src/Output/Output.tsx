import styled from 'styled-components'
import OutputSelector from './OutputSelector'
import OptionsCodeTarget from './OptionsCodeTarget'
import {
    ButtonActive,
    CompilationBox,
    CompilationBoxLeft,
    CompilationBoxRight,
    H3,
} from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import {
    selectBuildInputArtefacts,
    selectBuildInputFormat,
} from '../store/build-input-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import artefacts, { BUILD_STATUS } from '../store/artefacts'
import { theme } from '../theme'
import { selectArtefactsBuildStatus } from '../store/artefacts-selectors'
import { Artefacts } from '../Artefacts'
import { selectConsoleErrors } from '../store/console-selectors'
import OptionsWavLength from './OptionsWavLength'

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
    const inFormat = useAppSelector(selectBuildInputFormat)
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const buildStatus = useAppSelector(selectArtefactsBuildStatus)
    const hasCodeTargetOptions =
        inFormat &&
        outFormat &&
        ['pd', 'pdJson', 'dspGraph'].includes(inFormat) &&
        ['wav', 'patchPlayer'].includes(outFormat)
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
                        {outFormat && hasCodeTargetOptions ? <OptionsCodeTarget /> : null}
                        {outFormat === 'wav' ? <OptionsWavLength /> : null}
                        {outFormat ? (
                            <ButtonContainer>
                                <ButtonGo onClick={onGo}>Go !</ButtonGo>
                            </ButtonContainer>
                        ) : null}
                    </>
                )}
            </CompilationBoxRight>
        </Container>
    )
}

export default BuildConfig
