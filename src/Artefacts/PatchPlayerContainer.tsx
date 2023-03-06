import React from 'react'
import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { Artefacts } from 'webpd'
import { destroy, start } from '../PatchPlayer/main'
import { useAppSelector } from '../store'
import { selectArtefactsPatchPlayer } from '../store/artefacts-selectors'

interface Props {
    artefacts: Artefacts
}

const Container = styled.div``

const PatchPlayerContainer: React.FunctionComponent<Props> = ({ artefacts }) => {
    const rootElem = useRef<HTMLDivElement>(null)
    const patchPlayer = useAppSelector(selectArtefactsPatchPlayer)
    console.log('RENDER PATCH PLAYER', artefacts && Object.keys(artefacts), patchPlayer)

    useEffect(() => {
        console.log('USE EFFECT PATCH PLAYER')
        if (!patchPlayer) {
            return
        }
        const patchPlayerPromise = start(
            patchPlayer,
            rootElem.current!,
            artefacts,
        )
        return () => {
            patchPlayerPromise.then(() => destroy(patchPlayer))
        }
    }, [artefacts, patchPlayer])

    return <Container ref={rootElem}></Container>
}

export default PatchPlayerContainer
