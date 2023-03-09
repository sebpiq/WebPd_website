import { AppGenerator, PdJson, Build } from 'webpd'
import { ControlsValues } from './models'
import { CommentView, ControlTreeView } from './views'

export type PatchPlayerValues = ControlsValues['values']

export interface Settings {
    container: HTMLDivElement
    colorScheme: { next: () => string }
    initialValues?: PatchPlayerValues
    showCredits?: boolean
    valuesUpdatedCallback?: (values: PatchPlayerValues) => void
}

export interface PatchPlayer {
    rootElem: HTMLElement | null
    audioContext: AudioContext
    webpdNode: any // runtime.WebPdWorkletNode | null
    pdJson: PdJson.Pd
    controls: Array<AppGenerator.ControlTree>
    controlsViews: Array<ControlTreeView>
    commentsViews: Array<CommentView>
    controlsValues: ControlsValues
    inletCallerSpecs: NonNullable<Build.Settings['inletCallerSpecs']>
    settings: Settings | null
}

export type PatchPlayerWithSettings = PatchPlayer & { settings: Settings }