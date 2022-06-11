import { connect } from 'react-redux'
import { AppState } from '../store'
import { getUiTheme } from '../store/selectors'
import { UiTheme } from '../store/ui'
import themeConfig, { Colors } from '../theme-config'

export interface ThemedProps {
    theme: UiTheme
    colors: Colors
}

export default connect((state: AppState) => {
    const theme = getUiTheme(state)
    return {
        theme,
        colors: themeConfig.colors[theme],
    }
})
