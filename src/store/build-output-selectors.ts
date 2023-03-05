import { createSelector } from '@reduxjs/toolkit'
import { build } from 'webpd'
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

export const selectBuildOutputFormatsAvailable = createSelector(
    selectBuildInputFormat,
    (inFormat) => {
        inFormat = inFormat || 'pd'
        return [
            ...Array.from(build.listOutputFormats(inFormat)).filter((format) =>
                INTERESTING_FORMATS.includes(format)
            ),
            'patchPlayer',
        ] as Array<BuildFormatWebSite>
    }
)