import styled from 'styled-components'
import OutputSelector from './OutputSelector'
import ExtraOptions from './ExtraOptions'
import { ButtonActive, Box } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import { selectBuildInputArtefacts } from '../store/build-input-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import artefacts, { BUILD_STATUS } from '../store/artefacts'
import { theme } from '../theme'
import { selectBuildOutputHasExtraOptions } from '../store/shared-selectors'
import { selectArtefactsBuildStatus } from '../store/artefacts-selectors'

const Container = styled(Box)``

const ButtonContainer = styled.div`
    margin-top: ${theme.spacings.space1};
    text-align: right;
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

    const onGo = () => {
        dispatch(artefacts.actions.startBuild())
    }

    if (!inputArtefacts) {
        return null
    }

    return (
        <Container>
            <OutputSelector />
            {outFormat && hasExtraOptions ? <ExtraOptions />: null}
            {outFormat && buildStatus === BUILD_STATUS.INIT ? (
                <ButtonContainer>
                    <ButtonGo onClick={onGo}>Go !</ButtonGo>
                </ButtonContainer>
            ) : null}
        </Container>
    )
}

export default BuildConfig
