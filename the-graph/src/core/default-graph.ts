import {GraphJson} from 'fbp-graph/src/Types'

const DEFAULT_GRAPH: GraphJson = {
    properties: {
        name: 'photobooth',
        environment: {
            runtime: 'html',
            src: 'preview/iframe.html',
            width: 300,
            height: 300,
            content:
                '    <video id="vid" autoplay loop width="640" height="480" style="display:none;"></video>\n    <canvas id="out" width="640" height="480" style="max-width:100%;"></canvas>\n\n<input id="slider" type="range" min="0" max="1" value="0.5" step="0.01"></input>\n    <button id="start">start camera</button>\n    <button id="prev">prev</button>\n    <button id="next">next</button>\n    <button id="save">save</button>\n\n<style>\n  #saved img { width: 160px; height: 120px;}\n</style>\n<div id="saved"></div>',
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