import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

// rollup.config.js
export default {
    input: 'src/workers/build.ts',
    output: {
        file: 'public/js/build.worker.js',
        format: 'esm',
        sourcemap: true,
    },
    plugins: [
        typescript({ tsconfig: './workers.tsconfig.json' }),
        nodeResolve(),
        commonjs(),
    ],
}
