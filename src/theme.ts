export const generateColorScheme = (seed: number) => {
    const colors: Array<string> = []
    const colorCount = 10

    switch (seed % 2) {
        case 0:
            for (let i = 0; i < colorCount; i++) {
                const r = 0
                const g = 180 + (colorCount - i) * (240 - 180) / colorCount
                const b = 100 + i * 150 / colorCount
                colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
            }
            break
        case 1:
            for (let i = 0; i < colorCount; i++) {
                const r = 160 + i * 95 / colorCount
                const b = 80 + (colorCount - i) * 100 / colorCount
                const g = 0
                colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`)
            }
            break
    }

    return {
        colors,
        counter: 0,
        next () {
            return colors[this.counter++ % colors.length]
        }
    }
}

const COLOR_SCHEME = generateColorScheme(1)
COLOR_SCHEME.counter = 7

const theme = {

    devices: {
        desktop: {
            fontSize: 20
        }
    },

    dimensions: {
        maxContentWidth: '900px',
    },

    fonts: {
        default: 'Rajdhani',
    },

    fontSizes: {
        h1: '300%',
        h2: '140%',
    },

    colors: {
        bg1: '#111',
        bg2: '#222',
        bg3: '#444',
        bgActive1: 'green',
        fg1: '#eee',
        colorScheme: COLOR_SCHEME,
    },

    spacings: {
        'space1': '1rem',
        'space0p1': '0.25rem',
    },

    controls: {
        gridSize: 50
    }
}

export { theme }
