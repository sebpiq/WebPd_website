
export const makeTranslationTransform = (fromPoint, toPoint) => {
    const xOffset = toPoint.x - fromPoint.x
    const yOffset = toPoint.y - fromPoint.y
    return (fromPoint) => {
        return {
            x: fromPoint.x + xOffset,
            y: fromPoint.y + yOffset,
        }
    }
}

export const addPoints = (p1, p2) => ({
    x: p1.x + p2.x,
    y: p1.y + p2.y,
})

export const scalePoint = (p1, r) => ({
    x: p1.x * r,
    y: p1.y * r,
})

export const computeRectanglesIntersection = (r1, r2) => {
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

export const isPointInsideRectangle = (p, r) =>
    r.topLeft.x <= p.x && p.x <= r.bottomRight.x 
    && r.topLeft.y <= p.y && p.y <= r.bottomRight.y 

export const arePointsEqual = (p1, p2) => {
    return p1.x === p2.x && p1.y === p2.y
}

export const areRectanglesEqual = (bb1, bb2) => {
    return (arePointsEqual(bb1.topLeft, bb2.topLeft) 
        && arePointsEqual(bb1.bottomRight, bb2.bottomRight))
}

export const computePointsBoundingBox = (points) => points.reduce(
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

export const computeRectangleDimensions = (r) => ({
    x: r.bottomRight.x - r.topLeft.x,
    y: r.bottomRight.y - r.topLeft.y,
})