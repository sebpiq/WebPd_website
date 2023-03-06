import styled from 'styled-components'
import { Box, H2 } from '../components'
import { useAppSelector } from '../store'
import {
    selectArtefacts,
    selectArtefactsIsBuilding,
    selectArtefactsStep,
} from '../store/artefacts-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import { selectIsBuildingComplete } from '../store/combined-selectors'
import { selectConsoleErrors } from '../store/console-selectors'
import ArtefactViewer from './ArtefactViewer'
import PatchPlayerContainer from './PatchPlayerContainer'

const Container = styled(Box)``

const Artefacts = () => {
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const artefacts = useAppSelector(selectArtefacts)
    const errors = useAppSelector(selectConsoleErrors)
    const buildStep = useAppSelector(selectArtefactsStep)
    const isBuilding = useAppSelector(selectArtefactsIsBuilding)
    const isBuildingComplete = useAppSelector(selectIsBuildingComplete)

    if (!outFormat || !isBuildingComplete || errors) {
        return null
    }

    return (
        <Container>
            {isBuilding && <H2>Building {buildStep} ...</H2>}
            {outFormat !== 'patchPlayer' && isBuildingComplete ? (
                <ArtefactViewer
                    artefacts={artefacts}
                    format={outFormat}
                    showDownloadButton={true}
                />
            ) : (
                <PatchPlayerContainer artefacts={artefacts} />
            )}
        </Container>
    )
}

export default Artefacts
