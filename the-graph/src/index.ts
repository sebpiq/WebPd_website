import React from 'react'
import ReactDOM from 'react-dom'

import 'font-awesome/css/font-awesome.css'
import 'the-graph/themes/the-graph-dark.styl'
import 'the-graph/themes/the-graph-light.styl'

import App from './App'
import { injectGlobal } from 'styled-components'
import { initialState } from './store/ui'
import themeConfig from './theme-config'

function renderApp() {
    const root = document.getElementById('root')
    const element = React.createElement(App, {})
    ReactDOM.render(element, root)
}
renderApp()

injectGlobal`
    html,
    body {
        width: 100%;
        height: 100%;
    }
    body {
        background-color: hsl(189, 47%, 6%);
        font-family: ${themeConfig.fontFamilies.default};
        overflow: hidden;
    }
    input, button {
        font-size: 100%;
    }
    * {
        box-sizing: border-box;
    }
`


const appState = initialState

function bla () {

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

// Load initial graph
const loadingMessage = document.getElementById('loading-message')

}