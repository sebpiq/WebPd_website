import React from 'react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { Artefacts } from 'webpd'
import { Button } from '../components'
import { destroy, start } from '../PatchPlayer/main'
import { useAppDispatch, useAppSelector } from '../store'
import { theme } from '../theme'
import patchPlayerSlice from '../store/patch-player'
import { selectPatchPlayer, selectPatchPlayerValues } from '../store/patch-player-selectors'
import { actionCleanBuild } from '../store/shared-action'

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
    z-index: ${theme.zIndexes.closeButton};
`

const PatchPlayerContainer: React.FunctionComponent<Props> = ({
    artefacts,
}) => {
    const rootElem = useRef<HTMLDivElement>(null)
    const dispatch = useAppDispatch()
    const patchPlayer = useAppSelector(selectPatchPlayer)
    const patchPlayerValues = useAppSelector(selectPatchPlayerValues)

    useEffect(() => {
        if (!patchPlayer) {
            return
        }
        const patchPlayerPromise = start(
            artefacts,
            patchPlayer,
            {
                container: rootElem.current!, 
                colorScheme: theme.colors.colorScheme,
                showCredits: false,
                initialValues: patchPlayerValues,
                valuesUpdatedCallback: (values) => {
                    dispatch(patchPlayerSlice.actions.valuesChanged(values))
                }
            },
        )
        return () => {
            console.log('DESTROY')
            patchPlayerPromise.then((startedPatchPlayer) => destroy(startedPatchPlayer))
        }
    }, [artefacts, patchPlayer])

    const onClose = () => {
        dispatch(actionCleanBuild())
    }

    return (
        <Container id="PatchPlayer" ref={rootElem}>
            <CloseButton onClick={onClose}>Close</CloseButton>
        </Container>
    )
}

export default PatchPlayerContainer
