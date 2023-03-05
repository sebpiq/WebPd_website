export const download = (filename: string, data: string | ArrayBuffer, mimetype: string) => {
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

export const round = (val: number, dec=4) => {
    return Math.floor(val * Math.pow(10, dec)) / Math.pow(10, dec)
}