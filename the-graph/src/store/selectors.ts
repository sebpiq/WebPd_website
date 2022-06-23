import { AppState } from '.'
import { graphToPd } from '../core/converters'
import { Point } from '../core/types'
import { Popup } from './ui'

export const getUiTheme = (state: AppState) => state.ui.theme

export const getModelGraph = (state: AppState) => state.model.graph

export const getModelGraphVersion = (state: AppState) =>
    state.model.graphVersion

export const getModelLibrary = (state: AppState) => state.model.library

export const getModelArrays = (state: AppState) => state.model.arrays

export const getCurrentPdPatch = (state: AppState) => {
    const graph = getModelGraph(state)
    const pd = graphToPd(graph)
    return Object.values(pd.patches)[0]
}

export const getUiPopup = (state: AppState): Popup => state.ui.popup

export const getUiPanScale = (state: AppState) => state.ui.panScale

export const getUiAppDimensions = (state: AppState) => state.ui.appDimensions

export const getUiCanvasCenterPoint = (state: AppState): Point => {
    const { width: appWidth, height: appHeight } = getUiAppDimensions(state)
    const { x: panX, y: panY, scale } = getUiPanScale(state)
    const center = {
        x: (panX + appWidth / 2) / scale,
        y: (panY + appHeight / 2) / scale,
    }
    return center
}

export const getUiMobileMenuExpanded = (state: AppState) =>
    state.ui.mobileMenuExpanded

export const getWebpdIsCreated = (state: AppState) => state.webpd.isCreated

export const getWebpdIsDspOn = (state: AppState) => state.webpd.isDspOn

export const getWebpdContext = (state: AppState) => state.webpd.context

export const getWebpdEngine = (state: AppState) => state.webpd.engine

export const getWebpdSettings = (state: AppState) => state.webpd.settings

export const getWebpdIsInitialized = (state: AppState) =>
    state.webpd.isInitialized

export const getWebpdEngineMode = (state: AppState) => 
    state.webpd.engineMode