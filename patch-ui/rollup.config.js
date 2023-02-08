import { nodeResolve } from '@rollup/plugin-node-resolve';

// rollup.config.js
export default {
	input: 'src/main.js',
	output: {
		file: 'www/js/bundle.js',
		format: 'iife',
		sourcemap: true,
	},
    plugins: [nodeResolve()]
};