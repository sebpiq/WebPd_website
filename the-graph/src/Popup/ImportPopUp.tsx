import React from 'react'
import parsePd from '@webpd/pd-parser'
import styled from 'styled-components'
import { readFileAsString } from '../core/browser'
import H2 from '../styled-components/H2'
import Input, { Input2 } from '../styled-components/Input'
import { connect } from 'react-redux'
import themeConfig from '../theme-config'
import { requestLoadPd } from '../store/model'
import { setPopup } from '../store/ui'
import NODE_VIEW_BUILDERS from '../core/node-view-builders'

interface Props {
    requestLoadPd: typeof requestLoadPd
    setPopup: typeof setPopup
}

interface State {
    pdFile: string | null
}

const Container = styled.div`
    height: 100%;
    width: 100%;
    padding: 0 ${themeConfig.spacing.default};
    display: flex;
    flex-direction: column;
    justify-content: center;

    form {
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        input[type="file"] {
            flex: 2;
        }
        input[type="submit"] {
            flex: 1;
        }
    }
`

const parsePdFile = (pdFile: string | null): PdJson.Pd => {
    if (!pdFile) {
        return null
    }
    const pd = parsePd(pdFile)
    Object.values(pd.patches).forEach(patch => {
        Object.values(patch.nodes).forEach(node => {
            if (!NODE_VIEW_BUILDERS[node.type]) {
                throw new Error(`Type [${node.type}] not implemented.`)
            }
        })
    })
    return pd
}

class ImportPopUp extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props)
        this.state = { pdFile: null }
    }

    render() {
        const {pdFile} = this.state
        const {requestLoadPd, setPopup} = this.props

        let pd: PdJson.Pd | null = null
        let parseErrorElem: JSX.Element = null
        try {
            pd = parsePdFile(pdFile)
        } catch(err) {
            parseErrorElem = <div>Error parsing : {err.message}</div>
        }

        const onSubmitPdFile = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            requestLoadPd(pd)
            setPopup(null)
        }

        const onPdFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const input: HTMLInputElement = event.currentTarget
            const file = input.files.item(0)
            if (file) {
                readFileAsString(file)
                    .then((pdFile) => this.setState({pdFile}))
            }
        }

        return (
            <Container>
                <H2>Import a patch file</H2>
                <form onSubmit={onSubmitPdFile}>
                    <Input2
                        type="file"
                        onChange={onPdFileChange}
                        placeholder="select .pd file"
                    />
                    <Input
                        type="submit"
                        value="load"
                        disabled={!pd}
                    />
                </form>
                {parseErrorElem}
            </Container>
        )
    }
}

export default connect(
    null,
    {requestLoadPd, setPopup}
)(ImportPopUp)
