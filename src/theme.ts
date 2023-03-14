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
COLOR_SCHEME.counter = 5

const theme = {

    devices: {
        desktop: {
            fontSize: 20
        },
        mobile: {
            fontSize: 16,
            maxWidth: 600
        }
    },

    dimensions: {
        maxContentWidth: '900px',
    },

    fonts: {
        title: 'Silkscreen',
        default: 'Rajdhani',
    },

    fontSizes: {
        h1: '300%',
        h2: '140%',
    },

    colors: {
        bg1: '#333333',
        bg1p5: '#222222',
        bg2: '#1a1a1a',
        bg3: '#444444',
        fg1: '#d1d1d1',
        fg1p5: '#a1a1a1',
        fg2: '#555555',
        colorScheme: COLOR_SCHEME,
    },

    spacings: {
        'space1': '1rem',
        'space2': '2rem',
        'space0p1': '0.25rem',
    },

    controls: {
        gridSize: 50
    },

    zIndexes: {
        closeButton: 2,
        spinner: 3
    }
}

export { theme }
