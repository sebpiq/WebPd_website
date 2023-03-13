import { call, put, takeLatest } from 'redux-saga/effects'
import { Build } from 'webpd'
import buildInput, { AVAILABLE_INPUT_FORMATS } from './build-input'
import console from './console'

export function* watchSetLocalFile() {
    yield takeLatest(buildInput.actions.setLocalFile.type, checkLocalFile)
}

function* checkLocalFile(
    action: ReturnType<typeof buildInput.actions.setLocalFile>
) {
    const guessedFormat = Build.guessFormat(action.payload.filepath)
    if (!AVAILABLE_INPUT_FORMATS.includes(guessedFormat)) {
        yield put(buildInput.actions.clear())
        yield put(console.actions.setState({
            errors: [`Invalid file input ${action.payload.filepath}`],
            warnings: [],
        }))
    }
}

export function* watchSetUrl() {
    yield takeLatest(buildInput.actions.setUrl.type, fetchUrl)
}

function* fetchUrl(
    action: ReturnType<typeof buildInput.actions.setUrl>
) {
    const url = action.payload
    try {
        const arrayBuffer: ArrayBuffer = yield call(makeRequest, url)
        yield put(buildInput.actions.fetchUrlSuccess({ arrayBuffer, url }))
    } catch (err: any) {
        yield put(buildInput.actions.fetchUrlError(err.message))
    }
}

const makeRequest = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new FetchError(`Failed to load ${url}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return arrayBuffer
}

class FetchError extends Error {}
