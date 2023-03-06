import { DspGraph, Message } from 'webpd'
import { PORTLET_ID } from './constants'
import { PatchPlayer } from './PatchPlayer'

export const nextTick = () => new Promise((resolve) => setTimeout(resolve, 1))

export const throttled = <P extends Array<any>>(
    delay: number,
    func: (...args: P) => void
) => {
    let timeout: number | null = null
    return (...args: P) => {
        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(() => func(...args), delay) as any
    }
}

export const sendMsgToWebPd = (
    patchPlayer: PatchPlayer,
    nodeId: DspGraph.NodeId,
    msg: Message
) => {
    ;(patchPlayer.webpdNode as any).port.postMessage({
        type: 'inletCaller',
        payload: {
            nodeId,
            portletId: PORTLET_ID,
            message: msg,
        },
    })
}

export const assertNonNullable = <T>(obj: T, errMessage?: string) => {
    if (!obj) {
        throw new Error(errMessage || `expected ${obj} to be defined`)
    }
    return obj
}