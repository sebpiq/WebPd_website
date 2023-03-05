import { createSelector } from '@reduxjs/toolkit'
import { build, BuildFormat } from 'webpd'
import {
    selectArtefactsIsBuilding,
    selectArtefactsIsBuildingComplete,
} from './artefacts-selectors'
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
        if (outFormat === 'wav' && ['pd', 'pdJson', 'dspGraph'].includes(inFormat)) {
            return build.listBuildSteps(
                inFormat,
                outFormat,
                codeTarget === 'JavaScript' ? 'compiledJs' : 'wasm'
            )
        } else {
            return build.listBuildSteps(inFormat, outFormat)
        }
    }
)

export const selectBuildOutputHasExtraOptions = createSelector(
    selectBuildInputFormat,
    selectBuildOutputFormat,
    selectArtefactsIsBuilding,
    selectArtefactsIsBuildingComplete,
    (inFormat, outFormat, isBuilding, isBuildingComplete) => {
        if (!inFormat || !outFormat) {
            return null
        }
        if (
            ['pd', 'pdJson', 'dspGraph'].includes(inFormat) &&
            ['wav', 'patchPlayer'].includes(outFormat) &&
            !isBuilding &&
            !isBuildingComplete
        ) {
            return true
        } else {
            return false
        }
    }
)
