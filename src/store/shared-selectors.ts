import { createSelector } from '@reduxjs/toolkit'
import { Build } from 'webpd'
import { selectBuildInputFormat } from './build-input-selectors'
import {
    selectBuildOutputCodeTarget,
    selectBuildOutputFormat,
} from './build-output-selectors'

export const selectBuildSteps = createSelector(
    selectBuildInputFormat,
    selectBuildOutputFormat,
    selectBuildOutputCodeTarget,
    (inFormat, outFormat, codeTarget) => {
        console.log('selectBuildSteps CODE TARGET', codeTarget)
        if (!inFormat || !outFormat) {
            return null
        }
        if (outFormat === 'patchPlayer') {
            switch (codeTarget) {
                case 'JavaScript':
                    outFormat = 'compiledJs'
                    break
                case 'WebAssembly':
                    outFormat = 'wasm'
                    break
            }
        }
        if (
            outFormat === 'wav' &&
            ['pd', 'pdJson', 'dspGraph'].includes(inFormat)
        ) {
            return Build.listBuildSteps(
                inFormat,
                outFormat,
                codeTarget === 'JavaScript' ? 'compiledJs' : 'wasm'
            )
        } else {
            return Build.listBuildSteps(inFormat, outFormat)
        }
    }
)

export const selectBuildOutputHasExtraOptions = createSelector(
    selectBuildInputFormat,
    selectBuildOutputFormat,
    (inFormat, outFormat) => {
        if (!inFormat || !outFormat) {
            return null
        }
        if (
            ['pd', 'pdJson', 'dspGraph'].includes(inFormat) &&
            ['wav', 'patchPlayer'].includes(outFormat)
        ) {
            return true
        } else {
            return false
        }
    }
)

export const selectInletCallerSpecs = createSelector(
    selectBuildInputFormat,
    (inFormat) => {
        if (!inFormat) {
            return null
        }
        if (!['pd', 'pdJson'].includes(inFormat)) {
            return null
        }
    }
)
