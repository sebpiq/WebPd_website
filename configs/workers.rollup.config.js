import typescript from '@rollup/plugin-typescript'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(new URL(import.meta.url)))

const PKG_ROOT = path.resolve(__dirname, '..')
const PUBLIC_DIR = path.resolve(PKG_ROOT, 'public')
const SRC_DIR = path.resolve(PKG_ROOT, 'src')

export default {
    input: path.resolve(SRC_DIR, 'workers/build.ts'),
    output: {
        file: path.resolve(PUBLIC_DIR, 'js/build.worker.js'),
        format: 'esm',
        sourcemap: true,
    },
    plugins: [
        typescript({ tsconfig: path.resolve(PKG_ROOT, './configs/workers.tsconfig.json') }),
        nodeResolve(),
        commonjs(),
    ],
}
