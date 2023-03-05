import styled from 'styled-components'
import { Box, H2 } from '../components'
import { useAppSelector } from '../store'
import { selectArtefacts, selectArtefactsErrors, selectArtefactsIsBuilding, selectArtefactsIsBuildingComplete, selectArtefactsStep } from '../store/artefacts-selectors'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import ArtefactViewer from './ArtefactViewer'
import Errors from './Errors'

const Container = styled(Box)``

const Artefacts = () => {
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const artefacts = useAppSelector(selectArtefacts)
    const errors = useAppSelector(selectArtefactsErrors)
    const buildStep = useAppSelector(selectArtefactsStep)
    const isBuilding = useAppSelector(selectArtefactsIsBuilding)
    const isBuildingComplete = useAppSelector(selectArtefactsIsBuildingComplete)

    if (errors) {
        return (
            <div>
                <Errors errors={errors} buildStep={buildStep} />
            </div>
        )
    }

    if (!outFormat || !(isBuilding || isBuildingComplete)) {
        return null
    }

    return (
        <Container>
            {isBuilding && <H2>Building {buildStep} ...</H2>}
            {outFormat !== 'patchPlayer' ? <ArtefactViewer artefacts={artefacts} format={outFormat} showDownloadButton={true} />: 'PATCHPLAYER >'}
        </Container>
    )
}

export default Artefacts
