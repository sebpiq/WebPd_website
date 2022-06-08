import React from 'react'
import styled from 'styled-components'
import { connect } from 'react-redux'
import { AppState } from '../store'
import { getWebpdIsDspOn } from '../store/selectors'
import { toggleDsp } from '../store/webpd'
import MenuButton from './MenuButton'

const StyledMenuButton = styled(MenuButton)`
    min-width: 3em;
`

interface Props {
    toggleDsp: typeof toggleDsp
    isDspOn: boolean
}

const ToggleDsp = ({ toggleDsp, isDspOn }: Props) => {
    const onClick = () => toggleDsp(!isDspOn)
    return (
        <StyledMenuButton onClick={onClick}>
            {isDspOn ? <i className="fa fa-volume-up"></i> : <i className="fa fa-volume-off"></i>}
        </StyledMenuButton> 
    )
}

export default connect(
    (state: AppState) => ({ isDspOn: getWebpdIsDspOn(state) }),
    {toggleDsp}
)(ToggleDsp)