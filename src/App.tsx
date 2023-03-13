import styled, { createGlobalStyle } from 'styled-components'
import Input from './Input'
import { theme } from './theme'
import Output from './Output'
import { Provider } from 'react-redux'
import { store, useAppSelector } from './store'
import { selectAppIsInitialized } from './store/app-selectors'
import Introduction from './Introduction'
import Console from './Console'
import { Spinner } from './components'
import CompilerTitle from './CompilerTitle'
import { selectArtefactsBuildStatus } from './store/artefacts-selectors'
import { BUILD_STATUS } from './store/artefacts'
import Footer from './Footer'

const GlobalStyle = createGlobalStyle`
    @font-face {
        font-family: 'Rajdhani';
        src: local('Rajdhani'),
            url('./fonts/Rajdhani/Rajdhani-Medium.ttf') format('woff');
    }

    @font-face {
        font-family: 'Silkscreen';
        src: local('Silkscreen'),
            url('./fonts/Silkscreen/Silkscreen-Regular.ttf') format('woff');
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
        scrollbar-width: thin;
        &::-webkit-scrollbar {
            width: calc(${theme.spacings.space1} / 4);
            height: calc(${theme.spacings.space1} / 4);
        }
        &::-webkit-scrollbar-track {
            background: transparent;
        }
        &::-webkit-scrollbar-thumb {
            background-color: ${theme.colors.fg2};
            border-radius: 20px;
        }
    }

    input {
        background-color: ${theme.colors.bg2};
        border: none;
        font-size: 100%;
    }

    textarea:focus, input:focus{
        outline: ${theme.colors.fg2} solid 1px;
    }
`

const CompilerContainer = styled.div`
    position: relative;
`
const SpinnerContainer = styled.div`
    margin: auto;
    width: 100%;
    position: absolute;
    height: 100%;
    z-index: 3;
`
const AppSpinner = styled(Spinner)`
    width: ${theme.dimensions.maxContentWidth};
    margin: 0 auto;
    z-index: ${theme.zIndexes.spinner};
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: ${theme.colors.bg2}ee;
    font-size: 200%;
`

const AppInner = () => {
    const isAppInitialized = useAppSelector(selectAppIsInitialized)
    const isBuilding =
        useAppSelector(selectArtefactsBuildStatus) === BUILD_STATUS.IN_PROGRESS
    if (!isAppInitialized) {
        return (
            <>
                <Introduction />
            </>
        )
    }

    return (
        <>
            <Introduction />
            <CompilerTitle />
            <CompilerContainer>
                {isBuilding ? (
                    <SpinnerContainer>
                        <AppSpinner text="building..." />
                    </SpinnerContainer>
                ) : null}
                <Input />
                <Output />
                <Console />
                <Footer />
            </CompilerContainer>
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
