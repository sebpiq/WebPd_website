/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var audioworklets_1 = __webpack_require__(/*! @webpd/audioworklets */ "../../WebPd_audioworklets/dist/index.js");
var BIT_DEPTH = 64;
var CHANNEL_COUNT = 1;
var WASM_PATCHES = {
    'osc': null,
    'play-array': null
};
var SAMPLES = {
    'audio1': null
};
var startButton = document.querySelector('button#start');
var patchesDiv = document.querySelector('div#patches');
var context = new AudioContext();
var wasmNode;
var initializeApp = function () { return __awaiter(void 0, void 0, void 0, function () {
    var patchNames, _i, patchNames_1, name_1, _a, _b, button, sampleNames, _c, sampleNames_1, name_2, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, audioworklets_1.addModule)(context, audioworklets_1.audioworkletWasm.WorkletProcessorCode)
                // Load wasm patches
            ];
            case 1:
                _f.sent();
                patchNames = Object.keys(WASM_PATCHES);
                _i = 0, patchNames_1 = patchNames;
                _f.label = 2;
            case 2:
                if (!(_i < patchNames_1.length)) return [3 /*break*/, 5];
                name_1 = patchNames_1[_i];
                _a = WASM_PATCHES;
                _b = name_1;
                return [4 /*yield*/, loadWasmPatch(name_1)];
            case 3:
                _a[_b] = _f.sent();
                button = document.createElement('button');
                button.innerHTML = name_1;
                button.onclick = (function (name) {
                    return function () {
                        setWasmPatch(name);
                    };
                })(name_1);
                patchesDiv.appendChild(button);
                _f.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5:
                sampleNames = Object.keys(SAMPLES);
                _c = 0, sampleNames_1 = sampleNames;
                _f.label = 6;
            case 6:
                if (!(_c < sampleNames_1.length)) return [3 /*break*/, 9];
                name_2 = sampleNames_1[_c];
                _d = SAMPLES;
                _e = name_2;
                return [4 /*yield*/, loadAudioSample(name_2)];
            case 7:
                _d[_e] = _f.sent();
                _f.label = 8;
            case 8:
                _c++;
                return [3 /*break*/, 6];
            case 9: return [2 /*return*/];
        }
    });
}); };
var startAudio = function () {
    context.resume();
    wasmNode = new audioworklets_1.audioworkletWasm.WorkletNode(context, CHANNEL_COUNT, BIT_DEPTH);
    wasmNode.connect(context.destination);
    startButton.style.display = 'none';
};
var loadWasmPatch = function (name) { return __awaiter(void 0, void 0, void 0, function () {
    var url, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                url = "assets/wasm/".concat(name, ".wasm");
                return [4 /*yield*/, fetch(url)];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("unvalid response for ".concat(url, ": ").concat(response.status));
                }
                return [2 /*return*/, response.arrayBuffer()];
        }
    });
}); };
var loadAudioSample = function (name) { return __awaiter(void 0, void 0, void 0, function () {
    var url, response, audioData, audioBuffer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                url = "assets/audio/".concat(name, ".mp3");
                return [4 /*yield*/, fetch(url)];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("unvalid response for ".concat(url, ": ").concat(response.status));
                }
                return [4 /*yield*/, response.arrayBuffer()];
            case 2:
                audioData = _a.sent();
                return [4 /*yield*/, context.decodeAudioData(audioData)
                    // !!! Loading only first channel of stereo audio
                ];
            case 3:
                audioBuffer = _a.sent();
                // !!! Loading only first channel of stereo audio
                return [2 /*return*/, Float64Array.from(audioBuffer.getChannelData(0))];
        }
    });
}); };
var setWasmPatch = function (name) {
    var wasmPatch = WASM_PATCHES[name];
    if (wasmPatch) {
        console.log("set wasm patch ".concat(name, " : byte length ").concat(wasmPatch.byteLength));
        wasmNode === null || wasmNode === void 0 ? void 0 : wasmNode.port.postMessage({
            type: 'WASM', payload: {
                wasmBuffer: wasmPatch, arrays: SAMPLES
            }
        });
    }
};
initializeApp().then(function () {
    startButton.style.display = 'block';
    startButton.onclick = startAudio;
    console.log("audio initialized");
});


/***/ }),

/***/ "../../WebPd_audioworklets/dist/index.js":
/*!***********************************************!*\
  !*** ../../WebPd_audioworklets/dist/index.js ***!
  \***********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "addModule": () => (/* binding */ addModule),
/* harmony export */   "audioworkletJsEval": () => (/* binding */ index$1),
/* harmony export */   "audioworkletWasm": () => (/* binding */ index)
/* harmony export */ });
class JsEvalNode extends AudioWorkletNode {
    constructor(context, channelCount) {
        super(context, 'js-eval-node', {
            numberOfOutputs: 1,
            outputChannelCount: [channelCount],
            processorOptions: {},
        });
    }
}

var _WorkletProcessorCode$1 = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\nclass JsEvalWorkletProcessor extends AudioWorkletProcessor {\n    constructor(settings) {\n        super()\n        this.port.onmessage = this.onMessage.bind(this)\n        this.settings = {\n            channelCount: settings.outputChannelCount[0],\n        }\n        this.dspLoop = null\n        this.dspConfigured = false\n    }\n\n    process(_, outputs) {\n        const output = outputs[0]\n        if (!this.dspConfigured) {\n            if (!this.dspLoop) {\n                return true\n            }\n            this.settings.blockSize = output[0].length\n            this.dspConfigure(this.settings.blockSize)\n            this.dspConfigured = true\n        }\n        this.dspLoop(output)\n        return true\n    }\n\n    onMessage(message) {\n        switch (message.data.type) {\n            case 'CODE':\n                this.setDspCode(message.data.payload.code)\n                Object.entries(message.data.payload.arrays).forEach(([arrayName, array]) => {\n                    this.dspSetArray(arrayName, array)\n                })\n                break\n            case 'PORT':\n                this.callPort(\n                    message.data.payload.portName,\n                    message.data.payload.args\n                )\n                break\n            default:\n                new Error(`unknown message type ${message.type}`)\n        }\n    }\n\n    setDspCode(code) {\n        const { loop, ports, configure, setArray } = new Function(code)()\n        this.dspConfigured = false\n        this.dspConfigure = configure\n        this.dspLoop = loop\n        this.dspPorts = ports\n        this.dspSetArray = setArray\n    }\n\n    callPort(portName, args) {\n        if (!this.dspPorts[portName]) {\n            throw new Error(`Unknown port ${portName}`)\n        }\n        this.dspPorts[portName].apply(this, args)\n    }\n}\n\nregisterProcessor('js-eval-node', JsEvalWorkletProcessor)\n";

const WorkletProcessorCode$1 = _WorkletProcessorCode$1;

var index$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    WorkletProcessorCode: WorkletProcessorCode$1,
    WorkletNode: JsEvalNode
});

class WasmWorkletNode extends AudioWorkletNode {
    constructor(context, channelCount, bitDepth = 32) {
        super(context, 'wasm-node', {
            numberOfOutputs: 1,
            outputChannelCount: [channelCount],
            processorOptions: {
                bitDepth, sampleRate: context.sampleRate
            },
        });
    }
}

var _WorkletProcessorCode = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\n    constructor(settings) {\n        super()\n        this.port.onmessage = this.onMessage.bind(this)\n        this.settings = {\n            blockSize: null,\n            channelCount: settings.outputChannelCount[0],\n            bitDepth:\n                settings.processorOptions.bitDepth,\n            sampleRate: \n                settings.processorOptions.sampleRate,\n        }\n        this.dspConfigured = false\n        this.engine = null\n    }\n\n    process(_, outputs) {\n        const output = outputs[0]\n        if (!this.dspConfigured) {\n            if (!this.engine) {\n                return true\n            }\n            this.settings.blockSize = output[0].length\n            this.wasmOutputPointer = this.engine.configure(\n                this.settings.sampleRate,\n                this.settings.blockSize,\n            )\n            this.dspConfigured = true\n        }\n\n        this.engine.loop()\n        for (let channel = 0; channel < this.settings.channelCount; channel++) {\n            this.readChannel(channel, output[channel])\n        }\n        return true\n    }\n\n    onMessage(message) {\n        switch (message.data.type) {\n            case 'WASM':\n                this.setWasm(message.data.payload.wasmBuffer)\n                    .then(() => this.setArrays(message.data.payload.arrays))\n                break\n            default:\n                new Error(`unknown message type ${message.type}`)\n        }\n    }\n\n    // TODO : control for channelCount of wasmModule\n    setWasm(wasmBuffer) {\n        return AscWasmBindings.instantiateWasmModule(wasmBuffer).then((wasmModule) => {\n            this.engine = wasmModule.instance.exports\n            this.dspConfigured = false\n        })\n    }\n\n    setArrays(arrays) {\n        Object.entries(arrays).forEach(([arrayName, arrayData]) => {\n            if ((this.settings.bitDepth === 32 && arrayData.constructor !== Float32Array) \n                || (this.settings.bitDepth === 64 && arrayData.constructor !== Float64Array)) {\n                console.error(`Received invalid array ${arrayName} : ${arrayData.constructor}, wrong type for bit-depth ${this.bitDepth}`)\n                return\n            }\n            AscWasmBindings.setArray(this.engine, arrayName, arrayData)\n        })\n    }\n\n    readChannel(channel, destination) {\n        const wasmOutput = AscWasmBindings.liftTypedArray(\n            this.engine,\n            this.settings.bitDepth === 32 ? Float32Array : Float64Array,\n            this.wasmOutputPointer,\n        )\n        destination.set(\n            wasmOutput.subarray(\n                this.settings.blockSize * channel,\n                this.settings.blockSize * (channel + 1)\n            )\n        )\n    }\n}\n\nregisterProcessor('wasm-node', WasmWorkletProcessor)\n";

var AcmWasmBindingsCode = "var AscWasmBindings = (function (exports) {\n    'use strict';\n\n    const MESSAGE_DATUM_TYPE_STRING = Symbol.for('MESSAGE_DATUM_TYPE_STRING');\n    const MESSAGE_DATUM_TYPE_FLOAT = Symbol.for('MESSAGE_DATUM_TYPE_FLOAT');\n\n    const MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT = {\n        [MESSAGE_DATUM_TYPE_FLOAT]: 0,\n        [MESSAGE_DATUM_TYPE_STRING]: 1,\n    };\n    const INT_ARRAY_BYTES_PER_ELEMENT = Int32Array.BYTES_PER_ELEMENT;\n    const instantiateWasmModule = async (wasmBuffer) => {\n        const wasmModule = await WebAssembly.instantiate(wasmBuffer, {\n            env: {\n                abort(messagePointer, fileNamePointer, lineNumber, columnNumber) {\n                    const message = liftString(engine, messagePointer >>> 0);\n                    const fileName = liftString(engine, fileNamePointer >>> 0);\n                    lineNumber = lineNumber >>> 0;\n                    columnNumber = columnNumber >>> 0;\n                    (() => {\n                        throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);\n                    })();\n                },\n                seed() {\n                    return (() => {\n                        return Date.now() * Math.random();\n                    })();\n                },\n                'console.log'(textPointer) {\n                    console.log(liftString(engine, textPointer));\n                },\n            },\n        });\n        const engine = wasmModule.instance.exports;\n        return wasmModule;\n    };\n    const setArray = (engine, arrayName, data) => {\n        const stringPointer = lowerString(engine, arrayName);\n        const bufferPointer = lowerArrayBufferOfFloats(engine, data, engine.getBitDepth());\n        engine.setArray(stringPointer, bufferPointer);\n    };\n    const bindPorts = (engine, portSpecs) => {\n        const ports = {};\n        Object.entries(portSpecs).forEach(([variableName, spec]) => {\n            if (spec.access.includes('w')) {\n                if (spec.type === 'messages') {\n                    ports[`write_${variableName}`] = (messages) => {\n                        const messageArrayPointer = lowerMessageArray(engine, messages);\n                        engine[`write_${variableName}`](messageArrayPointer);\n                    };\n                }\n                else {\n                    ports[`write_${variableName}`] = engine[`write_${variableName}`];\n                }\n            }\n            if (spec.access.includes('r')) {\n                if (spec.type === 'messages') {\n                    ports[`read_${variableName}`] = () => {\n                        const messagesCount = engine[`read_${variableName}_length`]();\n                        const messages = [];\n                        for (let i = 0; i < messagesCount; i++) {\n                            const messagePointer = engine[`read_${variableName}_elem`](i);\n                            messages.push(liftMessage(engine, messagePointer));\n                        }\n                        return messages;\n                    };\n                }\n                else {\n                    ports[`read_${variableName}`] = engine[`read_${variableName}`];\n                }\n            }\n        });\n        return ports;\n    };\n    const lowerMessage = (engine, message) => {\n        const messageTemplate = message.reduce((template, value) => {\n            if (typeof value === 'number') {\n                template.push(engine.MESSAGE_DATUM_TYPE_FLOAT.valueOf());\n            }\n            else if (typeof value === 'string') {\n                template.push(engine.MESSAGE_DATUM_TYPE_STRING.valueOf());\n                template.push(value.length);\n            }\n            else {\n                throw new Error(`invalid message value ${value}`);\n            }\n            return template;\n        }, []);\n        const messagePointer = engine.createMessage(lowerArrayBufferOfIntegers(engine, messageTemplate));\n        message.forEach((value, index) => {\n            if (typeof value === 'number') {\n                engine.writeFloatDatum(messagePointer, index, value);\n            }\n            else if (typeof value === 'string') {\n                const stringPointer = lowerString(engine, value);\n                engine.writeStringDatum(messagePointer, index, stringPointer);\n            }\n        });\n        return messagePointer;\n    };\n    const liftMessage = (engine, messagePointer) => {\n        const messageDatumTypesPointer = engine.getMessageDatumTypes(messagePointer);\n        const messageDatumTypes = liftTypedArray(engine, Int32Array, messageDatumTypesPointer);\n        const message = [];\n        messageDatumTypes.forEach((datumType, datumIndex) => {\n            if (datumType === engine.MESSAGE_DATUM_TYPE_FLOAT.valueOf()) {\n                message.push(engine.readFloatDatum(messagePointer, datumIndex));\n            }\n            else if (datumType === engine.MESSAGE_DATUM_TYPE_STRING.valueOf()) {\n                const stringPointer = engine.readStringDatum(messagePointer, datumIndex);\n                message.push(liftString(engine, stringPointer));\n            }\n        });\n        return message;\n    };\n    const lowerMessageArray = (engine, messages) => {\n        const messageArrayPointer = engine.createMessageArray();\n        messages.forEach((message) => {\n            engine.pushMessageToArray(messageArrayPointer, lowerMessage(engine, message));\n        });\n        return messageArrayPointer;\n    };\n    const lowerArrayBufferOfIntegers = (engine, integers) => {\n        const buffer = new ArrayBuffer(INT_ARRAY_BYTES_PER_ELEMENT * integers.length);\n        const dataView = new DataView(buffer);\n        for (let i = 0; i < integers.length; i++) {\n            dataView.setInt32(INT_ARRAY_BYTES_PER_ELEMENT * i, integers[i]);\n        }\n        return lowerBuffer(engine, buffer);\n    };\n    const lowerArrayBufferOfFloats = (engine, floats, bitDepth) => {\n        const bytesPerElement = bitDepth / 8;\n        const buffer = new ArrayBuffer(bytesPerElement * floats.length);\n        const dataView = new DataView(buffer);\n        const setFloatName = bitDepth === 32 ? 'setFloat32' : 'setFloat64';\n        for (let i = 0; i < floats.length; i++) {\n            dataView[setFloatName](bytesPerElement * i, floats[i]);\n        }\n        return lowerBuffer(engine, buffer);\n    };\n    const liftTypedArray = (engine, constructor, pointer) => {\n        if (!pointer)\n            return null;\n        const memoryU32 = new Uint32Array(engine.memory.buffer);\n        return new constructor(engine.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT).slice();\n    };\n    const liftString = (engine, pointer) => {\n        if (!pointer)\n            return null;\n        pointer = pointer >>> 0;\n        const end = (pointer +\n            new Uint32Array(engine.memory.buffer)[(pointer - 4) >>> 2]) >>>\n            1;\n        const memoryU16 = new Uint16Array(engine.memory.buffer);\n        let start = pointer >>> 1;\n        let string = '';\n        while (end - start > 1024) {\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n        }\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\n    };\n    const lowerString = (engine, value) => {\n        if (value == null)\n            return 0;\n        const length = value.length, pointer = engine.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(engine.memory.buffer);\n        for (let i = 0; i < length; ++i)\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\n        return pointer;\n    };\n    const lowerBuffer = (engine, value) => {\n        if (value == null)\n            return 0;\n        const pointer = engine.__new(value.byteLength, 0) >>> 0;\n        new Uint8Array(engine.memory.buffer).set(new Uint8Array(value), pointer);\n        return pointer;\n    };\n\n    exports.INT_ARRAY_BYTES_PER_ELEMENT = INT_ARRAY_BYTES_PER_ELEMENT;\n    exports.MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT = MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT;\n    exports.bindPorts = bindPorts;\n    exports.instantiateWasmModule = instantiateWasmModule;\n    exports.liftMessage = liftMessage;\n    exports.liftString = liftString;\n    exports.liftTypedArray = liftTypedArray;\n    exports.lowerArrayBufferOfFloats = lowerArrayBufferOfFloats;\n    exports.lowerArrayBufferOfIntegers = lowerArrayBufferOfIntegers;\n    exports.lowerMessage = lowerMessage;\n    exports.lowerMessageArray = lowerMessageArray;\n    exports.lowerString = lowerString;\n    exports.setArray = setArray;\n\n    Object.defineProperty(exports, '__esModule', { value: true });\n\n    return exports;\n\n})({});\n//# sourceMappingURL=asc-wasm-bindings.iife.js.map\n";

const WorkletProcessorCode = AcmWasmBindingsCode + ';\n' + _WorkletProcessorCode;

var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    WorkletProcessorCode: WorkletProcessorCode,
    WorkletNode: WasmWorkletNode
});

const addModule = async (context, processorCode) => {
    const blob = new Blob([processorCode], { type: 'text/javascript' });
    const workletProcessorUrl = URL.createObjectURL(blob);
    return context.audioWorklet.addModule(workletProcessorUrl);
};


//# sourceMappingURL=index.js.map


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	
/******/ })()
;
//# sourceMappingURL=main.js.map