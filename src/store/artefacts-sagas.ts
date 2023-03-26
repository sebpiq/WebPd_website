import { call, delay, put, select, takeLatest } from 'redux-saga/effects'
import { Build, PdJson } from 'webpd'
import { create } from '../PatchPlayer/main'
import { PatchPlayer } from '../PatchPlayer/types'
import artefacts from './artefacts'
import {
    selectBuildInputArtefacts,
    selectBuildInputFilepath,
    selectBuildInputUrl,
} from './build-input-selectors'
import { selectBuildOutputFormat, selectBuildOutputPreviewDurationSeconds } from './build-output-selectors'
import { selectBuildSteps } from './shared-selectors'
import { BIT_DEPTH } from '../types'
import { selectAppDebug } from './app-selectors'

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
    const previewDurationSeconds: ReturnType<typeof selectBuildOutputPreviewDurationSeconds> = yield select(
        selectBuildOutputPreviewDurationSeconds
    )
    const debug: ReturnType<typeof selectAppDebug> = yield select(
        selectAppDebug
    )

    if (!inputArtefacts || !buildSteps) {
        yield put(
            artefacts.actions.buildSuccess({
                artefacts: inputArtefacts || Build.createArtefacts(),
                patchPlayer: null,
            })
        )
        return
    }

    // To allow the UI to update and display that it's building
    // before we start blocking operations.
    yield delay(1)

    let tempArtefacts = { ...inputArtefacts }
    let patchPlayer: PatchPlayer | null = null
    for (let step of buildSteps) {
        console.log('BUILD STEP START', step)
        yield put(artefacts.actions.startStep(step))
        try {
            const result: Awaited<ReturnType<typeof Build.performBuildStep>> =
                yield call(Build.performBuildStep, tempArtefacts, step, {
                    audioSettings: {
                        channelCount: { in: 2, out: 2 },
                        bitDepth: BIT_DEPTH,
                        sampleRate: 44100,
                        blockSize: 4096,
                        previewDurationSeconds: previewDurationSeconds || 30,
                    },
                    nodeBuilders: Build.NODE_BUILDERS,
                    nodeImplementations: Build.NODE_IMPLEMENTATIONS,
                    inletCallerSpecs: patchPlayer ? patchPlayer.inletCallersSpecs : undefined,
                    abstractionLoader: url
                        ? makeUrlAbstractionLoader(url)
                        : localAbstractionLoader,
                })
            const errors = result.status === 1 ? result.errors : undefined
            yield put(
                artefacts.actions.stepComplete({
                    status: result.status,
                    artefacts: tempArtefacts,
                    errors,
                    warnings: result.warnings,
                })
                )
            if (result.status === 1) {
                return
            }
        } catch (err: any) {
            yield put(
                artefacts.actions.stepComplete({
                    status: 1,
                    artefacts: tempArtefacts,
                    errors: [err.message],
                    warnings: [],
                })
            )
            if (debug) {
                throw err
            }
            return
        }

        if (step === 'dspGraph' && outFormat === 'patchPlayer') {
            patchPlayer = create(tempArtefacts, url || null)
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
    const parsedUrl = new URL(rootPatchUrl, window.location.origin)
    const rootUrl =
        parsedUrl.origin + parsedUrl.pathname.split('/').slice(0, -1).join('/')
    return Build.makeAbstractionLoader(async (nodeType: PdJson.NodeType) => {
        const url =
            rootUrl +
            '/' +
            (nodeType.endsWith('.pd') ? nodeType : `${nodeType}.pd`)
        console.log('LOADING ABSTRACTION', url)
        const response = await fetch(url)
        if (!response.ok) {
            console.log('ERROR LOADING ABSTRACTION', url)
            throw new Build.UnknownNodeTypeError(nodeType)
        }
        return await response.text()
    })
}

/** Always fails, because locally we don't load any abstractions */
const localAbstractionLoader = Build.makeAbstractionLoader(
    async (nodeType: PdJson.NodeType) => {
        throw new Build.UnknownNodeTypeError(nodeType)
    }
)
