import { throttled, sendMsgToWebPd } from './misc-utils'

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
        _msgBuilders: {},
        set(nodeId, value) {
            this._values[nodeId] = value

            const url = new URL(window.location)
            Object.entries(this._values).forEach(([nodeId, value]) => {
                url.searchParams.set(nodeId, JSON.stringify(value))
            })
            window.history.replaceState({}, document.title, url)

            const msgBuilder = this._msgBuilders[nodeId]
            if (!msgBuilder) {
                throw new Error(`no message builder for ${nodeId}`)
            }
            sendMsgToWebPd(STATE, nodeId, msgBuilder(value))
        },
        get(nodeId) {
            return this._values[nodeId]
        },
        register(nodeId, msgBuilder) {
            this._msgBuilders[nodeId] = msgBuilder
        },
        initialize() {
            Object.entries(this._values).forEach(([nodeId, value]) => {
                this.set(nodeId, value)
            })
        }
    },
}