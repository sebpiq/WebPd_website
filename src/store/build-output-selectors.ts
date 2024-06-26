import { createSelector } from '@reduxjs/toolkit'
import { Build } from 'webpd'
import { RootState } from '.'
import { BuildFormatWebSite } from '../types'
import { selectBuildInputFormat } from './build-input-selectors'
import { AVAILABLE_OUTPUT_FORMATS } from './build-output'

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
            ...AVAILABLE_OUTPUT_FORMATS.filter((format) =>
                outputFormats.has(format)
            ),
        ] as Array<BuildFormatWebSite>
    }
)