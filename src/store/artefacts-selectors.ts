import { RootState } from '.'
import { ASSETS } from './artefacts'

export const selectArtefacts = () => ASSETS.artefacts
export const selectArtefactsPatchPlayer = () => ASSETS.patchPlayer
export const selectArtefactsIsBuilding = (state: RootState) => state.artefacts.isBuilding
export const selectArtefactsStep = (state: RootState) => state.artefacts.step
export const selectArtefactsErrors = (state: RootState) => state.artefacts.errors