import assert from 'assert'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    arePointsEqual,
    areRectanglesEqual,
    isPointInsideRectangle,
    computePointsBoundingBox,
} from './math-utils'

describe('math-utils', () => {
    describe('makeTranslationTransform', () => {
        it('should compute proper transform function', () => {
            const transform = makeTranslationTransform(
                { x: 1, y: 2 },
                { x: 10, y: -4 }
            )
            assert.deepStrictEqual(transform({ x: 0, y: 0 }), { x: 9, y: -6 })
            assert.deepStrictEqual(transform({ x: 10, y: 1 }), { x: 19, y: -5 })
        })
    })

    describe('arePointsEqual', () => {
        it('should return true for points that are equal', () => {
            assert.strictEqual(arePointsEqual(
                { x: 1, y: -4 },
                { x: 1, y: -4 }
            ), true)
        })

        it('should return false for points that are not equal', () => {
            assert.strictEqual(arePointsEqual(
                { x: 1, y: 2 },
                { x: 10, y: -4 }
            ), false)
        })
    })

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

    describe('isPointInsideRectangle', () => {
        it('should return true if point is inside rectangle', () => {
            assert.strictEqual( 
                isPointInsideRectangle(
                    { x: 9, y: 2.5 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                true
            )
        })

        it('should return false if point is outside rectangle', () => {
            assert.strictEqual( 
                isPointInsideRectangle(
                    { x: 19, y: 2.5 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                false
            )
        })

        it('should return true if point is on rectangle border', () => {
            assert.strictEqual( 
                isPointInsideRectangle(
                    { x: 9, y: 13 },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                true
            )
        })
    })

    describe('areRectanglesEqual', () => {
        it('should return true if rectangles are equal', () => {
            assert.strictEqual( 
                areRectanglesEqual(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                true
            )
        })

        it('should return false if rectangles are not equal', () => {
            assert.strictEqual( 
                areRectanglesEqual(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 1, y: 2.5 },
                        bottomRight: { x: 10, y: 13 },
                    }
                ),
                false
            )
        })
    })

    describe('computeRectanglesIntersection', () => {
        it('should compute intersection for simple intersecting rectangles', () => {
            assert.deepStrictEqual( 
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 15, y: 16 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 10, y: 13 },
                }
            )
        })

        it('should compute intersection for one rectangle inside the other', () => {
            assert.deepStrictEqual( 
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 9, y: 13 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 9, y: 13 },
                }
            )
        })

        it('should work with infinity rectangle', () => {
            assert.deepStrictEqual( 
                computeRectanglesIntersection(
                    {
                        topLeft: { x: -Infinity, y: -Infinity },
                        bottomRight: { x: Infinity, y: Infinity },
                    },
                    {
                        topLeft: { x: 5, y: 4 },
                        bottomRight: { x: 9, y: 13 },
                    }
                ),
                {
                    topLeft: { x: 5, y: 4 },
                    bottomRight: { x: 9, y: 13 },
                }
            )
        })

        it('should compute empty intersection for disjoint rectangles', () => {
            assert.deepStrictEqual( 
                computeRectanglesIntersection(
                    {
                        topLeft: { x: 1, y: 2 },
                        bottomRight: { x: 10, y: 13 },
                    },
                    {
                        topLeft: { x: 11, y: 13 },
                        bottomRight: { x: 15, y: 19 },
                    }
                ),
                null
            )
        })
    })
})
