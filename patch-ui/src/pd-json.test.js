import assert from 'assert'
import { getControlsFromPdJson } from './pd-json'

describe('pd-json-utils', () => {
    describe('getControlsFromPdJson', () => {
        it('should compute proper transform function', () => {
            const pd = {
                patches: {
                    0: {
                        id: '0',
                        nodes: {
                            0: {
                                id: '0',
                                type: 'bla',
                                layout: { x: 0, y: 0, width: 0, height: 0 },
                            },
                            1: {
                                id: '1',
                                type: 'hsl',
                                layout: { x: 10, y: 20, width: 25, height: 75 },
                            },
                            2: {
                                id: '2',
                                type: 'pd',
                                layout: { x: 0, y: 0, width: 0, height: 0 },
                                patchId: '1',
                            },
                        },
                        layout: {
                            windowX: 0,
                            windowY: 0,
                            windowWidth: 1000,
                            windowHeight: 1000,
                        },
                    },
                    1: {
                        id: '1',
                        nodes: {
                            0: {
                                id: '0',
                                type: 'bla',
                                layout: { x: 0, y: 0, width: 0, height: 0 },
                            },
                            // Is inside viewport
                            1: {
                                id: '1',
                                type: 'vsl',
                                layout: { x: 100, y: 100, width: 25, height: 150 },
                            },
                            // Is outside of viewport
                            2: {
                                id: '2',
                                type: 'tgl',
                                layout: { x: 0, y: 0, size: 10 },
                            },
                            3: {
                                id: '2',
                                type: 'pd',
                                layout: { x: 112, y: 112, width: 25, height: 150 },
                                patchId: '2',
                            },
                        },
                        layout: {
                            graphOnParent: 1,
                            viewportX: 100,
                            viewportY: 100,
                            viewportWidth: 25,
                            viewportHeight: 150,
                        },
                    },
                    2: {
                        id: '2',
                        nodes: {
                            0: {
                                id: '0',
                                type: 'bla',
                                layout: { x: 0, y: 0, width: 0, height: 0 },
                            },
                            // Is inside viewport, but outside of intersection with parent viewport
                            1: {
                                id: '1',
                                type: 'hradio',
                                args: [10],
                                layout: { x: 80, y: 0, width: 100, height: 10 },
                            },
                            // Is inside viewport
                            2: {
                                id: '2',
                                type: 'tgl',
                                layout: { x: 2, y: 2, size: 5 },
                            },
                            3: {
                                id: '2',
                                type: 'pd',
                                layout: { x: -1000, y: -1000, width: 0, height: 0 },
                                patchId: '1',
                            },
                        },
                        layout: {
                            graphOnParent: 1,
                            viewportX: 0,
                            viewportY: 0,
                            viewportWidth: 1000,
                            viewportHeight: 1000,
                        },
                    },
                },
            }

            let controls = getControlsFromPdJson(pd, pd.patches['0']).sort((a, b) => ('' + a.graphNodeId).localeCompare(b.graphNodeId))
            let nextControls
            
            // patch 0
            assert.strictEqual(controls.length, 2)
            assert.deepStrictEqual(controls[0], {
                graphNodeId: 'n_0_1',
                type: 'control',
                pdNode: pd.patches['0'].nodes['1']
            })
            nextControls = controls[1].controls
            delete controls[1].controls
            assert.deepStrictEqual(controls[1], {
                type: 'container',
                boundingBox: {
                    topLeft: {x: 0, y: 0},
                    bottomRight: {x: 25, y: 150}
                }
            })

            // subpatch 1
            controls = nextControls
            assert.strictEqual(controls.length, 2)
            assert.deepStrictEqual(controls[0], {
                graphNodeId: 'n_1_1',
                type: 'control',
                pdNode: pd.patches['1'].nodes['1']
            })
            nextControls = controls[1].controls
            delete controls[1].controls
            assert.deepStrictEqual(controls[1], {
                type: 'container',
                boundingBox: {
                    topLeft: {x: 112, y: 112},
                    bottomRight: {x: 125, y: 250}
                }
            })

            // subpatch 2
            controls = nextControls
            assert.strictEqual(controls.length, 1)
            assert.deepStrictEqual(controls[0], {
                graphNodeId: 'n_2_2',
                type: 'control',
                pdNode: pd.patches['2'].nodes['2']
            })
        })
    })
})
