import { createSelector } from "@reduxjs/toolkit"
import { build } from "webpd"
import { RootState } from "."

export const selectBuildInputUrl = (state: RootState) => state.buildInput.url
export const selectBuildInputFilepath = (state: RootState) =>
    state.buildInput.filepath
export const selectBuildInputArrayBuffer = (state: RootState) =>
    state.buildInput.arrayBuffer

export const selectBuildInputFormat = createSelector(
    selectBuildInputUrl,
    selectBuildInputFilepath,
    (url, filepath) => {
        if (url) {
            return build.guessFormat(url)
        } else if (filepath) {
            return build.guessFormat(filepath)
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
        return build.preloadArtefact(
            build.createArtefacts(),
            arrayBuffer,
            inFormat
        )
    }
)
