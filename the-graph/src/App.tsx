import React from 'react'
import GraphCanvas from './GraphCanvas'
import { connect, Provider } from 'react-redux'
import DEFAULT_PATCH from './core/default-patch.pd'
import { pdFileToPd } from './core/graph-conversion'
import { AppState, store } from './store'
import { create as createWebpd, requestLoadWebPdJson } from './store/webpd'
import MiniMap from './MiniMap'
import Menu from './menu/Menu'
import Popup from './Popup'
import { getWebpdIsCreated } from './store/selectors'

export interface InnerAppProps {
    webpdIsCreated : boolean
}

const loadPatch = async (pdFile: string) => {
    const pdJson = await pdFileToPd(pdFile)
    store.dispatch(requestLoadWebPdJson(pdJson))
}

const createWebPdEngine = async () => {
    store.dispatch(createWebpd())
}

const _InnerApp = ({ webpdIsCreated }: InnerAppProps) => {
    if (webpdIsCreated) {
        loadPatch(DEFAULT_PATCH)
            .then(() => {
                console.log('patch loaded')
            })
    } else {
        createWebPdEngine()
            .then(() => {
                console.log('sound started')
            })
    }
    return (
        <div>
            <Menu />
            <GraphCanvas />
            <MiniMap />
            <Popup />
        </div>
    )
}

const InnerApp = connect(
    (state: AppState) => ({ webpdIsCreated: getWebpdIsCreated(state) })
)(_InnerApp)

const App = ({}) => {
    return (
        <Provider store={store}>
            <InnerApp />
        </Provider>
    )
}

export default App