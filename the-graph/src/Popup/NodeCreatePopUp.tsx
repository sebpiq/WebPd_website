import React from 'react'
import { parseArg } from '@webpd/pd-parser'
import { connect } from 'react-redux'
import styled from "styled-components"
import { AppState } from '../store'
import { addNode } from '../store/model'
import { getCurrentPdPatch, getUiPopup } from '../store/selectors'
import { POPUP_NODE_CREATE, setPopup, UiTheme } from '../store/ui'
import ThemedInput from '../styled-components/ThemedInput'
import { NODE_BUILDERS } from '@webpd/dsp-graph'
import { Colors } from '../theme-config'
import themed from '../styled-components/themed'

interface NodeArgsViewerProps {
    nodeType: PdSharedTypes.NodeType
    nodeArgs: PdJson.ObjectArgs | null
    patch: PdJson.Patch
}

const NodeArgsViewerContainer = themed(styled.div<{ theme: UiTheme, colors: Colors }>`
    ul {
        list-style: none;
        padding: 0;
        margin: 1em 0;

        li {
            ${({ colors }) => `
                color: ${colors.text2};
                background: ${colors.bg};
            `}
            padding: 1em;
        }
    }
`)

const _NodeArgsViewer = ({ nodeType, nodeArgs, patch }: NodeArgsViewerProps) => {
    const nodeBuilder = NODE_BUILDERS[nodeType]
    let liElems: Array<JSX.Element> = null
    if (!nodeBuilder || !nodeArgs) {
        liElems = null
    } else {
        const args = nodeBuilder.translateArgs(nodeArgs, patch)
        liElems = Object.entries(args).map(([argName, argValue]) => {
            return (
                <li>{argName} : {argValue}</li>
            )
        })
    }
    return (
        <NodeArgsViewerContainer>
            <ul>{liElems}</ul>
        </NodeArgsViewerContainer>
    )
}

const NodeArgsViewer = connect(
    (state: AppState) => ({ patch: getCurrentPdPatch(state) })
)(_NodeArgsViewer)

interface Props {
    setPopup: typeof setPopup
    addNode: typeof addNode
    nodeType: PdSharedTypes.NodeType
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 30em;
    width: 100%;
`

const TypeAndArgsContainer = themed(styled.div<{ theme: UiTheme, colors: Colors }>`
    display: flex;
    flex-direction: row;
    align-items: center;

    ${({ colors }) => `
        background: ${colors.bg};
    `}

    & > span:first-child {  
        padding: 0 1em;
        ${({ colors }) => `
            color: ${colors.text2};
        `}
    }

    & > input {
        flex: 1;
    }
`)

const SubmitButton = styled(ThemedInput)`
    width: 100%;
`

class NodeCreatePopUp extends React.Component<Props, { args: PdJson.ObjectArgs | null }> {

    constructor(props: Props) {
        super(props)
        this.state = { args: [] }
    }

    componentDidMount() {
        const formElem: HTMLFormElement = (this.refs['nodeForm'] as HTMLFormElement)
        const inputElem: HTMLInputElement = formElem.querySelector('input[name="args"]')
        inputElem.focus()
    }

    render() {
        const {nodeType, setPopup, addNode} = this.props
        const {args} = this.state

        const onArgsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const rawArgs = event.currentTarget.value.split(' ')
            const args: PdJson.ObjectArgs = rawArgs.map((rawArg: string) => parseArg(rawArg))
            this.setState({ args })
        }

        const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            addNode(nodeType, args)
            setPopup(null)
        }

        return (
            <Container>
                <form onSubmit={onSubmit} ref="nodeForm">
                    <TypeAndArgsContainer>
                        <span>{nodeType}</span>
                        <ThemedInput 
                            type="text" 
                            name="args" 
                            onChange={onArgsChange} 
                            placeholder="Write object arguments separated by a space"
                            autoComplete="off"
                        />
                    </TypeAndArgsContainer>
                    <NodeArgsViewer nodeArgs={args} nodeType={nodeType} />
                    <SubmitButton type="submit" value="Create" />
                </form>
            </Container>
        )
    }

}

export default connect(
    (state: AppState) => {
        const popup = getUiPopup(state)
        if (popup.type !== POPUP_NODE_CREATE) {
            throw new Error(`Unexpected popup "${popup.type}"`)
        }
        return { nodeType: popup.data.nodeType }
    }, 
    { addNode, setPopup }
)(NodeCreatePopUp)