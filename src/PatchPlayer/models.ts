import { Build, DspGraph } from 'webpd'
import { PdJson, AppGenerator } from 'webpd'
import { round } from './math-utils'
import { sendMsgToWebPd, throttled } from './misc-utils'
import { PatchPlayerWithSettings } from './types'

export const PORTLET_ID = '0'

export type ValueTransform = (v: number) => string | number | null

export interface ControlsValues {
    values: { [nodeId: string]: string | number }
    transforms: { [nodeId: string]: ValueTransform }
}

export const createModels = (
    pdJson: PdJson.Pd,
    controlsValues: ControlsValues,
) => {
    const { controls, comments } = AppGenerator.discoverGuiControls(pdJson)

    AppGenerator.traverseGuiControls(controls, (control) => {
        let valueTransform: ValueTransform = (v) => v
        if (control.node.type === 'bng' || control.node.type === 'msg') {
            valueTransform = (v: any) => v.state === true ? 'bang' : null
        } else if (control.node.type === 'tgl') {
            valueTransform = (v) => +v
        }
        _registerControlValue(controlsValues, control, valueTransform)
    })

    // We make sure all controls are inside a container at top level for easier layout
    const controlsModels = controls.map((control) => {
        const controlContainer: AppGenerator.ControlContainer = {
            type: 'container',
            patch: control.patch,
            node: control.node,
            children: [control],
        }
        return control.type === 'control' ? controlContainer : control
    })

    return {
        controls: controlsModels,
        comments,
    }
}

export const setControlValue = (
    patchPlayer: PatchPlayerWithSettings,
    control: AppGenerator.Control,
    rawValue: number
) => {
    const { node, patch } = control
    const nodeId = Build.buildGraphNodeId(patch.id, node.id)
    const valueTransform = patchPlayer.controlsValues.transforms[nodeId]
    if (!valueTransform) {
        throw new Error(`no value transform for ${nodeId}`)
    }
    const value = valueTransform(rawValue)!
    if (value === null) {
        return
    }

    _setControlValue(patchPlayer, nodeId, value)
}

export const getControlValue = (
    patchPlayer: PatchPlayerWithSettings,
    control: AppGenerator.Control
) => {
    const { node, patch } = control
    const nodeId = Build.buildGraphNodeId(patch.id, node.id)
    return patchPlayer.controlsValues.values[nodeId]
}

export const initializeControlValues = (
    patchPlayer: PatchPlayerWithSettings
) => {
    Object.entries(patchPlayer.controlsValues.values).forEach(
        ([nodeId, value]) => {
            _setControlValue(patchPlayer, nodeId, value)
        }
    )
}

const _registerControlValue = (
    controlsValues: ControlsValues,
    control: AppGenerator.Control,
    valueTransform: ValueTransform
) => {
    const { node, patch } = control
    const nodeId = Build.buildGraphNodeId(patch.id, node.id)
    controlsValues.transforms[nodeId] = valueTransform
}

const _setControlValue = (
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId,
    value: string | number
) => {
    patchPlayer.controlsValues.values[nodeId] = value
    if (patchPlayer.settings.valuesUpdatedCallback) {
        _sendUpdatedControlValues(patchPlayer)
    }
    sendMsgToWebPd(patchPlayer, nodeId, [value])
}

const _sendUpdatedControlValues = throttled(
    300,
    (patchPlayer: PatchPlayerWithSettings) => {
        const values: ControlsValues['values'] = {}
        Object.entries(patchPlayer.controlsValues.values).forEach(
            ([nodeId, value]) => {
                values[nodeId] =
                    typeof value === 'number' ? round(value) : value
            }
        )
        patchPlayer.settings.valuesUpdatedCallback!(values)
    }
)