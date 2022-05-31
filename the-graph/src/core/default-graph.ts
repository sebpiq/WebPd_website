import {GraphJson} from 'fbp-graph/src/Types'

const DEFAULT_GRAPH: GraphJson = {
    properties: {
        name: 'photobooth',
        environment: {
            runtime: 'html',
            src: 'preview/iframe.html',
            width: 300,
            height: 300,
        },
    },
    processes: {
        osc_1: {
            component: 'osc~',
            metadata: {
                x: 324,
                y: 144,
                label: 'osc~',
            },
        },
        dac_1: {
            component: 'dac~',
            metadata: {
                x: 480,
                y: 144,
                label: 'dac~',
            },
        },
    },
    connections: [
        {
            src: {
                process: 'osc_1',
                port: '0',
            },
            tgt: {
                process: 'dac_1',
                port: '0',
            },
            metadata: {
                route: '10',
            },
        },
        {
            src: {
                process: 'osc_1',
                port: '0',
            },
            tgt: {
                process: 'dac_1',
                port: '1',
            },
            metadata: {
                route: '10',
            },
        },
        {
            data: 220,
            tgt: {
                process: 'osc_1',
                port: 'frequency',
            },
        },
    ],
}

export default DEFAULT_GRAPH