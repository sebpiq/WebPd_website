import { Build, PdJson } from "webpd"

export interface WorkerSafeBuildSettings {
    audioSettings: Build.Settings['audioSettings']
    inletCallerSpecs: Build.Settings['inletCallerSpecs']
    rootUrl: string | null
}

export const workerSafePerformBuildStep = async (
    artefacts: Build.Artefacts, step: Build.BuildFormat, workerSafeBuildSettings: WorkerSafeBuildSettings
) => {
    const settings: Build.Settings = {
        audioSettings: workerSafeBuildSettings.audioSettings,
        nodeBuilders: Build.NODE_BUILDERS,
        nodeImplementations: Build.NODE_IMPLEMENTATIONS,
        inletCallerSpecs: workerSafeBuildSettings.inletCallerSpecs,
        abstractionLoader: workerSafeBuildSettings.rootUrl
            ? makeUrlAbstractionLoader(workerSafeBuildSettings.rootUrl)
            : localAbstractionLoader,
    }
    return Build.performBuildStep(artefacts, step, settings)
}

const makeUrlAbstractionLoader = (rootUrl: string) => {
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
