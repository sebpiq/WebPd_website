
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

export const arePointsEqual = (p1, p2) => {
    return p1.x === p2.x && p1.y === p2.y
}

export const areRectanglesEqual = (bb1, bb2) => {
    return (arePointsEqual(bb1.topLeft, bb2.topLeft) 
        && arePointsEqual(bb1.bottomRight, bb2.bottomRight))
}