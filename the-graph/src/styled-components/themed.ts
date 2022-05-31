import { connect } from "react-redux";
import { AppState } from "../store";
import { getUiTheme } from "../store/selectors";
import themeConfig from "../theme-config";

export default connect(
    (state: AppState) => {
        const theme = getUiTheme(state)
        return {
            theme,
            colors: themeConfig.colors[theme]
        }
    }
)