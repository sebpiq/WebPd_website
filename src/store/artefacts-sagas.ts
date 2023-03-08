import { call, put, select, takeLatest } from 'redux-saga/effects'
import {
    build,
    NODE_BUILDERS,
    NODE_IMPLEMENTATIONS,
    PdJson,
} from 'webpd'
import { create } from '../PatchPlayer/main'
import { PatchPlayer } from '../PatchPlayer/types'
import artefacts from './artefacts'
import {
    selectBuildInputArtefacts,
    selectBuildInputUrl,
} from './build-input-selectors'
import { selectBuildOutputFormat } from './build-output-selectors'
import { selectBuildSteps } from './shared-selectors'
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
    const url: ReturnType<typeof selectBuildInputUrl> = yield select(
        selectBuildInputUrl
    )

    console.log('BUILD ?', inputArtefacts, buildSteps, !inputArtefacts || !buildSteps)
    if (!inputArtefacts || !buildSteps) {
        return
    }

    let tempArtefacts = { ...inputArtefacts }
    let patchPlayer: PatchPlayer | null = null
    for (let step of buildSteps) {
        console.log('BUILD STEP START', step)
        yield put(artefacts.actions.startStep(step))
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
                abstractionLoader: url
                    ? makeUrlAbstractionLoader(url)
                    : localAbstractionLoader,
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
            patchPlayer = create(tempArtefacts)
        }
    }
    yield put(
        artefacts.actions.buildSuccess({
            artefacts: tempArtefacts,
            patchPlayer,
        })
    )
}

const makeUrlAbstractionLoader = (rootPatchUrl: string) => {
    const parsedUrl = new URL(rootPatchUrl)
    const rootUrl =
        parsedUrl.origin + parsedUrl.pathname.split('/').slice(0, -1).join('/')
    return build.makeAbstractionLoader(async (nodeType: PdJson.NodeType) => {
        const url =
            rootUrl + '/' + (nodeType.endsWith('.pd') ? nodeType : `${nodeType}.pd`)
        console.log('LOADING ABSTRACTION', url)
        const response = await fetch(url)
        if (!response.ok) {
            console.log('ERROR LOADING ABSTRACTION', url)
            throw new build.UnknownNodeTypeError(nodeType)
        }
        return await response.text()
    })
}

/** Always fails, because locally we don't load any abstractions */
const localAbstractionLoader = build.makeAbstractionLoader(
    async (nodeType: PdJson.NodeType) => {
        throw new build.UnknownNodeTypeError(nodeType)
    }
)
