import { Browser, Build, PdJson } from "webpd"

export interface WorkerSafeBuildSettings {
    audioSettings: Build.Settings['audioSettings']
    renderAudioSettings: Build.Settings['renderAudioSettings']
    inletCallerSpecs: Build.Settings['inletCallerSpecs']
    patchUrl: string | null
}

export const workerSafePerformBuildStep = async (
    artefacts: Build.Artefacts, step: Build.BuildFormat, workerSafeBuildSettings: WorkerSafeBuildSettings
) => {
    const settings: Build.Settings = {
        ...Browser.createDefaultBuildSettings(workerSafeBuildSettings.patchUrl || ''),
        audioSettings: workerSafeBuildSettings.audioSettings,
        renderAudioSettings: workerSafeBuildSettings.renderAudioSettings,
        inletCallerSpecs: workerSafeBuildSettings.inletCallerSpecs,
        abstractionLoader: workerSafeBuildSettings.patchUrl
            ? Browser.makeUrlAbstractionLoader(workerSafeBuildSettings.patchUrl)
            : localAbstractionLoader,
    }
    return Build.performBuildStep(artefacts, step, settings)
}

/** Always fails, because locally we don't load any abstractions */
const localAbstractionLoader = Build.makeAbstractionLoader(
    async (nodeType: PdJson.NodeType) => {
        throw new Build.UnknownNodeTypeError(nodeType)
    }
)
