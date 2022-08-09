export interface Point {
    x: number
    y: number
}

type GraphPortName = string

export interface PortletView {
    type: PdJson.PortletType
    // must be unique for each portlet
    name: GraphPortName
}

interface NodeView {
    inlets: Array<PortletView>
    outlets: Array<PortletView>
}

interface NodeViewBuilder {
    build: (
        args: PdJson.ObjectArgs,
        engineSettings: Settings
    ) => NodeView
    icon?: string
    noArguments?: true
}

export type NodeViewBuilders = { [nodeType: string]: NodeViewBuilder }

// Types for TheGraph component library
export interface LibraryPortDefinition {
    name: string
    type: PdJson.PortletType
}

export interface LibraryNodeDefinition {
    name: PdSharedTypes.NodeType
    description: string
    iconsvg: string
    inports: Array<LibraryPortDefinition>
    outports: Array<LibraryPortDefinition>
}

export type Library = { [nodeType: string]: LibraryNodeDefinition }

export interface Settings {
    channelCount: number
    bitDepth: 64
}