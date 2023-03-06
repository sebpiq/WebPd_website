import styled from 'styled-components'
import OutputSelector from './OutputSelector'
import ExtraOptions from './ExtraOptions'
import { ActionButton, Box } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import { selectBuildInputArtefacts } from '../store/build-input-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import artefacts from '../store/artefacts'
import {
    selectArtefactsIsBuilding
} from '../store/artefacts-selectors'
import { theme } from '../theme'
import { selectIsBuildingComplete, selectBuildOutputHasExtraOptions } from '../store/combined-selectors'

const Container = styled(Box)``

const ButtonContainer = styled.div`
    margin-top: ${theme.spacings.space1};
`

const BuildConfig = () => {
    const dispatch = useAppDispatch()
    const inputArtefacts = useAppSelector(selectBuildInputArtefacts)
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const isBuilding = useAppSelector(selectArtefactsIsBuilding)
    const isBuildingComplete = useAppSelector(selectIsBuildingComplete)
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
            {outFormat && !isBuilding && !isBuildingComplete ? (
                <ButtonContainer>
                    <ActionButton onClick={onGo}>Go !</ActionButton>
                </ButtonContainer>
            ) : null}
        </Container>
    )
}

export default BuildConfig
