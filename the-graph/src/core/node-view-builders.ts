import { NodeViewBuilders, PortletView } from './types'

export const DEFAULT_ICON = 'icons/blank.svg'

const NODE_VIEW_BUILDERS: NodeViewBuilders = {
    loadbang: {
        build: () => {
            return {
                inlets: [],
                outlets: [{ type: 'message', name: 'bang' }],
            }
        },
        noArguments: true,
    },
    metro: {
        build: () => {
            return {
                inlets: [
                    { type: 'message', name: 'start/stop' },
                    { type: 'message', name: 'rate' },
                ],
                outlets: [{ type: 'message', name: 'tick' }],
            }
        },
        icon: 'icons/metronome.svg',
    },
    'tabplay~': {
        build: () => {
            return {
                inlets: [{ type: 'signal', name: 'message' }],
                outlets: [
                    { type: 'signal', name: 'output' },
                    { type: 'message', name: 'end reached' },
                ],
            }
        },
        icon: 'icons/soundwave.svg',
    },
    '*~': {
        build: () => {
            return {
                inlets: [
                    { type: 'signal', name: 'operand 1' },
                    { type: 'mixed', name: 'operand 2' },
                ],
                outlets: [{ type: 'signal', name: 'multiplication' }],
            }
        },
        icon: 'icons/multiply.svg',
    },
    '+~': {
        build: () => {
            return {
                inlets: [
                    { type: 'signal', name: 'operand 1' },
                    { type: 'mixed', name: 'operand 2' },
                ],
                outlets: [{ type: 'signal', name: 'sum' }],
            }
        },
        icon: 'icons/plus.svg',
    },
    'osc~': {
        build: () => {
            return {
                inlets: [
                    { type: 'mixed', name: 'frequency' },
                    { type: 'message', name: 'reset phase' },
                ],
                outlets: [{ type: 'signal', name: 'output' }],
            }
        },
        icon: 'icons/sine.svg',
    },
    'noise~': {
        build: () => {
            return {
                inlets: [],
                outlets: [{ type: 'signal', name: 'output' }],
            }
        },
        icon: 'icons/noise.svg',
        noArguments: true,
    },
    'dac~': {
        build: (_, engineSettings) => {
            const inlets: Array<PortletView> = []
            for (let i = 0; i < engineSettings.channelCount; i++) {
                inlets.push({ type: 'signal', name: `channel ${i}` })
            }
            return {
                inlets,
                outlets: [],
            }
        },
        icon: 'icons/speaker.svg',
    },
}

export default NODE_VIEW_BUILDERS
