import React from 'react'
import GraphCanvas from './GraphCanvas'
import { Provider } from 'react-redux'
import { graphChanged } from './store/ui'
import DEFAULT_GRAPH from './core/default-graph'
import {GraphJson} from 'fbp-graph/src/Types'
import { jsonToUi } from './core/graph-conversion'
import { store } from './store'
import { create } from './store/webpd'
import MiniMap from './MiniMap'
import Menu from './menu/Menu'

export interface Props {
    className?: string
}

const loadGraph = async (json: GraphJson) => {
    const graph = await jsonToUi(json)
    graph.on('endTransaction', () => {
        store.dispatch(graphChanged(graph))
    })
    store.dispatch(graphChanged(graph))
}

const createWebPdEngine = async () => {
    store.dispatch(create())
}

const App = ({}) => {
    loadGraph(DEFAULT_GRAPH).then(() => {
        console.log('graph loaded')
    })
    createWebPdEngine().then(() => {
        console.log('sound started')
    })

    return (
        <Provider store={store}>
            <div>
                <Menu />
                <GraphCanvas />
                <MiniMap />
            </div>
        </Provider>
    )
}

export default App