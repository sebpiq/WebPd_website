import {
    addPoints,
    computePointsBoundingBox,
    computeRectangleDimensions,
} from './math-utils'

export const CONTAINER_PADDING = 0.5
const GRID_DETECT_THRESHOLD_PX = 5

export const createViews = (STATE, controls = null) => {
    if (controls === null) {
        controls = STATE.controls
    }

    const controlsViews = controls.map((control) => {
        if (control.type === 'container') {
            const nestedViews = createViews(STATE, control.children)
            return _buildContainerView(control, nestedViews)
        } else if (control.type === 'control') {
            return _buildControlView(control)
        }
    })

    _computeLayout(controlsViews)
        .forEach((column) =>
            column
                .filter((cell) => !!cell.controlView)
                .forEach(
                    (cell) => (cell.controlView.position = { x: cell.x, y: cell.y })
                )
        )
    
    return controlsViews.filter(controlView => {
        // Can happen if 2 controls overlap, then only one of them will be placed in the grid 
        if (!controlView.position) {
            console.warn(`control view "${controlView.label}" could not be assigned a position`)
        }
        return controlView.position
    })
}

const _buildContainerView = (control, children) => ({
    type: 'container',
    label: control.node.args[0] || null,
    control,
    dimensions: addPoints(
        { x: CONTAINER_PADDING * 2, y: CONTAINER_PADDING * 2 },
        computeRectangleDimensions(
            computePointsBoundingBox([
                ...children.map((c) => c.position),
                ...children.map((c) => addPoints(c.position, c.dimensions)),
            ])
        )
    ),
    children,
    position: null,
})

const _buildControlView = (control) => ({
    type: 'control',
    label: (control.node.layout.label && control.node.layout.label.length) ? control.node.layout.label : null,
    control,
    dimensions: _getDimensionsGrid(control.node.type, control.node.args),
    position: null,
})

const _getDimensionsGrid = (nodeType, nodeArgs) => {
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
            return { x: 2, y: 2 * nodeArgs[0] }
        case 'hradio':
            return { x: 2 * nodeArgs[0], y: 2 }
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

export const _computeLayout = (controlsViews) => {
    const roughGrid = {
        x: {
            // controlsViews grouped by column
            grouped: [],
            // X for each column
            coordinates: [],
            // width for each column
            sizes: [],
        },
        y: {
            // controlsViews grouped by row
            grouped: [],
            // Y for each row
            coordinates: [],
            // height for each column
            sizes: [],
        },
    }

    // Start by creating a rough grid which groups the control views by rows
    // and by columns. 
    Object.keys(roughGrid).forEach((axis) => {
        const grouped = roughGrid[axis].grouped
        const getCoordinate = (c) => c.control.node.layout[axis]
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
                .reduce((coords, size) => [...coords, coords.slice(-1)[0] + size], [0])
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
                width: controlView ? controlView.dimensions.x: 0,
                controlView: controlView || null,
            }
        })
    )

    // Pack the layout more compactly by moving left all columns 
    // that can be.
    grid.forEach((column, colInd) => {
        let dX = column[0].x
        column
            .forEach((cell, rowInd) => {
                if (cell.controlView === null) {
                    return
                }
                grid.slice(0, colInd)
                    .map((otherColumn) => otherColumn[rowInd])
                    .forEach((otherCell) => {
                        if (otherCell.controlView === null) {
                            return
                        }
                        dX = Math.min(
                            dX,
                            cell.x - (otherCell.x + otherCell.width)
                        )
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
