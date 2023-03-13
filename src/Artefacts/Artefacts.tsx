import styled from 'styled-components'
import { Button, H3 } from '../components'
import { useAppDispatch, useAppSelector } from '../store'
import { BUILD_STATUS } from '../store/artefacts'
import {
    selectArtefacts,
    selectArtefactsBuildStatus,
    selectArtefactsStep,
} from '../store/artefacts-selectors'
import buildOutput from '../store/build-output'
import { selectBuildOutputFormat } from '../store/build-output-selectors'
import { selectConsoleErrors } from '../store/console-selectors'
import ArtefactViewer from './ArtefactViewer'
import PatchPlayerContainer from './PatchPlayerContainer'

const Container = styled.div``

const Artefacts = () => {
    const dispatch = useAppDispatch()
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const artefacts = useAppSelector(selectArtefacts)
    const errors = useAppSelector(selectConsoleErrors)
    const buildStep = useAppSelector(selectArtefactsStep)
    const buildStatus = useAppSelector(selectArtefactsBuildStatus)
    const onClear = () => {
        dispatch(buildOutput.actions.clear())
    }

    if (!outFormat || errors || buildStatus !== BUILD_STATUS.SUCCESS) {
        return null
    }

    return (
        <Container>
            {buildStatus === BUILD_STATUS.IN_PROGRESS && (
                <H3>Building {buildStep} ...</H3>
            )}
            {buildStatus === BUILD_STATUS.SUCCESS ? (
                outFormat !== 'patchPlayer' ? (
                    <ArtefactViewer
                        artefacts={artefacts}
                        format={outFormat}
                        filename={'output.' + outFormat}
                        showDownloadButton={true}
                        extraButtons={[<Button key="clear" onClick={onClear}>Clear</Button>]}
                    />
                ) : (
                    <PatchPlayerContainer artefacts={artefacts} />
                )
            ) : null}
        </Container>
    )
}

export default Artefacts
