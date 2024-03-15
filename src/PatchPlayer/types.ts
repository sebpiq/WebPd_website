import { GuiControls, Build, PdJson } from 'webpd'
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
    patchUrl: string | null
    audioContext: AudioContext
    webpdNode: any // runtime.WebPdWorkletNode | null
    pdJson: PdJson.Pd
    controls: Array<GuiControls.ControlTree>
    io: Build.Settings['io']
    controlsViews: Array<ControlTreeView>
    commentsViews: Array<CommentView>
    controlsValues: ControlsValues
    settings: Settings | null
}

export type PatchPlayerWithSettings = PatchPlayer & { settings: Settings }