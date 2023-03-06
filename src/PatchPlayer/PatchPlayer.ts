import { PdJson, Settings as WebPdSettings } from 'webpd'
import { ControlModel, ControlsValues } from './models'
import { ControlView } from './views'

export interface Settings {
    colorScheme: { next: () => string }
    showCredits?: boolean
}

// TODO
// export const loadStateFromUrl = () => {
//     const rawParams = new URLSearchParams(document.location.search)
//     patchPlayer.params = {
//         patch: rawParams.get('patch') || './patches/Martin-Brinkmann-ginger2.pd',
//         target: rawParams.get('target')  || 'javascript',
//     }

//     // We consider that all other unknown params are control values
//     Array.from(rawParams).forEach(([key, rawValue]) => {
//         if (!(key in patchPlayer.params)) {
//             const value = JSON.parse(rawValue)
//             patchPlayer.controlsValues._values[key] = value
//         }
//     })
// }

export interface PatchPlayer {
    rootElem: HTMLElement | null
    audioContext: AudioContext
    webpdNode: any //runtime.WebPdWorkletNode | null
    pdJson: PdJson.Pd
    controls: Array<ControlModel>
    controlsViews: Array<ControlView>
    controlsValues: ControlsValues
    inletCallerSpecs: NonNullable<WebPdSettings['inletCallerSpecs']>
    settings: Settings
}
