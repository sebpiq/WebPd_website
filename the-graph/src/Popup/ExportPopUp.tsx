import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { graphToPd, pdToJsCode, pdToWasm } from '../core/converters'
import Button from '../styled-components/Button'
import * as fbpGraph from 'fbp-graph'
import { AppState } from '../store'
import renderPdFile from '@webpd/pd-renderer'
import {
    getCurrentPdPatch,
    getModelGraph,
    getWebpdSettings,
} from '../store/selectors'
import themeConfig, { Colors } from '../theme-config'
import Input, { Input2 } from '../styled-components/Input'
import { download } from '../core/browser'
import themed from '../styled-components/themed'
import { UiTheme } from '../store/ui'
import { onDesktop, onMobile } from '../styled-components/media-queries'
import H2 from '../styled-components/H2'
import { Settings } from '../core/types'

interface Props {
    settings: Settings
    graph: fbpGraph.Graph
    patch: PdJson.Patch
}

interface State {
    js: string | null
    pd: string | null
    wasm: ArrayBuffer | null
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
    `)}

    button {
        ${onDesktop(`
            margin-right: ${themeConfig.spacing.default};
            &:last-child {
                margin-right: 0;
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
    margin: ${themeConfig.spacing.default} 0;
    flex: auto 1 1;
    pre {
        min-height: 100%;
        overflow: auto;
        color: black;
        background-color: LightGrey;
        margin: 0;
        padding-top: ${themeConfig.spacing.default};
        padding-left: ${themeConfig.spacing.default};
    }
`

const DownloadContainer = styled.div`
    form {
        ${onMobile(`        
            display: flex;
            flex-direction: column;
        `)}

        & > * {
            ${onDesktop(`
                margin-right: ${themeConfig.spacing.default};
                &:last-child {
                    margin-right: 0;
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
        const { graph, settings, patch } = this.props
        const { currentTab, js, pd, wasm, filename } = this.state

        const code = { pd, js, wasm }[currentTab]
        const extension = currentTab

        const onJsClick = () => {
            const pd = graphToPd(graph)
            const js = pdToJsCode(pd, settings)
            this.setState({ js, currentTab: 'js' })
        }

        const onPdClick = () => {
            const pd = graphToPd(graph)
            const pdFile = renderPdFile(pd, patch.id)
            this.setState({ pd: pdFile, currentTab: 'pd' })
        }

        const onWasmClick = () => {
            const pd = graphToPd(graph)
            pdToWasm(pd, settings).then((wasmBuffer) => {
                this.setState({ wasm: wasmBuffer, currentTab: 'wasm' })
            })
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
                        <pre>{typeof code === 'string' ? code : `Wasm binary, byte length = ${code.byteLength}`}</pre>
                    </CodeAreaContainer>
                ) : null}
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
            </Container>
        )
    }
}

export default connect((state: AppState) => ({
    graph: getModelGraph(state),
    settings: getWebpdSettings(state),
    patch: getCurrentPdPatch(state),
}))(ExportPopUp)
