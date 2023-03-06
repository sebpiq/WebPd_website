import { PdJson } from 'webpd'
import {
    sumPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
    Point,
} from './math-utils'
import { ControlModel } from './models'

export const CONTAINER_PADDING = 0.5
const GRID_DETECT_THRESHOLD_PX = 5

interface Control {
    type: 'control'
    label: string | null
    control: ControlModel
    dimensions: Point
    position: Point | null
}

interface ControlContainer {
    type: 'container'
    label: string | null
    control: ControlModel
    dimensions: Point
    children: Array<ControlView>
    position: Point | null
}

export type ControlView = Control | ControlContainer

export const createViews = (
    controls: Array<ControlModel>
): Array<ControlView> => {
    const controlsViews: Array<ControlView> = controls.map((control) => {
        if (control.type === 'container') {
            const nestedViews = createViews(control.children)
            const view: ControlContainer = {
                type: 'container',
                label: typeof control.node.args[0] === 'string' ? control.node.args[0]: null,
                control,
                dimensions: sumPoints(
                    { x: CONTAINER_PADDING * 2, y: CONTAINER_PADDING * 2 },
                    computeRectangleDimensions(
                        computePointsBoundingBox([
                            ...nestedViews.map((c) => c.position!),
                            ...nestedViews.map((c) =>
                                sumPoints(c.position!, c.dimensions)
                            ),
                        ])
                    )
                ),
                children: nestedViews,
                position: {
                    x: (control.node.layout!.x || 0) / 5,
                    y: (control.node.layout!.y || 0) / 5,
                },
            }
            return view
        } else {
            const label = _getNodeLabel(control.node.layout)
            const view: Control =  {
                type: 'control',
                label,
                control,
                dimensions: _getDimensionsGrid(
                    control.node.type,
                    control.node.args
                ),
                position: {
                    x: (control.node.layout!.x || 0) / 5,
                    y: (control.node.layout!.y || 0) / 5,
                },
            }
            return view
        }
    })

    // _computeLayout(controlsViews).forEach((column) =>
    //     column
    //         .filter((cell) => !!cell.controlView)
    //         .forEach(
    //             (cell) => (cell.controlView.position = { x: cell.x, y: cell.y })
    //         )
    // )

    return controlsViews.filter((controlView) => {
        // Can happen if 2 controls overlap, then only one of them will be placed in the grid
        if (!controlView.position) {
            console.warn(
                `control view "${controlView.label}" could not be assigned a position`
            )
        }
        return !!controlView.position
    })
}

const _getDimensionsGrid = (
    nodeType: PdJson.NodeType,
    nodeArgs: PdJson.NodeArgs
) => {
    switch (nodeType) {
        case 'floatatom':
        case 'symbolatom':
            return { x: 4, y: 2 }
        case 'bng':
        case 'tgl':
            return { x: 2, y: 2 }
        case 'nbx':
            return { x: 4, y: 2 }
        case 'vradio':
            return { x: 2, y: 2 * _assertNumber(nodeArgs[0]) }
        case 'hradio':
            return { x: 2 * _assertNumber(nodeArgs[0]), y: 2 }
        case 'vsl':
            return { x: 2, y: 8 }
        case 'hsl':
            return { x: 8, y: 2 }
        case 'msg':
            return { x: Math.round(nodeArgs.join(' ').length), y: 2 }
        default:
            throw new Error(`unsupported type ${nodeType}`)
    }
}

export const _computeLayout = (controlsViews: Array<ControlView>) => {
    const roughGrid = {
        x: {
            // controlsViews grouped by column
            grouped: [] as Array<Array<ControlView>>,
            // X for each column
            coordinates: [] as Array<number>,
            // width for each column
            sizes: [] as Array<number>,
        },
        y: {
            // controlsViews grouped by row
            grouped: [] as Array<Array<ControlView>>,
            // Y for each row
            coordinates: [] as Array<number>,
            // height for each column
            sizes: [] as Array<number>,
        },
    }

    // Start by creating a rough grid which groups the control views by rows
    // and by columns.
    ;(['x', 'y'] as const).forEach((axis) => {
        const grouped = roughGrid[axis].grouped
        const getCoordinate = (c: ControlView) => _assertNumber(c.control.node.layout![axis])
        controlsViews.forEach((controlView) => {
            const inserted = grouped.some((rowsOrColumns) => {
                // Try to assign `controlView` to an existing row or column
                if (
                    rowsOrColumns.some(
                        (otherControlView) =>
                            Math.abs(
                                getCoordinate(controlView) -
                                    getCoordinate(otherControlView)
                            ) < GRID_DETECT_THRESHOLD_PX
                    )
                ) {
                    rowsOrColumns.push(controlView)
                    return true
                }
            })

            // If it could not be inserted to an existing one, we create a new rowOrColumn,
            // and insert it in the right place in the list of rowsOrColumns.
            if (!inserted) {
                let i = 0
                while (
                    i < grouped.length &&
                    getCoordinate(grouped[i][0]) < getCoordinate(controlView)
                ) {
                    i++
                }
                grouped.splice(i, 0, [controlView])
            }

            // Assigns the coordinate for the row or column by taking
            // sizes of the largest controls in each column or row.
            // and stacking these max sizes.
            roughGrid[axis].sizes = grouped.map(
                (rowOrCol) =>
                    Math.max(
                        ...rowOrCol.map(
                            (controlView) => controlView.dimensions[axis]
                        )
                    ),
                []
            )

            roughGrid[axis].coordinates = roughGrid[axis].sizes
                .slice(0, -1)
                .reduce(
                    (coords, size) => [...coords, coords.slice(-1)[0] + size],
                    [0]
                )
        })
    })

    // Create a grid by placing controlViews in cells (col, row).
    const grid = roughGrid.x.grouped.map((column, colInd) =>
        roughGrid.y.grouped.map((row, rowInd) => {
            const controlView = row.filter((controlView) =>
                column.includes(controlView)
            )[0]
            return {
                x: roughGrid.x.coordinates[colInd],
                y: roughGrid.y.coordinates[rowInd],
                width: controlView ? controlView.dimensions.x : 0,
                controlView: controlView || null,
            }
        })
    )

    // Pack the layout more compactly by moving left all columns
    // that can be.
    grid.forEach((column, colInd) => {
        let dX = column[0].x
        column.forEach((cell, rowInd) => {
            if (cell.controlView === null) {
                return
            }
            grid.slice(0, colInd)
                .map((otherColumn) => otherColumn[rowInd])
                .forEach((otherCell) => {
                    if (otherCell.controlView === null) {
                        return
                    }
                    dX = Math.min(dX, cell.x - (otherCell.x + otherCell.width))
                })
        })
        if (dX) {
            grid.slice(colInd).forEach((column, j) => {
                column.forEach((cell) => (cell.x -= dX))
            })
        }
    })

    return grid
}

const _getNodeLabel = (layout: PdJson.ControlNode['layout']): string | null => {
    if (!layout) {
        throw new Error(`Node has no layout`)
    }
    const label = (layout as any).label as string
    return label.length ? label: null
}

const _assertNumber = (val: PdJson.NodeArg) => {
    if (typeof val !== 'number') {
        throw new Error(`Expected ${val} to be a number`)
    }
    return val
}