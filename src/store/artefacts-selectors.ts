import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '.'
import { selectBuildOutputFormat } from './build-output-selectors'

export const selectArtefacts = (state: RootState) => state.artefacts.artefacts
export const selectArtefactsIsBuilding = (state: RootState) => state.artefacts.isBuilding
export const selectArtefactsStep = (state: RootState) => state.artefacts.step
export const selectArtefactsErrors = (state: RootState) => state.artefacts.errors

export const selectArtefactsIsBuildingComplete = createSelector(
    selectBuildOutputFormat,
    selectArtefactsStep,
    (targetOutFormat, currentFormat) => targetOutFormat === currentFormat
)
