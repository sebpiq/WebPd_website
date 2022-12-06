import React from 'react'
import { parseArg } from '@webpd/pd-parser'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { addNode, editNode } from '../store/model'
import { getCurrentPdPatch } from '../store/selectors'
import { setPopup, UiTheme } from '../store/ui'
import Input, { Input2 } from '../styled-components/Input'
import themeConfig, { Colors } from '../theme-config'
import themed from '../styled-components/themed'
import H2 from '../styled-components/H2'
import { PdJson } from '@webpd/pd-json'
import { NODE_BUILDERS } from '@webpd/pd-to-dsp-graph'
import { DspGraph } from '@webpd/dsp-graph'

interface NodeArgsViewerProps {
    nodeType: PdJson.ObjectType
    nodeArgs: PdJson.ObjectArgs | null
    patch: PdJson.Patch
}

const NodeArgsViewerContainer = themed(styled.div<{
    theme: UiTheme
    colors: Colors
}>`
    ul {
        list-style: none;
        padding: 0;
        margin: calc(${themeConfig.spacing.default} / 2) 0;

        li {
            ${({ colors }) => `
                color: ${colors.text2};
                background: ${colors.secondary};
            `}
            padding: ${themeConfig.spacing.default};
        }
    }
`)

const _NodeArgsViewer = ({
    nodeType,
    nodeArgs,
    patch,
}: NodeArgsViewerProps) => {
    const nodeBuilder = NODE_BUILDERS[nodeType]
    let liElems: Array<JSX.Element> = null
    if (!nodeBuilder || !nodeArgs) {
        liElems = null
    } else {
        let args: DspGraph.NodeArguments
        try {
            args = nodeBuilder.translateArgs(nodeArgs, patch)
        } catch (err) {
            console.error(err)
            return null
        }
        liElems = Object.entries(args).map(([argName, argValue]) => {
            return (
                <li key={argName}>
                    {argName} : {argValue}
                </li>
            )
        })
    }
    return (
        <NodeArgsViewerContainer>
            <ul>{liElems}</ul>
        </NodeArgsViewerContainer>
    )
}

const NodeArgsViewer = connect((state: AppState) => ({
    patch: getCurrentPdPatch(state),
}))(_NodeArgsViewer)

interface Props {
    setPopup: typeof setPopup
    addNode: typeof addNode
    editNode: typeof addNode
    nodeType: PdJson.ObjectType
    nodeId?: PdJson.ObjectLocalId
    nodeArgs?: PdJson.ObjectArgs
}

interface State {
    newArgs: PdJson.ObjectArgs | null
    inputValue: string
}

const Container = styled.div`
    display: flex;
    flex-direction: column;
    max-width: 30em;
    width: 100%;
    padding: 0 ${themeConfig.spacing.default};
`

const TypeAndArgsContainer = themed(styled.div<{
    theme: UiTheme
    colors: Colors
}>`
    display: flex;
    flex-direction: row;
    align-items: center;

    ${({ colors }) => `
        background: ${colors.secondary};
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

const SubmitButton = styled(Input)`
    width: 100%;
`

class NodeCreatePopUp extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            newArgs: this.props.nodeArgs ? this.props.nodeArgs : [],
            inputValue: this.props.nodeArgs
                ? this.props.nodeArgs.map((v) => v.toString()).join(' ')
                : '',
        }
    }

    componentDidMount() {
        const formElem: HTMLFormElement = this.refs[
            'nodeForm'
        ] as HTMLFormElement
        const inputElem: HTMLInputElement = formElem.querySelector(
            'input[name="args"]'
        )
        inputElem.focus()
    }

    render() {
        const {
            nodeType,
            setPopup,
            addNode,
            editNode,
            nodeId,
            nodeArgs: currentArgs,
        } = this.props
        const { newArgs, inputValue } = this.state

        const onArgsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const inputValue = event.currentTarget.value
            const newArgs: PdJson.ObjectArgs = event.currentTarget.value
                .split(' ')
                .map((rawArg: string) => parseArg(rawArg))
            this.setState({ newArgs, inputValue })
        }

        const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (nodeId) {
                editNode(nodeId, newArgs)
            } else {
                addNode(nodeType, newArgs)
            }
            setPopup(null)
        }

        return (
            <Container>
                <H2>Set Object Arguments</H2>
                <form onSubmit={onSubmit} ref="nodeForm">
                    <TypeAndArgsContainer>
                        <span>{nodeType}</span>
                        <Input2
                            type="text"
                            name="args"
                            onChange={onArgsChange}
                            placeholder="Write object arguments separated by a space"
                            autoComplete="off"
                            value={inputValue}
                        />
                    </TypeAndArgsContainer>
                    <NodeArgsViewer nodeArgs={newArgs} nodeType={nodeType} />
                    <SubmitButton
                        type="submit"
                        value={currentArgs ? 'Save changes' : 'Create'}
                    />
                </form>
            </Container>
        )
    }
}

export default connect(null, { addNode, setPopup, editNode })(NodeCreatePopUp)
