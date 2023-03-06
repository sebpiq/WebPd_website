import { RootState } from '.'
import { ASSETS } from './artefacts'

export const selectArtefacts = () => ASSETS.artefacts
export const selectArtefactsPatchPlayer = () => ASSETS.patchPlayer
export const selectArtefactsBuildStatus = (state: RootState) => state.artefacts.buildStatus
export const selectArtefactsStep = (state: RootState) => state.artefacts.step