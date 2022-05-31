export interface UiNodeMetadata {
    x: number
    y: number
    label: string
    icon: string
    pdNode: PdJson.Node
}

export interface UiEdgeMetadata {
    pdConnection: PdJson.Connection
}

export interface PortletView {
    type: PdJson.PortletType
    // must be unique for each portlet 
    name: string
}

interface NodeView {
    inlets: Array<PortletView>
    outlets: Array<PortletView>
}

interface NodeViewBuilder {
    build: (args: PdJson.ObjectArgs, engineSettings: PdEngine.Settings) => NodeView
}

export type NodeViewBuilders = {[nodeType: string]: NodeViewBuilder}

export interface LibraryPortDefinition {
    name: string
    type: PdJson.PortletType
}

export interface LibraryNodeDefinition {
    name: PdSharedTypes.NodeType
    description: string
    icon: string
    inports: Array<LibraryPortDefinition>
    outports: Array<LibraryPortDefinition>
}

export type Library = {[nodeType: string]: LibraryNodeDefinition}