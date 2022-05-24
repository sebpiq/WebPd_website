import { AppState } from ".";

export const getUiTheme = (state: AppState) => state.ui.theme

export const getUiGraph = (state: AppState) => state.ui.graph

export const getUiGraphVersion = (state: AppState) => state.ui.graphVersion

export const getUiPanX = (state: AppState) => state.ui.panX

export const getUiPanY = (state: AppState) => state.ui.panY

export const getUiScale = (state: AppState) => state.ui.scale

export const getUiLibrary = (state: AppState) => state.ui.library

export const getWebpdIsDspOn = (state: AppState) => state.webpd.isDspOn

export const getWebpdContext = (state: AppState) => state.webpd.context

export const getWebpdEngine = (state: AppState) => state.webpd.engine

export const getWebpdIsInitialized = (state: AppState) => state.webpd.isInitialized