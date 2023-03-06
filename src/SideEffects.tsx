import { useEffect } from 'react'
import { build, NODE_BUILDERS, NODE_IMPLEMENTATIONS } from 'webpd'
import { create } from './PatchPlayer/main'
import { PatchPlayer } from './PatchPlayer/PatchPlayer'
import { useAppDispatch, useAppSelector } from './store'
import artefacts from './store/artefacts'
import { selectArtefactsIsBuilding } from './store/artefacts-selectors'
import { selectBuildInputArtefacts } from './store/build-input-selectors'
import { selectBuildOutputFormat } from './store/build-output-selectors'
import { selectBuildSteps } from './store/combined-selectors'
import { theme } from './theme'
import { BIT_DEPTH } from './types'

const SideEffects = () => {
    const dispatch = useAppDispatch()
    const inputArtefacts = useAppSelector(selectBuildInputArtefacts)
    const outFormat = useAppSelector(selectBuildOutputFormat)
    const buildSteps = useAppSelector(selectBuildSteps)
    const isBuilding = useAppSelector(selectArtefactsIsBuilding)

    const performBuildSteps = async () => {
        if (!isBuilding || !inputArtefacts || !buildSteps) {
            return
        }

        let tempArtefacts = { ...inputArtefacts }
        let patchPlayer: PatchPlayer | null = null
        for (let step of buildSteps) {
            dispatch(artefacts.actions.startStep(step))
            const result = await build.performBuildStep(tempArtefacts, step, {
                audioSettings: {
                    channelCount: { in: 2, out: 2 },
                    bitDepth: BIT_DEPTH,
                    sampleRate: 44100,
                    blockSize: 4096,
                    previewDurationSeconds: 15,
                },
                inletCallerSpecs: patchPlayer
                    ? patchPlayer.inletCallerSpecs
                    : {},
                nodeBuilders: NODE_BUILDERS,
                nodeImplementations: NODE_IMPLEMENTATIONS,
                abstractionLoader: async () => null,
            })

            const errors = result.status === 1 ? result.errors : undefined
            dispatch(
                artefacts.actions.stepComplete({
                    status: result.status,
                    errors,
                    warnings: result.warnings,
                })
            )
            if (result.status === 1) {
                break
            }

            if (step === 'dspGraph' && outFormat === 'patchPlayer') {
                patchPlayer = create(tempArtefacts, theme.colors.colorScheme)
            }
        }
        dispatch(artefacts.actions.buildComplete({artefacts: tempArtefacts, patchPlayer}))
    }

    useEffect(() => {
        performBuildSteps()
    }, [inputArtefacts, isBuilding])

    return null
}

export default SideEffects
