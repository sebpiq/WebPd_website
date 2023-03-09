import { createSelector } from "@reduxjs/toolkit"
import { Build } from "webpd"
import { RootState } from "."

export const selectBuildInputUrl = (state: RootState) => state.buildInput.url
export const selectBuildInputFilepath = (state: RootState) =>
    state.buildInput.filepath
export const selectBuildInputArrayBuffer = (state: RootState) =>
    state.buildInput.arrayBuffer
export const selectBuildInputFocusOn = (state: RootState) =>
    state.buildInput.focusOn

export const selectBuildInputFormat = createSelector(
    selectBuildInputUrl,
    selectBuildInputFilepath,
    (url, filepath) => {
        let filepathOrUrl = url || filepath
        if (filepathOrUrl) {
            return Build.guessFormat(filepathOrUrl) || 'pd'

        } else {
            return null
        }
    }
)

export const selectBuildInputArtefacts = createSelector(
    selectBuildInputFormat,
    selectBuildInputArrayBuffer,
    (inFormat, arrayBuffer) => {
        if (inFormat === null || arrayBuffer === null) {
            return null
        }
        return Build.preloadArtefact(
            Build.createArtefacts(),
            arrayBuffer,
            inFormat
        )
    }
)