import { Build } from "webpd"
import { WorkerSafeBuildSettings, workerSafePerformBuildStep } from "../store/artefacts-worker-safe"

export interface RequestPayload {
    artefacts: Build.Artefacts
    step: Build.BuildFormat
    settings: WorkerSafeBuildSettings
}

export interface ResponsePayload {
    artefacts: Build.Artefacts
    result: Awaited<ReturnType<typeof Build.performBuildStep>>
}

onmessage = (event: MessageEvent<RequestPayload>) => {
    const {artefacts, step, settings} = event.data
    console.log(`BUILD WORKER ${step}`)
    workerSafePerformBuildStep(artefacts, step, settings)
        .then(result => {
            const response: ResponsePayload = {
                result, artefacts
            }
            postMessage(response)
        })
}