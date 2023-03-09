import assert from 'assert'
import {
    computePointsBoundingBox,
} from './math-utils'

describe('math-utils', () => {

    describe('computePointsBoundingBox', () => {
        it('should return points bounding box', () => {
            assert.deepStrictEqual(computePointsBoundingBox([
                { x: 1, y: 11 },
                { x: 2, y: -4 },
                { x: 11.78, y: 4.5 },
                { x: -2, y: -1 },
            ]), {
                topLeft: { x: -2, y: -4 },
                bottomRight: { x: 11.78, y: 11 },
            })
        })
    })

})
