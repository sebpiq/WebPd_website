import { AppState } from "."
import { getPdJson } from "../core/graph-conversion"
import { Popup } from "./ui"

export const getUiTheme = (state: AppState) => state.ui.theme

export const getModelGraph = (state: AppState) => state.model.graph

export const getModelGraphVersion = (state: AppState) => state.model.graphVersion

export const getModelLibrary = (state: AppState) => state.model.library

export const getCurrentPdPatch = (state: AppState) => {
    const graph = getModelGraph(state)
    const pd = getPdJson(graph)
    return Object.values(pd.patches)[0]
}

export const getUiPopup = (state: AppState): Popup => state.ui.popup

export const getUiPanX = (state: AppState) => state.ui.panX

export const getUiPanY = (state: AppState) => state.ui.panY

export const getUiScale = (state: AppState) => state.ui.scale

export const getWebpdIsCreated = (state: AppState) => state.webpd.isCreated

export const getWebpdIsDspOn = (state: AppState) => state.webpd.isDspOn

export const getWebpdContext = (state: AppState) => state.webpd.context

export const getWebpdEngine = (state: AppState) => state.webpd.engine

export const getWebpdIsInitialized = (state: AppState) => state.webpd.isInitialized