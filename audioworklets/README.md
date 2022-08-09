Compile wasm modules
-----------------------

To compile Wasm modules from `assets/wasm`, first install the assemblyscript compiler : 

```
npm i assemblyscript
```

you can then compile them with the following command :

```
npx asc osc.ts --exportRuntime -o osc.wasm
```