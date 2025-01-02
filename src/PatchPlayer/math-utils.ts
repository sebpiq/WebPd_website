import { Point, Rectangle } from "./types"

export const sumPoints = (p1: Point, p2: Point) => ({
    x: p1.x + p2.x,
    y: p1.y + p2.y,
})

export const scalePoint = (p1: Point, r: number) => ({
    x: p1.x * r,
    y: p1.y * r,
})

export const computePointsBoundingBox = (points: Array<Point>) => points.reduce(
    ({ topLeft, bottomRight }, point) => {
        return {
            topLeft: {
                x: Math.min(point.x, topLeft.x),
                y: Math.min(point.y, topLeft.y),
            },
            bottomRight: {
                x: Math.max(point.x, bottomRight.x),
                y: Math.max(point.y, bottomRight.y),
            },
        }
    },
    {
        topLeft: { x: Infinity, y: Infinity },
        bottomRight: { x: -Infinity, y: -Infinity },
    }
)

export const computeRectangleDimensions = (r: Rectangle) => ({
    x: r.bottomRight.x - r.topLeft.x,
    y: r.bottomRight.y - r.topLeft.y,
})

export const round = (v: number, decimals = 5) => {
    const rounded =
        Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals)
    if (rounded === 0) {
        return 0
    }
    return rounded
}