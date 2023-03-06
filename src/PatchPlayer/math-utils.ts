export interface Point {
    x: number
    y: number
}

export interface Rectangle {
    topLeft: Point,
    bottomRight: Point,
}

export const makeTranslationTransform = (fromPoint: Point, toPoint: Point) => {
    const xOffset = toPoint.x - fromPoint.x
    const yOffset = toPoint.y - fromPoint.y
    return (fromPoint: Point) => {
        return {
            x: fromPoint.x + xOffset,
            y: fromPoint.y + yOffset,
        }
    }
}

export const sumPoints = (p1: Point, p2: Point) => ({
    x: p1.x + p2.x,
    y: p1.y + p2.y,
})

export const scalePoint = (p1: Point, r: number) => ({
    x: p1.x * r,
    y: p1.y * r,
})

export const computeRectanglesIntersection = (r1: Rectangle, r2: Rectangle) => {
    const topLeft = {
        x: Math.max(r1.topLeft.x, r2.topLeft.x),
        y: Math.max(r1.topLeft.y, r2.topLeft.y),
    }
    const bottomRight = {
        x: Math.min(r1.bottomRight.x, r2.bottomRight.x),
        y: Math.min(r1.bottomRight.y, r2.bottomRight.y),
    }
    if (bottomRight.x <= topLeft.x || bottomRight.y <= topLeft.y) {
        return null
    } else {
        return { topLeft, bottomRight }
    }
}

export const isPointInsideRectangle = (p: Point, r: Rectangle) =>
    r.topLeft.x <= p.x && p.x <= r.bottomRight.x 
    && r.topLeft.y <= p.y && p.y <= r.bottomRight.y 

export const arePointsEqual = (p1: Point, p2: Point) => {
    return p1.x === p2.x && p1.y === p2.y
}

export const areRectanglesEqual = (bb1: Rectangle, bb2: Rectangle) => {
    return (arePointsEqual(bb1.topLeft, bb2.topLeft) 
        && arePointsEqual(bb1.bottomRight, bb2.bottomRight))
}

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