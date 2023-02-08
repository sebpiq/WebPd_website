import assert from 'assert'
import {
    makeTranslationTransform,
    computeRectanglesIntersection,
    arePointsEqual,
    areRectanglesEqual,
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
