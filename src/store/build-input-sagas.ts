import { call, put, takeLatest } from 'redux-saga/effects'
import buildInput from './build-input'

export function* watchSetUrl() {
    yield takeLatest(buildInput.actions.setUrl.type, fetchUrl)
}

export function* fetchUrl(
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
