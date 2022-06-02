import { NodeViewBuilders, PortletView } from "./types";

const NODE_VIEW_BUILDERS: NodeViewBuilders = {
    '*~': {
        build: () => {
            return {
                inlets: [
                    {type: 'signal', name: 'operand 1'},
                    {type: 'mixed', name: 'operand 2'},
                ],
                outlets: [
                    {type: 'signal', name: 'multiplication'},
                ]
            }
        }
    },
    '+~': {
        build: () => {
            return {
                inlets: [
                    {type: 'signal', name: 'operand 1'},
                    {type: 'mixed', name: 'operand 2'},
                ],
                outlets: [
                    {type: 'signal', name: 'sum'},
                ]
            }
        }
    },
    'osc~': {
        build: () => {
            return {
                inlets: [
                    {type: 'mixed', name: 'frequency'},
                    {type: 'control', name: 'reset phase'},
                ],
                outlets: [
                    {type: 'signal', name: 'output'},
                ]
            }
        }
    },
    'dac~': {
        build: (_, engineSettings) => {
            const inlets: Array<PortletView> = []
            for (let i = 0; i < engineSettings.channelCount; i++) {
                inlets.push({type: 'signal', name: `channel ${i}`})
            }
            return {
                inlets,
                outlets: []
            }
        }
    }
}

export default NODE_VIEW_BUILDERS