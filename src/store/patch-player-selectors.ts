import { RootState } from '.'
import { ASSETS } from './patch-player'

export const selectPatchPlayerValues = (state: RootState) =>
    state.patchPlayer.values
export const selectPatchPlayer = () => ASSETS.patchPlayer