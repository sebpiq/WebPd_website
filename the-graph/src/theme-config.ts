const CONFIG = {
    zIndex: {
        Menu: 2,
        Popup: 3
    },
    fontFamilies: {
        default: "'Source Code Pro', Helvetica, Arial, sans-serif"
    },
    spacing: {
        default: "1rem",
    },
    colors: {
        dark: {
            bg: "#444",
            bg2: "#aaa",
            text: "white",
            text2: "#999",
            bgPopup: "rgba(0, 0, 0, 0.7)",
        },
        light: {
            bg: "pink",
            bg2: "#F4E7EA",
            text: "black",
            text2: "#555",
            bgPopup: "rgba(255, 255, 255, 0.9)",
        }
    },
    responsiveDimensions: {
        mobileW: 720
    }
}

export default CONFIG

export type Colors = typeof CONFIG.colors.dark