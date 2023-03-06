import { createGlobalStyle } from 'styled-components'
import { Artefacts } from './Artefacts'
import SideEffects from './SideEffects'
import Input from './Input'
import { theme } from './theme'
import Output from './Output'
import { Provider } from 'react-redux'
import { store, useAppDispatch, useAppSelector } from './store'
import { useEffect } from 'react'
import { appInitializationDone } from './store/app'
import { selectAppIsInitialized } from './store/app-selectors'
import Introduction from './Introduction'
import Console from './Console'

const GlobalStyle = createGlobalStyle`
    @font-face {
        font-family: 'Rajdhani';
        src: local('Rajdhani'),
            url('./fonts/Rajdhani/Rajdhani-Medium.ttf') format('woff');
    }

    body, html {
        padding: 0;
        margin: 0;
        background-color: ${theme.colors.bg1};
    }

    * { 
        box-sizing: border-box;
        /* To enable flex items shrink : https://stackoverflow.com/questions/36247140/why-dont-flex-items-shrink-past-content-size */
        min-width: 0; 
        min-height: 0;
        font-size: ${theme.devices.desktop.fontSize}px;
        font-family: ${theme.fonts.default};
        color: ${theme.colors.fg1};
    }

    input {
        background-color: ${theme.colors.bg2};
        border: none;
        font-size: 100%;
    }
`

const AppInner = () => {
    const dispatch = useAppDispatch()
    const isAppInitialized = useAppSelector(selectAppIsInitialized)

    // App initialization
    useEffect(() => {
        const interval = setInterval(() => {
            if (window.asc) {
                clearInterval(interval)
                dispatch(appInitializationDone())
            }
        }, 100)
    }, [])

    if (!isAppInitialized) {
        return <>
        <Introduction />
        LOADING
        </>
    }

    return (
        <>
            <SideEffects />
            <Introduction />
            <Input />
            <Output />
            <Console />
            <Artefacts />
        </>
    )
}

const App = () => {
    return (
        <Provider store={store}>
            <GlobalStyle />
            <AppInner />
        </Provider>
    )
}

export default App
