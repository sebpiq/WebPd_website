import React from 'react'
import { connect } from 'react-redux'
import styled from "styled-components"
import { graphToPd, pdToJsCode } from '../core/converters'
import ThemedButton from '../styled-components/ThemedButton'
import * as fbpGraph from 'fbp-graph'
import { AppState } from '../store'
import { Engine } from '@webpd/engine-live-eval'
import renderPdFile from '@webpd/pd-renderer'
import { getCurrentPdPatch, getModelGraph, getWebpdEngine } from '../store/selectors'
import themeConfig from '../theme-config'
import ThemedInput from '../styled-components/ThemedInput'
import { download } from '../core/browser'

interface Props {
    webpdEngine: Engine
    graph: fbpGraph.Graph
    patch: PdJson.Patch
}

interface State {
    js: string | null
    pd: string | null
    currentTab: 'js' | 'pd' | null
    filename: string | null
}

const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
`

const CodeAreaContainer = styled.div`
    overflow: auto;
    padding: 0 ${themeConfig.spacing.default};
    flex: auto 1 1;
    pre {
        min-height: 100%;
        background-color: LightGrey;
        margin: 0;
        padding: ${themeConfig.spacing.default};
    }
`

const ButtonsContainer = styled.div`
    button {
        margin: ${themeConfig.spacing.default} 0em;
        margin-left: ${themeConfig.spacing.default};
        &:last-child {
            margin-right: ${themeConfig.spacing.default};
        }
    }

`

const DownloadContainer = styled.div`
    form > * {
        margin: ${themeConfig.spacing.default} 0em;
        margin-left: ${themeConfig.spacing.default};
        &:last-child {
            margin-right: ${themeConfig.spacing.default};
        }
    }
`

const FilenameSpan = styled.span``


class ExportPopUp extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props)
        this.state = {
            js: null,
            pd: null,
            currentTab: null,
            filename: null
        }
    }

    componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
        if (prevState.currentTab !== this.state.currentTab) {
            console.log(this.refs.downloadForm)
            const form = this.refs.downloadForm as HTMLFormElement
            const input = form.querySelector('input[name="filename"]') as HTMLInputElement
            input.focus()
        }
    }

    render() {
        const {graph, webpdEngine, patch} = this.props
        const {currentTab, js, pd, filename} = this.state

        const code = { pd, js }[currentTab]
        const extension = currentTab

        const onJsClick = () => {
            const pd = graphToPd(graph)
            const js = pdToJsCode(pd, webpdEngine.settings)
            this.setState({ js, currentTab: 'js' })
        }

        const onPdClick = () => {
            const pdJson = graphToPd(graph)
            const pd = renderPdFile(pdJson, patch.id)
            this.setState({ pd, currentTab: 'pd' })
        }

        const onFilenameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const filenameInput = event.currentTarget as HTMLInputElement
            this.setState({ filename: filenameInput.value })
        }

        const onDownloadClick = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            download(`${filename}.${extension}`, code, {
                'js': 'application/javascript',
                'pd': 'application/puredata',
            }[extension])
        }

        return (
            <Container>
                <ButtonsContainer>
                    <ThemedButton onClick={onJsClick}>.js - JavaScript code</ThemedButton>
                    <ThemedButton onClick={onPdClick} >.pd - Pure Data file</ThemedButton>
                </ButtonsContainer>
                {currentTab ? 
                    <CodeAreaContainer>
                        <pre>
                            {code}
                        </pre> 
                    </CodeAreaContainer>
                : null}
                {currentTab ? 
                    <DownloadContainer>
                        <form onSubmit={onDownloadClick} ref="downloadForm">
                            <FilenameSpan>
                                <ThemedInput 
                                    type="text" 
                                    name="filename" 
                                    onChange={onFilenameChange}
                                />
                                <span>.{extension}</span>
                            </FilenameSpan>
                            <ThemedInput 
                                type="submit" 
                                value="download"
                                disabled={!filename || filename.length === 0} 
                            />
                        </form>
                    </DownloadContainer>
                : null}
            </Container>
        )
    }

}

export default connect(
    (state: AppState) => ({
        graph: getModelGraph(state),
        webpdEngine: getWebpdEngine(state),
        patch: getCurrentPdPatch(state),
    }),
)(ExportPopUp)