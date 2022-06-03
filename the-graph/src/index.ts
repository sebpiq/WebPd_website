import React from 'react'
import ReactDOM from 'react-dom'

import 'font-awesome/css/font-awesome.css'
import 'the-graph/themes/the-graph-dark.styl'
import 'the-graph/themes/the-graph-light.styl'

import App from './App'
import { injectGlobal } from 'styled-components'
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
        margin: 0;
        padding: 0;
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