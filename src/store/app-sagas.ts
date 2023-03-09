import { delay, put, select, take } from 'redux-saga/effects'
import { Build } from 'webpd'
import app from './app'
import { selectAppWillBuildOnLoad } from './app-selectors'
import artefacts from './artefacts'
import buildInput from './build-input'
import {
    selectBuildInputArrayBuffer,
    selectBuildInputUrl,
} from './build-input-selectors'

export function* initializeApp() {
    // Initialization of assemblyscript compiler
    while (!window.asc) {
        yield delay(100)
    }
    Build.setAsc(window.asc)

    // Input from an url needs to be fetched before we continue
    const url: ReturnType<typeof selectBuildInputUrl> = yield select(
        selectBuildInputUrl
    )
    const arrayBuffer: ReturnType<typeof selectBuildInputArrayBuffer> =
        yield select(selectBuildInputArrayBuffer)
    if (url && !arrayBuffer) {
        const fetchUrlAction:
            | ReturnType<typeof buildInput.actions.fetchUrlSuccess>
            | ReturnType<typeof buildInput.actions.fetchUrlError> = yield take([
            buildInput.actions.fetchUrlSuccess,
            buildInput.actions.fetchUrlError,
        ])
        if (fetchUrlAction.type === buildInput.actions.fetchUrlError.type) {
            console.log('INIT FAILED ERROR')
            return 
        }
    }

    // Finally, start a build if it was requested
    const willBuildOnLoad: ReturnType<typeof selectAppWillBuildOnLoad> =
        yield select(selectAppWillBuildOnLoad)
    if (willBuildOnLoad) {
        yield put(artefacts.actions.startBuild())
    }

    // Signal the end of initialization sequence
    yield put(app.actions.initializationDone())
}
