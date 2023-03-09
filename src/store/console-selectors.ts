import { RootState } from '.'

export const selectConsoleErrors = (state: RootState) => state.console.errors
export const selectConsoleWarnings = (state: RootState) =>
    state.console.warnings
