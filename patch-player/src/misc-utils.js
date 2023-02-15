import { PORTLET_ID } from './pd-json'

export const nextTick = () => new Promise((resolve) => setTimeout(resolve, 1))

export const throttled = (delay, func) => {
    let timeout = null
    return (...args) => {
        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(() => func(...args), delay)
    }
}

export const sendMsgToWebPd = (STATE, nodeId, msg) => {
    STATE.webpdNode.port.postMessage({
        type: 'inletCaller',
        payload: {
            nodeId,
            portletId: PORTLET_ID,
            message: msg,
        },
    })
}