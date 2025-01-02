import { DspGraph, PdJson } from 'webpd'
import { Browser } from 'webpd'

export interface Settings {
    container: HTMLDivElement
    colorScheme: { next: () => string }
    initialValues?: PatchPlayerValues
    showCredits?: boolean
    valuesUpdatedCallback?: (values: PatchPlayerValues) => void
}

export interface PatchPlayer {
    rootElem: HTMLElement | null
    patchUrl: string | null
    audioContext: AudioContext
    webpdNode: Browser.WebPdWorkletNode | null
    views: {
        root: Array<RootView>
        indexed: ViewsIndex
    }
    controller: Controller
    settings: Settings | null
}

export type PatchPlayerWithSettings = PatchPlayer & { settings: Settings }

// --------------------- controller --------------------- //
type ControllerValue = string | number

export type ConvertNexusValueFunction = (v: number) => string | number | null
export type OnMessageFromWebPdCallback = (
    nexusElem: typeof Nexus,
    v: ControllerValue
) => void

export interface Controller {
    values: { [nodeId: string]: ControllerValue }
    functions: {
        [nodeId: string]: {
            convertNexusValue: ConvertNexusValueFunction
            onMessageFromWebPd: OnMessageFromWebPdCallback
        }
    }
}

export type PatchPlayerValues = Controller['values']

// --------------------- views --------------------- //
export interface Point {
    x: number
    y: number
}

export interface Rectangle {
    topLeft: Point
    bottomRight: Point
}

export interface BaseView {
    position: Point
}

export interface ControlView extends BaseView {
    type: 'control'
    label: string | null
    pdNode: PdJson.ControlNode
    nodeId: DspGraph.NodeId
    nexusElem: any
    dimensions: Point
}

export interface ContainerView extends BaseView {
    type: 'container'
    label: string | null
    children: Array<ControlOrContainerView>
    dimensions: Point
}

export interface CommentView extends BaseView {
    type: 'comment'
    text: string
}

export type ControlOrContainerView = ControlView | ContainerView

export type RootView = ContainerView | CommentView

export type ViewsIndex = { [nodeId: string]: ControlView }
