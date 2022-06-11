import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { ArraysMap, deleteArray, loadArray } from '../store/model'
import { getModelArrays } from '../store/selectors'
import H2 from '../styled-components/H2'
import InfoDiv from '../styled-components/InfoDiv'
import { onMobile } from '../styled-components/media-queries'
import themed, { ThemedProps } from '../styled-components/themed'
import { ThemedButton2 } from '../styled-components/Button'
import Input, { Input2 } from '../styled-components/Input'
import themeConfig from '../theme-config'

interface Props {
    arrays: ArraysMap
    loadArray: typeof loadArray
    deleteArray: typeof deleteArray
}

interface State {
    newArrayName: string
    newArrayFile: File
}

const Container = styled.div`
    height: 100%;
    width: 100%;
    padding: 0 ${themeConfig.spacing.default};
    font-size: 130%;
    ${onMobile(`
        font-size: 100%;
    `)}
`

const ArraysContainer = styled.ul`
    list-style: none;
    padding: 0;
    li {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        span:first-child {
            font-weight: bold;
        }
    }
`

const NewArrayContainer = themed(styled.div<ThemedProps>`
    form {
        display: flex;
        flex-direction: row;
        ${onMobile(`
            flex-direction: column;
        `)}
        justify-content: space-between;
        background-color: ${({ colors }) => `${colors.secondary}`};
    }
`)

class ArraysPopUp extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            newArrayName: null,
            newArrayFile: null,
        }
    }

    render() {
        const { arrays, deleteArray, loadArray } = this.props
        const { newArrayName, newArrayFile } = this.state

        const arrayElems = Object.entries(arrays).map(([arrayName, array]) => {
            const onDeleteClick = () => deleteArray(arrayName)
            return (
                <li>
                    <span>{arrayName}</span>
                    <span>length : {array.length}</span>
                    <ThemedButton2 onClick={onDeleteClick}>
                        <i className="fa fa-trash"></i>
                    </ThemedButton2>
                </li>
            )
        })

        const onSubmitNewArray = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            loadArray(newArrayName, newArrayFile)
        }

        const onNewArrayNameChange = (
            event: React.FormEvent<HTMLInputElement>
        ) => {
            const input = event.currentTarget
            this.setState({ newArrayName: input.value })
        }

        const onNewArrayFileChange = (
            event: React.FormEvent<HTMLInputElement>
        ) => {
            const input = event.currentTarget
            const file = input.files.item(0)
            if (file) {
                // Check if the file is right
                if (file.type && file.type.startsWith('audio/')) {
                    this.setState({ newArrayFile: file })
                }
            }
        }

        return (
            <Container>
                <H2>Audio Arrays</H2>
                <InfoDiv>
                    Load arrays into the app for use by objects such as
                    [tabplay~], [tabread~], etc ...
                </InfoDiv>

                {arrayElems.length === 0 ? <div>no array yet</div> : null}
                <ArraysContainer>{arrayElems}</ArraysContainer>
                <NewArrayContainer>
                    <form onSubmit={onSubmitNewArray}>
                        <Input2
                            type="text"
                            name="arrayName"
                            placeholder="Array name"
                            autoComplete="off"
                            onChange={onNewArrayNameChange}
                        />
                        <Input2
                            type="file"
                            onChange={onNewArrayFileChange}
                            placeholder="select audio file"
                        />
                        <Input
                            type="submit"
                            value="add array"
                            disabled={!newArrayName || !newArrayFile}
                        />
                    </form>
                </NewArrayContainer>
            </Container>
        )
    }
}

export default connect(
    (state: AppState) => ({
        arrays: getModelArrays(state),
    }),
    { loadArray, deleteArray }
)(ArraysPopUp)
