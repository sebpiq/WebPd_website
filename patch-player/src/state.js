import { sendMsgToWebPd } from './misc-utils'
import { round } from './math-utils'

export const loadStateFromUrl = () => {
    const rawParams = new URLSearchParams(document.location.search)
    STATE.params = {
        patch: rawParams.get('patch') || './ginger2.pd',
        target: rawParams.get('target')  || 'javascript',
    }

    // We consider that all other unknown params are control values
    Array.from(rawParams).forEach(([key, rawValue]) => {
        if (!(key in STATE.params)) {
            const value = JSON.parse(rawValue)
            STATE.controlsValues._values[key] = value
        }
    })
}

export const STATE = {
    audioContext: new AudioContext(),
    webpdNode: null,
    pdJson: null,
    controls: null,
    controlsViews: null,
    controlsValues: {
        _values: {},
        _valueTransforms: {},
        set(nodeId, rawValue) {
            const valueTransform = this._valueTransforms[nodeId]
            if (!valueTransform) {
                throw new Error(`no value transform for ${nodeId}`)
            }
            this._set(nodeId, valueTransform(rawValue))
        },
        _set(nodeId, value) {
            this._values[nodeId] = value
            const url = new URL(window.location)
            Object.entries(this._values).forEach(([nodeId, value]) => {
                const paramValue = typeof value === 'number' ? round(value) : value
                url.searchParams.set(nodeId, JSON.stringify(paramValue))
            })
            window.history.replaceState({}, document.title, url)
            sendMsgToWebPd(STATE, nodeId, [value])
        },
        get(nodeId) {
            return this._values[nodeId]
        },
        register(nodeId, valueTransform) {
            this._valueTransforms[nodeId] = valueTransform
        },
        initialize() {
            Object.entries(this._values).forEach(([nodeId, value]) => {
                this._set(nodeId, value)
            })
        }
    },
}