import { Browser, Build, PdJson } from 'webpd'

export interface WorkerSafeBuildSettings {
    audioSettings: Build.Settings['audioSettings']
    renderAudioSettings: Build.Settings['renderAudioSettings']
    io: Build.Settings['io']
    rootUrl: string | null
}

export const workerSafePerformBuildStep = async (
    artefacts: Build.Artefacts,
    step: Build.BuildFormat,
    workerSafeBuildSettings: WorkerSafeBuildSettings
) => {
    const settings: Build.Settings = {
        ...Browser.defaultSettingsForBuild(
            workerSafeBuildSettings.rootUrl || ''
        ),
        audioSettings: workerSafeBuildSettings.audioSettings,
        renderAudioSettings: workerSafeBuildSettings.renderAudioSettings,
        io: workerSafeBuildSettings.io,
        abstractionLoader: workerSafeBuildSettings.rootUrl
            ? Browser.makeUrlAbstractionLoader(workerSafeBuildSettings.rootUrl)
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
