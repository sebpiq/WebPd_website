import { DspGraph, Message } from 'webpd'
import { round } from './math-utils'
import { throttled, timeout } from './misc-utils'
import {
    Controller,
    PatchPlayerWithSettings,
    ConvertNexusValueFunction,
    OnMessageFromWebPdCallback,
    ControlView,
} from './types'
import { PORTLET_ID } from './constants'

export const registerView = (
    patchPlayer: PatchPlayerWithSettings,
    controlView: ControlView
) => {
    const { nodeId, pdNode, nexusElem } = controlView

    let convertNexusValue: ConvertNexusValueFunction = (v) => v
    switch (pdNode.type) {
        case 'bng':
            convertNexusValue = (v: any) => (v.state === true ? 'bang' : null)
            break

        case 'msg':
            convertNexusValue = (v: any) => (v === true ? 'bang' : null)
            break

        case 'tgl':
            convertNexusValue = (v) => +v
            break
    }

    let onMessageFromWebPd: OnMessageFromWebPdCallback = () => {}
    switch (pdNode.type) {
        case 'hsl':
        case 'vsl':
        case 'nbx':
        case 'floatatom':
            onMessageFromWebPd = (nexusElem, value) => {
                nexusElem.value = value
            }
            break

        case 'hradio':
        case 'vradio':
            onMessageFromWebPd = (nexusElem, value) => {
                nexusElem.select(value)
            }
            break

        case 'bng':
        case 'msg':
            onMessageFromWebPd = (nexusElem) => {
                nexusElem.turnOn(false)
                timeout(50).then(() => nexusElem.turnOff(false))
            }
            break

        case 'tgl':
            onMessageFromWebPd = (nexusElem, value) => {
                if (value === 1) {
                    nexusElem.turnOn(false)
                } else {
                    nexusElem.turnOff(false)
                }
            }
            break
    }

    patchPlayer.controller.functions[nodeId] = {
        convertNexusValue,
        onMessageFromWebPd,
    }

    nexusElem._isBeingChangedByUser = false
    nexusElem.on('change', function (this: typeof Nexus, v: number) {
        _onControlActivatedByUser.call(this, patchPlayer, nodeId, v)
    })
    nexusElem.on('click', function (this: typeof Nexus) {
        this._isBeingChangedByUser = true
    })
    nexusElem.on('release', function (this: typeof Nexus) {
        this._isBeingChangedByUser = false
    })
}

export const initializeValues = (patchPlayer: PatchPlayerWithSettings) => {
    Object.entries(patchPlayer.controller.values).forEach(([nodeId, value]) => {
        _sendMsgToWebPd(patchPlayer, nodeId, [value])
    })
}

export const getCurrentValue = (
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId
) => patchPlayer.controller.values[nodeId]

function _onControlActivatedByUser(
    this: typeof Nexus,
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId,
    rawValue: number
) {
    // Allows to avoid triggering the callback when we change the control value programmatically
    // Ref : https://github.com/nexus-js/ui/issues/218
    if (this.clicked !== true) {
        return
    }

    const functions = _getControllerFunctionsForNodeId(patchPlayer, nodeId)
    const value = functions.convertNexusValue(rawValue)!
    if (value === null) {
        return
    }

    patchPlayer.controller.values[nodeId] = value
    if (patchPlayer.settings.valuesUpdatedCallback) {
        _callValuesUpdatedCallback(patchPlayer)
    }
    _sendMsgToWebPd(patchPlayer, nodeId, [value])
}

const _callValuesUpdatedCallback = throttled(
    300,
    (patchPlayer: PatchPlayerWithSettings) => {
        const values: Controller['values'] = {}
        Object.entries(patchPlayer.controller.values).forEach(
            ([nodeId, value]) => {
                values[nodeId] =
                    typeof value === 'number' ? round(value) : value
            }
        )
        patchPlayer.settings.valuesUpdatedCallback!(values)
    }
)

const _sendMsgToWebPd = (
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId,
    msg: Message
) => {
    patchPlayer.webpdNode.port.postMessage({
        type: 'io:messageReceiver',
        payload: {
            nodeId,
            portletId: PORTLET_ID,
            message: msg,
        },
    })
}

export const receiveMsgFromWebPd = (
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId,
    _: DspGraph.PortletId,
    message: Message
) => {
    patchPlayer.controller.values[nodeId] = message[0]
    const controlView = patchPlayer.views.indexed[nodeId]
    // If the control is being changed by the user, 
    // we don't want to update the Nexus element value, because
    // it would create a feedback loop with the user input.
    if (controlView.nexusElem._isBeingChangedByUser) {
        return
    }
    const functions = _getControllerFunctionsForNodeId(patchPlayer, nodeId)
    console.log('message[0]', message[0], controlView.nexusElem)
    functions.onMessageFromWebPd(controlView.nexusElem, message[0])
}

const _getControllerFunctionsForNodeId = (
    patchPlayer: PatchPlayerWithSettings,
    nodeId: DspGraph.NodeId
) => {
    const functions = patchPlayer.controller.functions[nodeId]
    if (!functions) {
        throw new Error(`no value transform for ${nodeId}`)
    }
    return functions
}