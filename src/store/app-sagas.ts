import { delay, put, select } from 'redux-saga/effects'
import { build } from 'webpd'
import app from './app'
import { selectAppWillBuildOnLoad } from './app-selectors'
import artefacts from './artefacts'

export function* initializeApp() {
    // Give a chance for the sync between redux and url
    // to happen, so we get properly initialized state.
    yield delay(10)
    while (!window.asc) {
        yield delay(100)
    }
    build.setAsc(window.asc)

    yield put(app.actions.initializationDone())
    const willBuildOnLoad: ReturnType<typeof selectAppWillBuildOnLoad> =
        yield select(selectAppWillBuildOnLoad)
    if (willBuildOnLoad) {
        yield put(artefacts.actions.startBuild())
    }
}
