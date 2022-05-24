import React from 'react'
import { connect } from 'react-redux'
import { AppState } from '../store'
import { getUiTheme } from '../store/selectors'
import { setTheme, UiTheme } from '../store/ui'
import MenuButton from '../styled-components/MenuButton'

interface Props {
    theme: UiTheme
    setTheme: typeof setTheme
}

const ToggleTheme = ({ theme, setTheme }: Props) => {
    const onClick = () => {
        
        setTheme(theme === 'dark' ? 'light' : 'dark')
    }
    return (
        <MenuButton onClick={onClick}>
            <i className="fa fa-adjust"></i>theme
        </MenuButton>
    )
}

export default connect(
    (state: AppState) => ({ theme: getUiTheme(state) }),
    { setTheme }
)(ToggleTheme)