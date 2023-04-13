import { call, delay, put, select, takeLatest } from 'redux-saga/effects'
import { Build } from 'webpd'
import { create } from '../PatchPlayer/main'
import { PatchPlayer } from '../PatchPlayer/types'
import artefacts from './artefacts'
import {
    selectBuildInputArtefacts,
    selectBuildInputUrl,
} from './build-input-selectors'
import { selectBuildOutputFormat, selectBuildOutputPreviewDurationSeconds } from './build-output-selectors'
import { selectBuildSteps } from './shared-selectors'
import { BIT_DEPTH } from '../types'
import { selectAppDebug } from './app-selectors'
import { WorkerSafeBuildSettings, workerSafePerformBuildStep } from './artefacts-worker-safe'
import { RequestPayload, ResponsePayload } from '../workers/build'

export function* watchStartBuild() {
    yield takeLatest(artefacts.actions.startBuild.type, makeBuild)
}

function sendBuildStepToWorker(worker: Worker, requestPayload: RequestPayload): Promise<ResponsePayload> {
    return new Promise((resolve) => {
        worker.onmessage = (event: MessageEvent<ResponsePayload>) => {
            resolve(event.data)
        }
        worker.postMessage(requestPayload)
    })
}

function* makeBuild() {
    const worker = new Worker('js/build.worker.js')
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
        console.log('BUILD STEP START', step, tempArtefacts)
        yield put(artefacts.actions.startStep(step))
        try {
            const settings: WorkerSafeBuildSettings = {
                audioSettings: {
                    channelCount: { in: 2, out: 2 },
                    bitDepth: BIT_DEPTH,
                    sampleRate: 44100,
                    blockSize: 4096,
                    previewDurationSeconds: previewDurationSeconds || 30,
                },
                inletCallerSpecs: patchPlayer ? patchPlayer.inletCallersSpecs : undefined,
                rootUrl: url ? getRootUrl(url): null
            }
            const requestPayload: RequestPayload = {
                artefacts: tempArtefacts, step, settings
            }

            // Didn't manage to build the AssemblyScript compiler in a worker, so execute the ASC compilation
            // in main thread, while everything else goes to worker.
            let result: Awaited<ReturnType<typeof Build.performBuildStep>>
            if (step === 'wasm') {
                result = yield call(workerSafePerformBuildStep, tempArtefacts, step, settings)
            } else {
                const responsePayload: ResponsePayload = yield call(sendBuildStepToWorker, worker, requestPayload)
                result = responsePayload.result
                tempArtefacts = responsePayload.artefacts
            }
            
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

const getRootUrl = (patchUrl: string) => {
    const parsedUrl = new URL(patchUrl, window.location.origin)
    return parsedUrl.origin + parsedUrl.pathname.split('/').slice(0, -1).join('/')
}