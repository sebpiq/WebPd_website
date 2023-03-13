import { createSelector } from '@reduxjs/toolkit'
import { Build } from 'webpd'
import { RootState } from '.'
import { BuildFormatWebSite } from '../types'
import { selectBuildInputFormat } from './build-input-selectors'

const INTERESTING_FORMATS: Array<BuildFormatWebSite> = [
    'wasm',
    'wav',
    'patchPlayer',
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
        return [
            ...Array.from(Build.listOutputFormats(inFormat)).filter((format) =>
                INTERESTING_FORMATS.includes(format)
            ),
            'patchPlayer',
        ] as Array<BuildFormatWebSite>
    }
)