import { RootState } from '.'

export const selectAppIsInitialized = (state: RootState) =>
    state.app.isInitialized
export const selectAppWillBuildOnLoad = (state: RootState) =>
    state.app.willBuildOnLoad
