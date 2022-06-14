import React from 'react'
import { connect } from 'react-redux'
import styled from 'styled-components'
import { AppState } from '../store'
import { Arrays, deleteArray, loadLocalArray } from '../store/model'
import { getModelArrays } from '../store/selectors'
import H2 from '../styled-components/H2'
import InfoDiv from '../styled-components/InfoDiv'
import { onMobile } from '../styled-components/media-queries'
import themed, { ThemedProps } from '../styled-components/themed'
import { ThemedButton2 } from '../styled-components/Button'
import Input, { Input2 } from '../styled-components/Input'
import themeConfig from '../theme-config'

interface Props {
    arrays: Arrays
    loadLocalArray: typeof loadLocalArray
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
        const { arrays, deleteArray, loadLocalArray } = this.props
        const { newArrayName, newArrayFile } = this.state

        const arrayElems = Object.entries(arrays).map(
            ([arrayName, arrayDatum]) => {
                let label: string = ''
                let hasDeleteButton = false
                if (arrayDatum.code === 'error') {
                    label = arrayDatum.message
                } else if (arrayDatum.code === 'loading') {
                    label = 'loading ... '
                } else if (arrayDatum.code === 'loaded') {
                    label = `length : ${arrayDatum.array.length}`
                    hasDeleteButton = true
                }

                const onDeleteClick = () => deleteArray(arrayName)

                return (
                    <li>
                        <span>{arrayName}</span>
                        <span>{label}</span>
                        {hasDeleteButton ? (
                            <ThemedButton2 onClick={onDeleteClick}>
                                <i className="fa fa-trash"></i>
                            </ThemedButton2>
                        ) : (
                            <span></span>
                        )}
                    </li>
                )
            }
        )

        const onSubmitNewArray = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            loadLocalArray(newArrayName, newArrayFile)
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
    { loadLocalArray: loadLocalArray, deleteArray }
)(ArraysPopUp)
