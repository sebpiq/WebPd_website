import React from 'react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { Artefacts } from 'webpd'
import { Button } from '../components'
import { destroy, start } from '../PatchPlayer/main'
import { useAppDispatch, useAppSelector } from '../store'
import artefactsSlice from '../store/artefacts'
import { selectArtefactsPatchPlayer } from '../store/artefacts-selectors'
import { theme } from '../theme'

interface Props {
    artefacts: Artefacts
}

const Container = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: ${theme.colors.bg1}f1;
`

const CloseButton = styled(Button)`
    position: fixed;
    right: ${theme.spacings.space1};
    top: ${theme.spacings.space1};
`

const PatchPlayerContainer: React.FunctionComponent<Props> = ({
    artefacts,
}) => {
    const rootElem = useRef<HTMLDivElement>(null)
    const dispatch = useAppDispatch()
    const patchPlayer = useAppSelector(selectArtefactsPatchPlayer)

    useEffect(() => {
        if (!patchPlayer) {
            return
        }
        const patchPlayerPromise = start(
            patchPlayer,
            rootElem.current!,
            artefacts
        )
        return () => {
            patchPlayerPromise.then(() => destroy(patchPlayer))
        }
    }, [artefacts, patchPlayer])

    const onClose = () => {
        dispatch(artefactsSlice.actions.clean())
    }

    return (
        <Container id="PatchPlayer" ref={rootElem}>
            <CloseButton onClick={onClose}>Close</CloseButton>
        </Container>
    )
}

export default PatchPlayerContainer
