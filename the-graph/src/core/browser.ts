export const download = (filename: string, data: string, mimetype: string) => {
    const blob = new Blob([data], { type: mimetype })
    if ((window.navigator as any).msSaveOrOpenBlob) {
        ;(window.navigator as any).msSaveBlob(blob, filename)
    } else {
        const elem = window.document.createElement('a')
        elem.href = window.URL.createObjectURL(blob)
        elem.download = filename
        document.body.appendChild(elem)
        elem.click()
        document.body.removeChild(elem)
    }
}

export const isTouchDevice = () =>
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.addEventListener('load', (event) => {
            resolve(event.target.result as ArrayBuffer)
        })
        reader.readAsArrayBuffer(file)
    })
}

export const readFileAsString = (file: File): Promise<string> => {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.addEventListener('load', (event) => {
            resolve(event.target.result as string)
        })
        reader.readAsText(file)
    })
}