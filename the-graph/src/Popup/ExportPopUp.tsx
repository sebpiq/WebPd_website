import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { graphToPd, pdToJsCode } from '../core/converters'
import Button from '../styled-components/Button'
import * as fbpGraph from 'fbp-graph'
import { AppState } from '../store'
import { Engine } from '@webpd/engine-live-eval'
import renderPdFile from '@webpd/pd-renderer'
import {
    getCurrentPdPatch,
    getModelGraph,
    getWebpdEngine,
} from '../store/selectors'
import themeConfig, { Colors } from '../theme-config'
import Input, { Input2 } from '../styled-components/Input'
import { download } from '../core/browser'
import themed from '../styled-components/themed'
import { UiTheme } from '../store/ui'
import { onDesktop, onMobile } from '../styled-components/media-queries'
import H2 from '../styled-components/H2'

interface Props {
    webpdEngine: Engine
    graph: fbpGraph.Graph
    patch: PdJson.Patch
}

interface State {
    js: string | null
    pd: string | null
    wasm: string | null
    currentTab: 'js' | 'pd' | 'wasm' | null
    filename: string | null
}

const Container = styled.div`
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    padding: 0 ${themeConfig.spacing.default};
`

const TabsContainer = styled.div`
    ${onMobile(`
        display: flex;
        flex-direction: column;
        padding-top: ${themeConfig.spacing.default};
    `)}

    button {
        ${onDesktop(`
            margin: ${themeConfig.spacing.default} 0em;
            margin-left: ${themeConfig.spacing.default};
            &:last-child {
                margin-right: ${themeConfig.spacing.default};
            }
        `)}

        ${onMobile(`
            margin-bottom: calc(${themeConfig.spacing.default} / 2);
            &:last-child {
                margin-bottom: 0;
            }
        `)}
    }
`

const CodeAreaContainer = styled.div`
    overflow: auto;
    padding-top: ${themeConfig.spacing.default};
    flex: auto 1 1;
    pre {
        min-height: 100%;
        overflow: auto;
        color: black;
        background-color: LightGrey;
        margin: 0;
        padding-top: ${themeConfig.spacing.default};
    }
`

const DownloadContainer = styled.div`
    form {
        ${onMobile(`        
            display: flex;
            flex-direction: column;
            padding: ${themeConfig.spacing.default} 0;
        `)}

        & > * {
            ${onDesktop(`
                margin: ${themeConfig.spacing.default} 0em;
                margin-left: ${themeConfig.spacing.default};
                &:last-child {
                    margin-right: ${themeConfig.spacing.default};
                }
            `)}
        }
    }
`

const FilenameContainer = themed(styled.div<{ theme: UiTheme; colors: Colors }>`
    display: inline-block;

    ${onMobile(`
        margin-bottom: calc(${themeConfig.spacing.default} / 2);
    `)}

    ${({ colors }) => `
        background-color: ${colors.secondary};
    `}
    & > span:last-child {
        padding: 0 0.5em;
    }
    input {
        padding-right: 0.1em;
        text-align: right;
    }
`)

class ExportPopUp extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        const pd = graphToPd(this.props.graph)
        this.state = {
            js: null,
            pd: renderPdFile(pd, this.props.patch.id),
            wasm: null,
            currentTab: 'pd',
            filename: null,
        }
    }

    componentDidUpdate(_: Readonly<Props>, prevState: Readonly<State>) {
        if (
            prevState.currentTab !== this.state.currentTab &&
            this.refs.downloadForm
        ) {
            const form = this.refs.downloadForm as HTMLFormElement
            const input = form.querySelector(
                'input[name="filename"]'
            ) as HTMLInputElement
            input.focus()
        }
    }

    render() {
        const { graph, webpdEngine, patch } = this.props
        const { currentTab, js, pd, wasm, filename } = this.state

        const code = { pd, js, wasm }[currentTab]
        const extension = currentTab

        const onJsClick = () => {
            const pd = graphToPd(graph)
            const js = pdToJsCode(pd, webpdEngine.settings)
            this.setState({ js, currentTab: 'js' })
        }

        const onPdClick = () => {
            const pd = graphToPd(graph)
            const pdFile = renderPdFile(pd, patch.id)
            this.setState({ pd: pdFile, currentTab: 'pd' })
        }

        const onWasmClick = () => {
            this.setState({ wasm: 'COMING SOON ...', currentTab: 'wasm' })
        }

        const onFilenameChange = (
            event: React.ChangeEvent<HTMLInputElement>
        ) => {
            const filenameInput = event.currentTarget as HTMLInputElement
            this.setState({ filename: filenameInput.value })
        }

        const onDownloadClick = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            download(
                `${filename}.${extension}`,
                code,
                {
                    js: 'application/javascript',
                    pd: 'application/puredata',
                    wasm: 'application/wasm',
                }[extension]
            )
        }

        return (
            <Container>
                <H2>Export Your Patch</H2>
                <TabsContainer>
                    <Button onClick={onPdClick}>.pd - Pure Data file</Button>
                    <Button onClick={onJsClick}>.js - JavaScript code</Button>
                    <Button onClick={onWasmClick}>
                        .wasm - WebAssembly binary
                    </Button>
                </TabsContainer>
                {currentTab ? (
                    <CodeAreaContainer>
                        <pre>{code}</pre>
                    </CodeAreaContainer>
                ) : null}
                {currentTab && currentTab !== 'wasm' ? (
                    <DownloadContainer>
                        <form onSubmit={onDownloadClick} ref="downloadForm">
                            <FilenameContainer>
                                <Input2
                                    type="text"
                                    name="filename"
                                    onChange={onFilenameChange}
                                    placeholder="filename"
                                    autoComplete="off"
                                />
                                <span>.{extension}</span>
                            </FilenameContainer>
                            <Input
                                type="submit"
                                value="download"
                                disabled={!filename || filename.length === 0}
                            />
                        </form>
                    </DownloadContainer>
                ) : null}
            </Container>
        )
    }
}

export default connect((state: AppState) => ({
    graph: getModelGraph(state),
    webpdEngine: getWebpdEngine(state),
    patch: getCurrentPdPatch(state),
}))(ExportPopUp)
