import { call, put, select, takeLatest } from 'redux-saga/effects'
import { build, NODE_BUILDERS, NODE_IMPLEMENTATIONS } from 'webpd'
import { create } from '../PatchPlayer/main'
import { PatchPlayer } from '../PatchPlayer/PatchPlayer'
import artefacts from './artefacts'
import { selectBuildInputArtefacts } from './build-input-selectors'
import { selectBuildOutputFormat } from './build-output-selectors'
import { selectBuildSteps } from './combined-selectors'
import { theme } from '../theme'
import { BIT_DEPTH } from '../types'

export function* watchStartBuild() {
    yield takeLatest(artefacts.actions.startBuild.type, makeBuild)
}

function* makeBuild() {
    const inputArtefacts: ReturnType<typeof selectBuildInputArtefacts> =
        yield select(selectBuildInputArtefacts)
    const buildSteps: ReturnType<typeof selectBuildSteps> = yield select(
        selectBuildSteps
    )
    const outFormat: ReturnType<typeof selectBuildOutputFormat> = yield select(
        selectBuildOutputFormat
    )

    if (!inputArtefacts || !buildSteps) {
        return
    }

    let tempArtefacts = { ...inputArtefacts }
    let patchPlayer: PatchPlayer | null = null
    for (let step of buildSteps) {
        yield put(artefacts.actions.startStep(step))
        console.log(step, patchPlayer)
        const result: Awaited<ReturnType<typeof build.performBuildStep>> =
            yield call(build.performBuildStep, tempArtefacts, step, {
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
        yield put(
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
            patchPlayer = create(tempArtefacts, {
                colorScheme: theme.colors.colorScheme,
                showCredits: false,
            })
        }
    }
    yield put(
        artefacts.actions.buildSuccess({
            artefacts: tempArtefacts,
            patchPlayer,
        })
    )
}
