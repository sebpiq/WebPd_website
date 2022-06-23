import React from 'react'
import styled from 'styled-components'
import { connect } from 'react-redux'
import { AppState } from '../store'
import { getWebpdEngineMode } from '../store/selectors'
import { EngineMode, setEngineMode } from '../store/webpd'
import MenuButton from './MenuButton'

const StyledMenuButton = styled(MenuButton)`
    min-width: 3em;
    i {
        margin-right: 0.3em;
    }
`

interface Props {
    engineMode: EngineMode
    setEngineMode: typeof setEngineMode
}

const ToggleEngineMode = ({ setEngineMode, engineMode }: Props) => {
    const onClick = () => setEngineMode(engineMode === 'js' ? 'wasm': 'js')
    return (
        <StyledMenuButton onClick={onClick}>
            <i className="fa fa-cog"></i> {engineMode}
        </StyledMenuButton>
    )
}

export default connect(
    (state: AppState) => ({ engineMode: getWebpdEngineMode(state) }),
    { setEngineMode }
)(ToggleEngineMode)
