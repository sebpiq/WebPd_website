import * as fbpGraph from 'fbp-graph'
import {GraphJson, GraphEdge} from 'fbp-graph/src/Types'
import React from 'react'
import ReactDOM from 'react-dom'
import TheGraph from 'the-graph'

import 'font-awesome/css/font-awesome.css'
import 'the-graph/themes/the-graph-dark.styl'
import 'the-graph/themes/the-graph-light.styl'

import DEFAULT_GRAPH from './default-graph'
import * as webpd from './webpd'

import { DEFAULT_REGISTRY } from '@webpd/dsp-graph'
import { pEvent } from 'p-event'
import { jsonToUi } from './graph-conversion'
import App from './App'

const createWebPdEngine = async () => {
    await webpd.init()
    const button = document.querySelector('#startaudio')
    await pEvent(button, 'click')
    webpd.start(appState.graph)
}

createWebPdEngine().then(() => {
    console.log('sound started')
})

const library = {}

// Context menu specification
function deleteNode(graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) {
    graph.removeNode(itemKey)
}
function deleteEdge(graph: fbpGraph.Graph, itemKey: string, item: GraphEdge) {
    graph.removeEdge(item.from.node, item.from.port, item.to.node, item.to.port)
}

const contextMenus: any = {
    main: null,
    selection: null,
    nodeInport: null,
    nodeOutport: null,
    graphInport: null,
    graphOutport: null,
    edge: {
        icon: 'long-arrow-right',
        s4: {
            icon: 'trash',
            iconLabel: 'delete',
            action: deleteEdge,
        },
    },
    node: {
        s4: {
            icon: 'trash',
            iconLabel: 'delete',
            action: deleteNode,
        },
    },
    group: {
        icon: 'th',
        s4: {
            icon: 'trash',
            iconLabel: 'ungroup',
            action(graph: fbpGraph.Graph, itemKey: string) {
                graph.removeGroup(itemKey)
            },
        },
    },
}

const appState = {
    graph: new fbpGraph.Graph(),
    library: {},
    iconOverrides: {},
    theme: 'dark',
    editorViewX: 0,
    editorViewY: 0,
    editorScale: 1,
}

// Attach nav
function fitGraphInView() {
    const editor = document.getElementById('editor')
    console.log('EDITOR TRIGGERFIT')
    ;(editor as any).triggerFit()
}

function panEditorTo() {}

function renderNav() {
    const view = [
        appState.editorViewX,
        appState.editorViewY,
        window.innerWidth,
        window.innerHeight,
    ]
    const props = {
        height: 162,
        width: 216,
        graph: appState.graph,
        onTap: fitGraphInView,
        onPanTo: panEditorTo,
        viewrectangle: view,
        viewscale: appState.editorScale,
    }

    const element = React.createElement(TheGraph.nav.Component, props)
    ReactDOM.render(element, document.getElementById('nav'))
}

function editorPanChanged(x: number, y: number, scale: number) {
    appState.editorViewX = -x
    appState.editorViewY = -y
    appState.editorScale = scale
    renderNav()
}

function renderEditor() {
    const editor = document.getElementById('editor')
    editor.className = `the-graph-${appState.theme}`

    const props = {
        width: window.innerWidth,
        height: window.innerWidth,
        graph: appState.graph,
        library: appState.library,
        menus: contextMenus,
        nodeIcons: appState.iconOverrides,
        onPanScale: editorPanChanged,
    }

    editor.style.width = `${props.width}px`
    editor.style.height = `${props.height}px`
    const element = React.createElement(TheGraph.App, props)
    ReactDOM.render(element, editor)

    renderNav()
}

renderEditor() // initial

function renderApp() {
    const editor = document.getElementById('root')
    const element = React.createElement(App, {})
    ReactDOM.render(element, editor)
}

renderApp()



// Follow changes in window size
window.addEventListener('resize', renderEditor)

// Toggle theme
let theme = 'dark'
document.getElementById('theme').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'
    appState.theme = theme
    renderEditor()
})

// Autolayout button
document.getElementById('autolayout').addEventListener('click', () => {
    const editor = document.getElementById('editor')
    // TODO: support via React props
    console.log('EDITOR AUTOLAYOUT')
    ;(editor as any).triggerAutolayout()
})

// Focus a node
document.getElementById('focus').addEventListener('click', () => {
    // TODO: support via React props
    const { nodes } = appState.graph
    const randomNode = nodes[Math.floor(Math.random() * nodes.length)]
    const editor = document.getElementById('editor')
    console.log('EDITOR FOCUSNODE')
    ;(editor as any).focusNode(randomNode)
})

// Add node button
const addnode = function () {
    const id = Math.round(Math.random() * 100000).toString(36)
    const component = Math.random() > 0.5 ? 'basic' : 'tall'
    const metadata = {
        label: component,
        x: Math.round(Math.random() * 800),
        y: Math.round(Math.random() * 600),
    }
    const newNode = appState.graph.addNode(id, component, metadata)
    return newNode
}
document.getElementById('addnode').addEventListener('click', addnode)

// Load initial graph
const loadingMessage = document.getElementById('loading-message')

const loadGraph = async (json: GraphJson) => {
    // Load graph
    loadingMessage.innerHTML = 'loading graph data...'

    const graph = await jsonToUi(json)

    // Remove loading message
    const loading = document.getElementById('loading')
    loading.parentNode.removeChild(loading)
    // Synthesize component library from graph
    appState.library = {
        ...TheGraph.library.libraryFromGraph(graph),
        ...library,
    }
    // Set loaded graph
    appState.graph = graph
    appState.graph.on('endTransaction', renderEditor) // graph changed
    appState.graph.on('endTransaction', () => {
        webpd.setGraph(appState.graph).then(() => {
            console.log('updated engine')
        })
    }) // graph changed
    renderEditor()

    console.log('loaded')
}

loadGraph(DEFAULT_GRAPH)

// ---------------------------

// Simulate node icon updates
// const iconKeys = Object.keys(TheGraph.FONT_AWESOME);
// window.setInterval(() => {
//   const { nodes } = appState.graph;
//   if (nodes.length > 0) {
//     const randomNodeId = nodes[Math.floor(Math.random() * nodes.length)].id;
//     const randomIcon = iconKeys[Math.floor(Math.random() * iconKeys.length)];
//     appState.iconOverrides[randomNodeId] = randomIcon;
//     renderEditor();
//   }
// }, 1000);

// const library = {
//   basic: {
//     name: 'osc~',
//     description: 'basic demo component',
//     icon: 'eye',
//     inports: [
//       { name: 'in0', type: 'all' },
//       { name: 'in1', type: 'all' },
//     ],
//     outports: [
//       { name: 'out', type: 'all' },
//     ],
//   },
//   tall: {
//     name: 'tall',
//     description: 'tall demo component',
//     icon: 'cog',
//     inports: [
//       { name: 'in0', type: 'all' },
//       { name: 'in1', type: 'all' },
//       { name: 'in2', type: 'all' },
//       { name: 'in3', type: 'all' },
//       { name: 'in4', type: 'all' },
//       { name: 'in5', type: 'all' },
//       { name: 'in6', type: 'all' },
//       { name: 'in7', type: 'all' },
//       { name: 'in8', type: 'all' },
//       { name: 'in9', type: 'all' },
//       { name: 'in10', type: 'all' },
//       { name: 'in11', type: 'all' },
//       { name: 'in12', type: 'all' },
//     ],
//     outports: [
//       { name: 'out0', type: 'all' },
//     ],
//   },
// };
