declare const Nexus = any

interface Window {
    asc: any
}

declare module 'redux-query-sync' {
    function main(params: any): void
    export = main
}

declare module '*.md' {
    const content: string
    export default content
}