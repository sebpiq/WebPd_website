import themeConfig from "../theme-config";

export const onMobile = (css: string) => `
    @media (max-width: ${themeConfig.responsiveDimensions.mobileW}px) {
        ${css}
    }
`

export const onDesktop = (css: string) => `
    @media (min-width: ${themeConfig.responsiveDimensions.mobileW}px) {
        ${css}
    }
`