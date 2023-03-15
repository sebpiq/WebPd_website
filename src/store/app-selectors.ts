import { RootState } from '.'

export const selectAppIsInitialized = (state: RootState) =>
    state.app.isInitialized
export const selectAppWillBuildOnLoad = (state: RootState) =>
    state.app.willBuildOnLoad
export const selectAppDebug = (state: RootState) =>
    state.app.debug
