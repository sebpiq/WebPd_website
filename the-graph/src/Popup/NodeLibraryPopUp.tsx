import React from 'react'
import { connect } from 'react-redux'
import styled from "styled-components"
import NODE_VIEW_BUILDERS from "../core/node-view-builders"
import { POPUP_NODE_CREATE, setPopup } from '../store/ui'
import { onMobile } from '../styled-components/media-queries'
import { ThemedButton2 } from '../styled-components/ThemedButton'
import ThemedInput from '../styled-components/ThemedInput'
import themeConfig from '../theme-config'

interface Props {
    setPopup: typeof setPopup
}

interface State {
    searchFilter: string | null
}

const Container = styled.div`
    height: 100%;
    width: 100%;
`

const SearchInputContainer = styled.div`
    padding-top: ${themeConfig.spacing.default};
    padding-left: ${themeConfig.spacing.default};
`

const NodeTileContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr;
    grid-template-rows: 0fr;
    ${onMobile(`
        grid-template-columns: 1fr 1fr 1fr;
    `)}
    grid-gap: calc(${themeConfig.spacing.default} / 2);
    height: 100%;
    width: 100%;
    padding: ${themeConfig.spacing.default};
`

const NodeTile = styled(ThemedButton2)`
    aspect-ratio: 1;
    font-size: 150%;
    ${onMobile(`
        font-size: 100%;
    `)}
`

class NodeLibraryPopUp extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props)
        this.state = {
            searchFilter: null
        }
    }

    componentDidMount() {
        const input = (this.refs.searchForm as HTMLFormElement).querySelector('input')
        input.focus()
    }

    render () {
        const { setPopup } = this.props
        const { searchFilter } = this.state
        const filteredNodes = Object.keys(NODE_VIEW_BUILDERS)
            .filter(nodeType => !searchFilter || nodeType.includes(searchFilter))
        
        const nodeTiles = filteredNodes.map(nodeType => {
                const onTileClick = () => setPopup({ type: POPUP_NODE_CREATE, data: { nodeType } })
                return (
                    <NodeTile onClick={onTileClick}>{nodeType}</NodeTile>
                )
            })

        const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
            const searchFilter = event.currentTarget.value
            this.setState({ searchFilter: searchFilter.length ? searchFilter : null })
        }

        const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (filteredNodes.length === 1) {
                const nodeType = filteredNodes[0]
                setPopup({ type: POPUP_NODE_CREATE, data: { nodeType } })
            }
        }

        return (
            <Container>
                <SearchInputContainer>
                    <form ref="searchForm" onSubmit={onSearchSubmit}>
                        <ThemedInput onChange={onSearchChange} type="text" placeholder="Search object" />
                    </form>
                </SearchInputContainer>
                <NodeTileContainer>
                    {nodeTiles}
                </NodeTileContainer>
            </Container>
        )
    }

}

export default connect(null, { setPopup })(NodeLibraryPopUp)