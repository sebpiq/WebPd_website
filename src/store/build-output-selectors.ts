import { createSelector } from '@reduxjs/toolkit'
import { Build } from 'webpd'
import { RootState } from '.'
import { BuildFormatWebSite } from '../types'
import { selectBuildInputFormat } from './build-input-selectors'

const INTERESTING_FORMATS: Array<Build.BuildFormat> = [
    'wav',
    'wasm',
]

export const selectBuildOutputFormat = (state: RootState) =>
    state.buildOutput.format
export const selectBuildOutputCodeTarget = (state: RootState) =>
    state.buildOutput.codeTarget
export const selectBuildOutputPreviewDurationSeconds = (state: RootState) =>
    state.buildOutput.previewDurationSeconds

export const selectBuildOutputFormatsAvailable = createSelector(
    selectBuildInputFormat,
    (inFormat) => {
        inFormat = inFormat || 'pd'
        const outputFormats = Build.listOutputFormats(inFormat)
        return [
            'patchPlayer',
            ...INTERESTING_FORMATS.filter((format) =>
                outputFormats.has(format)
            ),
        ] as Array<BuildFormatWebSite>
    }
)