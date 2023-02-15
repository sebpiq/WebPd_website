import assert from 'assert'
import { _computeLayout } from './views'

describe('views', () => {
    describe('_computeLayout', () => {
        it('should compute the layout properly', () => {
            const controlsViews = [
                {
                    dimensions: { x: 4, y: 1 },
                    control: { node: { layout: { x: 16, y: 18 } } },
                },
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 6, y: 1 } } },
                },
                {
                    dimensions: { x: 1, y: 1 },
                    control: { node: { layout: { x: 54, y: 0 } } },
                },
                {
                    dimensions: { x: 1, y: 1 },
                    control: { node: { layout: { x: 80, y: 0 } } },
                },
            ]

            const grid = _computeLayout(controlsViews)
            assert.strictEqual(grid.length, 4)
            assert.deepStrictEqual(grid[0], [
                {
                    x: 0,
                    y: 0,
                    width: 2,
                    controlView: controlsViews[1],
                },
                {
                    x: 0,
                    y: 1,
                    width: 0,
                    controlView: null,
                },
            ])
            assert.deepStrictEqual(grid[1], [
                {
                    x: 0,
                    y: 0,
                    width: 0,
                    controlView: null,
                },
                {
                    x: 0,
                    y: 1,
                    width: 4,
                    controlView: controlsViews[0],
                },
            ])
            assert.deepStrictEqual(grid[2], [
                {
                    x: 2,
                    y: 0,
                    width: 1,
                    controlView: controlsViews[2],
                },
                {
                    x: 2,
                    y: 1,
                    width: 0,
                    controlView: null,
                },
            ])
            assert.deepStrictEqual(grid[3], [
                {
                    x: 3,
                    y: 0,
                    width: 1,
                    controlView: controlsViews[3],
                },
                {
                    x: 3,
                    y: 1,
                    width: 0,
                    controlView: null,
                },
            ])
        })

        it('should compute this layout properly and avoid collisions', () => {
            const controlsViews = [
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 3, y: 0 } } },
                },
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 42, y: 0 } } },
                },
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 81, y: 30 } } },
                },
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 4, y: 53 } } },
                },
                {
                    dimensions: { x: 2, y: 1 },
                    control: { node: { layout: { x: 44, y: 53 } } },
                },
                {
                    dimensions: { x: 6, y: 1 },
                    control: { node: { layout: { x: 6, y: 30 } } },
                },
            ]
            const grid = _computeLayout(controlsViews)
            assert.strictEqual(grid.length, 3)

            assert.deepStrictEqual(grid[0], [
                {
                    x: 0,
                    y: 0,
                    width: 2,
                    controlView: controlsViews[0],
                },
                {
                    x: 0,
                    y: 1,
                    width: 6,
                    controlView: controlsViews[5],
                },
                {
                    x: 0,
                    y: 2,
                    width: 2,
                    controlView: controlsViews[3],
                },
            ])

            assert.deepStrictEqual(grid[1], [
                {
                    x: 2,
                    y: 0,
                    width: 2,
                    controlView: controlsViews[1],
                },
                {
                    x: 2,
                    y: 1,
                    width: 0,
                    controlView: null,
                },
                {
                    x: 2,
                    y: 2,
                    width: 2,
                    controlView: controlsViews[4],
                },
            ])

            assert.deepStrictEqual(grid[2], [
                {
                    x: 6,
                    y: 0,
                    width: 0,
                    controlView: null,
                },
                {
                    x: 6,
                    y: 1,
                    width: 2,
                    controlView: controlsViews[2],
                },
                {
                    x: 6,
                    y: 2,
                    width: 0,
                    controlView: null,
                },
            ])
        })

    })
})
