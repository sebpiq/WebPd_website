import { createSelector } from '@reduxjs/toolkit'
import { build } from 'webpd'
import {
    selectArtefacts,
    selectArtefactsIsBuilding,
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
        if (
            outFormat === 'wav' &&
            ['pd', 'pdJson', 'dspGraph'].includes(inFormat)
        ) {
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

export const selectIsBuildingComplete = createSelector(
    selectArtefactsIsBuilding,
    selectBuildSteps,
    selectArtefacts,
    (isBuilding, buildSteps, artefacts) => {
        if (isBuilding) {
            return false
        }
        
        const outFormat = (buildSteps ? buildSteps.slice(-1)[0] : null)
        if (!outFormat) {
            return false
        }
        return !!artefacts[outFormat]
    }
)

export const selectBuildOutputHasExtraOptions = createSelector(
    selectBuildInputFormat,
    selectBuildOutputFormat,
    selectArtefactsIsBuilding,
    selectIsBuildingComplete,
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

export const selectInletCallerSpecs = createSelector(selectBuildInputFormat, (inFormat) => {
    if (!inFormat) {
        return null
    }
    if (!['pd', 'pdJson'].includes(inFormat)) {
        return null
    }
    
})