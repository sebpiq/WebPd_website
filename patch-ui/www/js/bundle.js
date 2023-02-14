(function () {
  'use strict';

  var _WebPdWorkletProcessorCode = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\nconst FS_CALLBACK_NAMES = [\n    'onReadSoundFile',\n    'onOpenSoundReadStream',\n    'onWriteSoundFile',\n    'onOpenSoundWriteStream',\n    'onSoundStreamData',\n    'onCloseSoundStream',\n];\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\n    constructor() {\n        super();\n        this.port.onmessage = this.onMessage.bind(this);\n        this.settings = {\n            blockSize: null,\n            sampleRate,\n        };\n        this.dspConfigured = false;\n        this.engine = null;\n    }\n    process(inputs, outputs) {\n        const output = outputs[0];\n        const input = inputs[0];\n        if (!this.dspConfigured) {\n            if (!this.engine) {\n                return true;\n            }\n            this.settings.blockSize = output[0].length;\n            this.engine.configure(this.settings.sampleRate, this.settings.blockSize);\n            this.dspConfigured = true;\n        }\n        this.engine.loop(input, output);\n        return true;\n    }\n    onMessage(messageEvent) {\n        const message = messageEvent.data;\n        switch (message.type) {\n            case 'code:WASM':\n                this.setWasm(message.payload.wasmBuffer).then(() => this.setArrays(message.payload.arrays));\n                break;\n            case 'code:JS':\n                this.setJsCode(message.payload.jsCode);\n                this.setArrays(message.payload.arrays);\n                break;\n            case 'inletCaller':\n                this.engine.inletCallers[message.payload.nodeId][message.payload.portletId](message.payload.message);\n                break;\n            case 'fs':\n                const returned = this.engine.fs[message.payload.functionName].apply(null, message.payload.arguments);\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName: message.payload.functionName + '_return',\n                        operationId: message.payload.arguments[0],\n                        returned,\n                    },\n                });\n                break;\n            case 'destroy':\n                this.destroy();\n                break;\n            default:\n                new Error(`unknown message type ${message.type}`);\n        }\n    }\n    // TODO : control for channelCount of wasmModule\n    setWasm(wasmBuffer) {\n        return AssemblyscriptWasmBindings.createEngine(wasmBuffer).then((engine) => {\n            this.setEngine(engine);\n            return engine;\n        });\n    }\n    setJsCode(code) {\n        const engine = new Function(`\n            ${code}\n            return exports\n        `)();\n        this.setEngine(engine);\n    }\n    setEngine(engine) {\n        FS_CALLBACK_NAMES.forEach((functionName) => {\n            ;\n            engine.fs[functionName] = (...args) => {\n                // We don't use transferables, because that would imply reallocating each time new array in the engine.\n                this.port.postMessage({\n                    type: 'fs',\n                    payload: {\n                        functionName,\n                        arguments: args,\n                    },\n                });\n            };\n        });\n        this.engine = engine;\n        this.dspConfigured = false;\n    }\n    setArrays(arrays) {\n        Object.entries(arrays).forEach(([arrayName, arrayData]) => {\n            this.engine.commons.setArray(arrayName, arrayData);\n        });\n    }\n    destroy() {\n        this.process = () => false;\n    }\n}\nregisterProcessor('webpd-node', WasmWorkletProcessor);\n";

  var AssemblyscriptWasmBindingsCode = "var AssemblyscriptWasmBindings = (function (exports) {\n    'use strict';\n\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n\n    const liftString = (wasmExports, pointer) => {\n        if (!pointer)\n            return null;\n        pointer = pointer >>> 0;\n        const end = (pointer +\n            new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\n            1;\n        const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        let start = pointer >>> 1;\n        let string = '';\n        while (end - start > 1024) {\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n        }\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\n    };\n    const lowerString = (wasmExports, value) => {\n        if (value == null)\n            return 0;\n        const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n        for (let i = 0; i < length; ++i)\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\n        return pointer;\n    };\n    const readTypedArray = (wasmExports, constructor, pointer) => {\n        if (!pointer)\n            return null;\n        const memoryU32 = new Uint32Array(wasmExports.memory.buffer);\n        return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\n    };\n    const lowerFloatArray = (wasmExports, bitDepth, data) => {\n        const arrayType = getFloatArrayType(bitDepth);\n        const arrayPointer = wasmExports.createFloatArray(data.length);\n        const array = readTypedArray(wasmExports, arrayType, arrayPointer);\n        array.set(data);\n        return { array, arrayPointer };\n    };\n    const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {\n        const arraysPointer = wasmExports.core_createListOfArrays();\n        data.forEach((array) => {\n            const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);\n            wasmExports.core_pushToListOfArrays(arraysPointer, arrayPointer);\n        });\n        return arraysPointer;\n    };\n    const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {\n        const listLength = wasmExports.core_getListOfArraysLength(listOfArraysPointer);\n        const arrays = [];\n        const arrayType = getFloatArrayType(bitDepth);\n        for (let i = 0; i < listLength; i++) {\n            const arrayPointer = wasmExports.core_getListOfArraysElem(listOfArraysPointer, i);\n            arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));\n        }\n        return arrays;\n    };\n\n    const liftMessage = (wasmExports, messagePointer) => {\n        const messageTokenTypesPointer = wasmExports.msg_getTokenTypes(messagePointer);\n        const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);\n        const message = [];\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\n            if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {\n                message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));\n            }\n            else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {\n                const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);\n                message.push(liftString(wasmExports, stringPointer));\n            }\n        });\n        return message;\n    };\n    const lowerMessage = (wasmExports, message) => {\n        const template = message.reduce((template, value) => {\n            if (typeof value === 'number') {\n                template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());\n            }\n            else if (typeof value === 'string') {\n                template.push(wasmExports.MSG_STRING_TOKEN.valueOf());\n                template.push(value.length);\n            }\n            else {\n                throw new Error(`invalid message value ${value}`);\n            }\n            return template;\n        }, []);\n        const templateArrayPointer = wasmExports.msg_createTemplate(template.length);\n        const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);\n        loweredTemplateArray.set(template);\n        const messagePointer = wasmExports.msg_create(templateArrayPointer);\n        message.forEach((value, index) => {\n            if (typeof value === 'number') {\n                wasmExports.msg_writeFloatToken(messagePointer, index, value);\n            }\n            else if (typeof value === 'string') {\n                const stringPointer = lowerString(wasmExports, value);\n                wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);\n            }\n        });\n        return messagePointer;\n    };\n\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\n            env: {\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\n                    const message = liftString(wasmExports, messagePointer);\n                    lineNumber = lineNumber;\n                    columnNumber = columnNumber;\n                    (() => {\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\n                    })();\n                },\n                seed: () => {\n                    return (() => {\n                        return Date.now() * Math.random();\n                    })();\n                },\n                'console.log': (textPointer) => {\n                    console.log(liftString(wasmExports, textPointer));\n                },\n            },\n            ...wasmImports,\n        });\n        const wasmExports = instanceAndModule.instance\n            .exports;\n        return instanceAndModule.instance;\n    };\n\n    const mapObject = (src, func) => {\n        const dest = {};\n        Object.entries(src).forEach(([key, srcValue], i) => {\n            dest[key] = func(srcValue, key, i);\n        });\n        return dest;\n    };\n    const mapArray = (src, func) => {\n        const dest = {};\n        src.forEach((srcValue, i) => {\n            const [key, destValue] = func(srcValue, i);\n            dest[key] = destValue;\n        });\n        return dest;\n    };\n\n    const createEngine = async (wasmBuffer) => {\n        const engine = new AssemblyScriptWasmEngine(wasmBuffer);\n        await engine.initialize();\n        return engine;\n    };\n    class AssemblyScriptWasmEngine {\n        constructor(wasmBuffer) {\n            this.wasmBuffer = wasmBuffer;\n        }\n        async initialize() {\n            this.metadata = await readMetadata(this.wasmBuffer);\n            this.bitDepth = this.metadata.audioSettings.bitDepth;\n            this.arrayType = getFloatArrayType(this.bitDepth);\n            const wasmImports = {\n                ...this._fsImports(),\n                ...this._outletListenersImports(),\n            };\n            const wasmInstance = await instantiateWasmModule(this.wasmBuffer, {\n                input: wasmImports,\n            });\n            this.wasmExports =\n                wasmInstance.exports;\n            this.commons = this._bindCommons();\n            this.fs = this._bindFs();\n            this.inletCallers = this._bindInletCallers();\n            this.outletListeners = this._bindOutletListeners();\n        }\n        configure(sampleRate, blockSize) {\n            this.blockSize = blockSize;\n            this.metadata.audioSettings.blockSize = blockSize;\n            this.metadata.audioSettings.sampleRate = sampleRate;\n            this.wasmExports.configure(sampleRate, blockSize);\n            this._updateWasmInOuts();\n        }\n        loop(input, output) {\n            for (let channel = 0; channel < input.length; channel++) {\n                this.wasmInput.set(input[channel], channel * this.blockSize);\n            }\n            this._updateWasmInOuts();\n            this.wasmExports.loop();\n            this._updateWasmInOuts();\n            for (let channel = 0; channel < output.length; channel++) {\n                output[channel].set(this.wasmOutput.subarray(this.blockSize * channel, this.blockSize * (channel + 1)));\n            }\n        }\n        _updateWasmInOuts() {\n            this.wasmOutput = readTypedArray(this.wasmExports, this.arrayType, this.wasmExports.getOutput());\n            this.wasmInput = readTypedArray(this.wasmExports, this.arrayType, this.wasmExports.getInput());\n        }\n        _bindCommons() {\n            return {\n                getArray: (arrayName) => {\n                    const arrayNamePointer = lowerString(this.wasmExports, arrayName);\n                    const arrayPointer = this.wasmExports.commons_getArray(arrayNamePointer);\n                    return readTypedArray(this.wasmExports, this.arrayType, arrayPointer);\n                },\n                setArray: (arrayName, array) => {\n                    const stringPointer = lowerString(this.wasmExports, arrayName);\n                    const { arrayPointer } = lowerFloatArray(this.wasmExports, this.bitDepth, array);\n                    this.wasmExports.commons_setArray(stringPointer, arrayPointer);\n                    this._updateWasmInOuts();\n                },\n            };\n        }\n        _bindFs() {\n            return {\n                sendReadSoundFileResponse: (operationId, status, sound) => {\n                    let soundPointer = 0;\n                    if (sound) {\n                        soundPointer = lowerListOfFloatArrays(this.wasmExports, this.bitDepth, sound);\n                    }\n                    this.wasmExports.fs_onReadSoundFileResponse(operationId, status, soundPointer);\n                    this._updateWasmInOuts();\n                },\n                sendWriteSoundFileResponse: this.wasmExports.fs_onWriteSoundFileResponse,\n                sendSoundStreamData: (operationId, sound) => {\n                    const soundPointer = lowerListOfFloatArrays(this.wasmExports, this.bitDepth, sound);\n                    const writtenFrameCount = this.wasmExports.fs_onSoundStreamData(operationId, soundPointer);\n                    this._updateWasmInOuts();\n                    return writtenFrameCount;\n                },\n                closeSoundStream: this.wasmExports.fs_onCloseSoundStream,\n                onReadSoundFile: () => undefined,\n                onWriteSoundFile: () => undefined,\n                onOpenSoundReadStream: () => undefined,\n                onOpenSoundWriteStream: () => undefined,\n                onSoundStreamData: () => undefined,\n                onCloseSoundStream: () => undefined,\n            };\n        }\n        _fsImports() {\n            let wasmImports = {\n                i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onReadSoundFile(operationId, url, info);\n                },\n                i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {\n                    const sound = readListOfFloatArrays(this.wasmExports, this.bitDepth, soundPointer);\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onWriteSoundFile(operationId, sound, url, info);\n                },\n                i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this._updateWasmInOuts();\n                    this.fs.onOpenSoundReadStream(operationId, url, info);\n                },\n                i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {\n                    const url = liftString(this.wasmExports, urlPointer);\n                    const info = liftMessage(this.wasmExports, infoPointer);\n                    this.fs.onOpenSoundWriteStream(operationId, url, info);\n                },\n                i_fs_sendSoundStreamData: (operationId, blockPointer) => {\n                    const block = readListOfFloatArrays(this.wasmExports, this.bitDepth, blockPointer);\n                    this.fs.onSoundStreamData(operationId, block);\n                },\n                i_fs_closeSoundStream: (...args) => this.fs.onCloseSoundStream(...args),\n            };\n            return wasmImports;\n        }\n        _bindInletCallers() {\n            return mapObject(this.metadata.compilation.inletCallerSpecs, (inletIds, nodeId) => mapArray(inletIds, (inletId) => [\n                inletId,\n                (message) => {\n                    const messagePointer = lowerMessage(this.wasmExports, message);\n                    this.wasmExports[this.metadata.compilation.codeVariableNames\n                        .inletCallers[nodeId][inletId]](messagePointer);\n                },\n            ]));\n        }\n        _bindOutletListeners() {\n            return mapObject(this.metadata.compilation.outletListenerSpecs, (outletIds) => mapArray(outletIds, (outletId) => [\n                outletId,\n                {\n                    onMessage: () => undefined,\n                },\n            ]));\n        }\n        _outletListenersImports() {\n            const wasmImports = {};\n            const { codeVariableNames } = this.metadata.compilation;\n            Object.entries(this.metadata.compilation.outletListenerSpecs).forEach(([nodeId, outletIds]) => {\n                outletIds.forEach((outletId) => {\n                    const listenerName = codeVariableNames.outletListeners[nodeId][outletId];\n                    wasmImports[listenerName] = (messagePointer) => {\n                        const message = liftMessage(this.wasmExports, messagePointer);\n                        this.outletListeners[nodeId][outletId].onMessage(message);\n                    };\n                });\n            });\n            return wasmImports;\n        }\n    }\n    const readMetadata = async (wasmBuffer) => {\n        const inputImports = {};\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\n        wasmModule\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n            input: inputImports,\n        });\n        const wasmExports = wasmInstance.exports;\n        const stringPointer = wasmExports.metadata.valueOf();\n        const metadataJSON = liftString(wasmExports, stringPointer);\n        return JSON.parse(metadataJSON);\n    };\n\n    exports.AssemblyScriptWasmEngine = AssemblyScriptWasmEngine;\n    exports.createEngine = createEngine;\n    exports.readMetadata = readMetadata;\n\n    return exports;\n\n})({});\n//# sourceMappingURL=assemblyscript-wasm-bindings.iife.js.map\n";

  var fetchRetry$1 = function (fetch, defaults) {
    defaults = defaults || {};
    if (typeof fetch !== 'function') {
      throw new ArgumentError('fetch must be a function');
    }

    if (typeof defaults !== 'object') {
      throw new ArgumentError('defaults must be an object');
    }

    if (defaults.retries !== undefined && !isPositiveInteger(defaults.retries)) {
      throw new ArgumentError('retries must be a positive integer');
    }

    if (defaults.retryDelay !== undefined && !isPositiveInteger(defaults.retryDelay) && typeof defaults.retryDelay !== 'function') {
      throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');
    }

    if (defaults.retryOn !== undefined && !Array.isArray(defaults.retryOn) && typeof defaults.retryOn !== 'function') {
      throw new ArgumentError('retryOn property expects an array or function');
    }

    var baseDefaults = {
      retries: 3,
      retryDelay: 1000,
      retryOn: [],
    };

    defaults = Object.assign(baseDefaults, defaults);

    return function fetchRetry(input, init) {
      var retries = defaults.retries;
      var retryDelay = defaults.retryDelay;
      var retryOn = defaults.retryOn;

      if (init && init.retries !== undefined) {
        if (isPositiveInteger(init.retries)) {
          retries = init.retries;
        } else {
          throw new ArgumentError('retries must be a positive integer');
        }
      }

      if (init && init.retryDelay !== undefined) {
        if (isPositiveInteger(init.retryDelay) || (typeof init.retryDelay === 'function')) {
          retryDelay = init.retryDelay;
        } else {
          throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');
        }
      }

      if (init && init.retryOn) {
        if (Array.isArray(init.retryOn) || (typeof init.retryOn === 'function')) {
          retryOn = init.retryOn;
        } else {
          throw new ArgumentError('retryOn property expects an array or function');
        }
      }

      // eslint-disable-next-line no-undef
      return new Promise(function (resolve, reject) {
        var wrappedFetch = function (attempt) {
          var _input =
            typeof Request !== 'undefined' && input instanceof Request
              ? input.clone()
              : input;
          fetch(_input, init)
            .then(function (response) {
              if (Array.isArray(retryOn) && retryOn.indexOf(response.status) === -1) {
                resolve(response);
              } else if (typeof retryOn === 'function') {
                try {
                  // eslint-disable-next-line no-undef
                  return Promise.resolve(retryOn(attempt, null, response))
                    .then(function (retryOnResponse) {
                      if(retryOnResponse) {
                        retry(attempt, null, response);
                      } else {
                        resolve(response);
                      }
                    }).catch(reject);
                } catch (error) {
                  reject(error);
                }
              } else {
                if (attempt < retries) {
                  retry(attempt, null, response);
                } else {
                  resolve(response);
                }
              }
            })
            .catch(function (error) {
              if (typeof retryOn === 'function') {
                try {
                  // eslint-disable-next-line no-undef
                  Promise.resolve(retryOn(attempt, error, null))
                    .then(function (retryOnResponse) {
                      if(retryOnResponse) {
                        retry(attempt, error, null);
                      } else {
                        reject(error);
                      }
                    })
                    .catch(function(error) {
                      reject(error);
                    });
                } catch(error) {
                  reject(error);
                }
              } else if (attempt < retries) {
                retry(attempt, error, null);
              } else {
                reject(error);
              }
            });
        };

        function retry(attempt, error, response) {
          var delay = (typeof retryDelay === 'function') ?
            retryDelay(attempt, error, response) : retryDelay;
          setTimeout(function () {
            wrappedFetch(++attempt);
          }, delay);
        }

        wrappedFetch(0);
      });
    };
  };

  function isPositiveInteger(value) {
    return Number.isInteger(value) && value >= 0;
  }

  function ArgumentError(message) {
    this.name = 'ArgumentError';
    this.message = message;
  }

  const fetchRetry = fetchRetry$1(fetch);
  const addModule = async (context, processorCode) => {
      const blob = new Blob([processorCode], { type: 'text/javascript' });
      const workletProcessorUrl = URL.createObjectURL(blob);
      return context.audioWorklet.addModule(workletProcessorUrl);
  };
  // TODO : testing
  const fetchFile = async (url) => {
      let response;
      try {
          response = await fetchRetry(url, { retries: 3 });
      }
      catch (err) {
          throw new FileError(response.status, err.toString());
      }
      if (!response.ok) {
          const responseText = await response.text();
          throw new FileError(response.status, responseText);
      }
      return response.arrayBuffer();
  };
  const audioBufferToArray = (audioBuffer) => {
      const sound = [];
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          sound.push(audioBuffer.getChannelData(channel));
      }
      return sound;
  };
  // TODO : testing
  const fixSoundChannelCount = (sound, targetChannelCount) => {
      if (sound.length === 0) {
          throw new Error(`Received empty sound`);
      }
      const floatArrayType = sound[0].constructor;
      const frameCount = sound[0].length;
      const fixedSound = sound.slice(0, targetChannelCount);
      while (sound.length < targetChannelCount) {
          fixedSound.push(new floatArrayType(frameCount));
      }
      return fixedSound;
  };
  class FileError extends Error {
      constructor(status, msg) {
          super(`Error ${status} : ${msg}`);
      }
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // Concatenate WorkletProcessor code with the Wasm bindings it needs
  const WebPdWorkletProcessorCode = AssemblyscriptWasmBindingsCode + ';\n' + _WebPdWorkletProcessorCode;
  const registerWebPdWorkletNode = (context) => {
      return addModule(context, WebPdWorkletProcessorCode);
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const FILES = {};
  const STREAMS = {};
  class FakeStream {
      constructor(url, sound) {
          this.url = url;
          this.sound = sound;
          this.frameCount = sound[0].length;
          this.readPosition = 0;
      }
  }
  const read = async (url) => {
      if (FILES[url]) {
          return FILES[url];
      }
      const arrayBuffer = await fetchFile(url);
      return {
          type: 'binary',
          data: arrayBuffer,
      };
  };
  // TODO : testing
  const readSound = async (url, context) => {
      let fakeFile = FILES[url] || await read(url);
      switch (fakeFile.type) {
          case 'binary':
              const audioBuffer = await context.decodeAudioData(fakeFile.data);
              return audioBufferToArray(audioBuffer);
          case 'sound':
              // We copy the data here o it can be manipulated freely by the host.
              // e.g. if the buffer is sent as transferrable to the node we don't want the original to be transferred.
              return fakeFile.data.map(array => array.slice());
      }
  };
  const writeSound = async (sound, url) => {
      FILES[url] = {
          type: 'sound',
          data: sound,
      };
  };
  const readStreamSound = async (operationId, url, channelCount, context) => {
      const sound = await readSound(url, context);
      STREAMS[operationId] = new FakeStream(url, fixSoundChannelCount(sound, channelCount));
      return STREAMS[operationId];
  };
  const writeStreamSound = async (operationId, url, channelCount) => {
      const emptySound = [];
      for (let channel = 0; channel < channelCount; channel++) {
          emptySound.push(new Float32Array(0));
      }
      STREAMS[operationId] = new FakeStream(url, emptySound);
      FILES[url] = {
          type: 'sound',
          data: emptySound,
      };
      return STREAMS[operationId];
  };
  const getStream = (operationId) => {
      return STREAMS[operationId];
  };
  const killStream = (operationId) => {
      console.log('KILL STREAM', operationId);
      delete STREAMS[operationId];
  };
  const pullBlock = (stream, frameCount) => {
      const block = stream.sound.map((array) => array.slice(stream.readPosition, stream.readPosition + frameCount));
      stream.readPosition += frameCount;
      return block;
  };
  const pushBlock = (stream, block) => {
      stream.sound = stream.sound.map((channelData, channel) => {
          const concatenated = new Float32Array(channelData.length + block[channel].length);
          concatenated.set(channelData);
          concatenated.set(block[channel], channelData.length);
          return concatenated;
      });
      stream.frameCount = stream.sound[0].length;
      FILES[stream.url].data = stream.sound;
  };
  var fakeFs = {
      writeSound, readSound, readStreamSound, writeStreamSound, pullBlock, pushBlock
  };

  var closeSoundStream = async (node, payload) => {
      if (payload.functionName === 'onCloseSoundStream') {
          killStream(payload.arguments[0]);
      }
  };

  const FS_OPERATION_SUCCESS$1 = 0;
  const FS_OPERATION_FAILURE$1 = 1;

  var readSoundFile = async (node, payload) => {
      if (payload.functionName === 'onReadSoundFile') {
          const [operationId, url, [channelCount]] = payload.arguments;
          let operationStatus = FS_OPERATION_SUCCESS$1;
          let sound = null;
          try {
              sound = await fakeFs.readSound(url, node.context);
          }
          catch (err) {
              operationStatus = FS_OPERATION_FAILURE$1;
              console.error(err);
          }
          if (sound) {
              sound = fixSoundChannelCount(sound, channelCount);
          }
          node.port.postMessage({
              type: 'fs',
              payload: {
                  functionName: 'sendReadSoundFileResponse',
                  arguments: [operationId, operationStatus, sound],
              },
          }, 
          // Add as transferables to avoid copies between threads
          sound.map((array) => array.buffer));
      }
      else if (payload.functionName === 'sendReadSoundFileResponse_return') ;
  };

  const BUFFER_HIGH = 10 * 44100;
  const BUFFER_LOW = BUFFER_HIGH / 2;
  var readSoundStream = async (node, payload) => {
      if (payload.functionName === 'onOpenSoundReadStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          try {
              await fakeFs.readStreamSound(operationId, url, channelCount, node.context);
          }
          catch (err) {
              console.error(err);
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'closeSoundStream',
                      arguments: [operationId, FS_OPERATION_FAILURE$1],
                  },
              });
              return;
          }
          streamLoop(node, operationId, 0);
      }
      else if (payload.functionName === 'sendSoundStreamData_return') {
          const stream = getStream(payload.operationId);
          if (!stream) {
              throw new Error(`unknown stream ${payload.operationId}`);
          }
          streamLoop(node, payload.operationId, payload.returned);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          const stream = getStream(payload.operationId);
          if (stream) {
              killStream(payload.operationId);
          }
      }
  };
  const streamLoop = (node, operationId, framesAvailableInEngine) => {
      const sampleRate = node.context.sampleRate;
      const secondsToThreshold = Math.max(framesAvailableInEngine - BUFFER_LOW, 10) / sampleRate;
      const framesToSend = BUFFER_HIGH -
          (framesAvailableInEngine - secondsToThreshold * sampleRate);
      setTimeout(() => {
          const stream = getStream(operationId);
          if (!stream) {
              console.log(`stream ${operationId} was maybe closed`);
              return;
          }
          if (stream.readPosition < stream.frameCount) {
              const block = pullBlock(stream, framesToSend);
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'sendSoundStreamData',
                      arguments: [operationId, block],
                  },
              }, 
              // Add as transferables to avoid copies between threads
              block.map((array) => array.buffer));
          }
          else {
              node.port.postMessage({
                  type: 'fs',
                  payload: {
                      functionName: 'closeSoundStream',
                      arguments: [operationId, FS_OPERATION_SUCCESS$1],
                  },
              });
          }
      }, secondsToThreshold * 1000);
  };

  var writeSoundFile = async (node, payload) => {
      if (payload.functionName === 'onWriteSoundFile') {
          const [operationId, sound, url, [channelCount]] = payload.arguments;
          const fixedSound = fixSoundChannelCount(sound, channelCount);
          await fakeFs.writeSound(fixedSound, url);
          let operationStatus = FS_OPERATION_SUCCESS$1;
          node.port.postMessage({
              type: 'fs',
              payload: {
                  functionName: 'sendWriteSoundFileResponse',
                  arguments: [operationId, operationStatus],
              },
          });
      }
      else if (payload.functionName === 'sendWriteSoundFileResponse_return') ;
  };

  var writeSoundStream = async (_, payload) => {
      if (payload.functionName === 'onOpenSoundWriteStream') {
          const [operationId, url, [channelCount]] = payload.arguments;
          await fakeFs.writeStreamSound(operationId, url, channelCount);
      }
      else if (payload.functionName === 'onSoundStreamData') {
          const [operationId, sound] = payload.arguments;
          const stream = getStream(operationId);
          if (!stream) {
              throw new Error(`unknown stream ${operationId}`);
          }
          pushBlock(stream, sound);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          const stream = getStream(payload.operationId);
          if (stream) {
              killStream(payload.operationId);
          }
      }
  };

  var index = async (node, messageEvent) => {
      const message = messageEvent.data;
      const { payload } = message;
      if (message.type !== 'fs') {
          throw new Error(`Unknown message type from node ${message.type}`);
      }
      if (payload.functionName === 'onReadSoundFile' ||
          payload.functionName === 'sendReadSoundFileResponse_return') {
          readSoundFile(node, payload);
      }
      else if (payload.functionName === 'onOpenSoundReadStream' ||
          payload.functionName === 'sendSoundStreamData_return') {
          readSoundStream(node, payload);
      }
      else if (payload.functionName === 'onWriteSoundFile' ||
          payload.functionName === 'sendWriteSoundFileResponse_return') {
          writeSoundFile(node, payload);
      }
      else if (payload.functionName === 'onOpenSoundWriteStream' ||
          payload.functionName === 'onSoundStreamData') {
          writeSoundStream(node, payload);
      }
      else if (payload.functionName === 'closeSoundStream_return') {
          writeSoundStream(node, payload);
          readSoundStream(node, payload);
      }
      else if (payload.functionName === 'onCloseSoundStream') {
          closeSoundStream(node, payload);
      }
      else {
          throw new Error(`Unknown callback ${payload.functionName}`);
      }
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // TODO : manage transferables
  class WebPdWorkletNode extends AudioWorkletNode {
      constructor(context) {
          super(context, 'webpd-node', {
              numberOfOutputs: 1,
              outputChannelCount: [2],
          });
      }
      destroy() {
          this.port.postMessage({
              type: 'destroy',
              payload: {},
          });
      }
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const CONTROL_TYPE$1 = {
      floatatom: 'floatatom',
      symbolatom: 'symbolatom',
      bng: 'bng',
      tgl: 'tgl',
      nbx: 'nbx',
      vsl: 'vsl',
      hsl: 'hsl',
      vradio: 'vradio',
      hradio: 'hradio',
      vu: 'vu',
      cnv: 'cnv',
      msg: 'msg',
  };

  var IdNamespaces$2;
  (function (IdNamespaces) {
      IdNamespaces["PD"] = "n";
      IdNamespaces["MIXER"] = "m";
  })(IdNamespaces$2 || (IdNamespaces$2 = {}));

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // Regular expressions to detect escaped special chars.
  const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g;
  const ESCAPED_COMMA_VAR_RE_GLOB = /\\,/g;
  const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\;/g;
  /**
   * Parses token to a node arg (string or a number).
   * Needs to handle the case when the token is already a number as in the process of gathering
   * arguments we sometimes insert a number.
   */
  const parseArg = (rawArg) => {
      // Try to parse arg as a number
      try {
          return parseFloatToken(rawArg);
      }
      catch (err) {
          if (!(err instanceof ValueError)) {
              throw err;
          }
      }
      // Try to parse arg as a string
      try {
          return parseStringToken(rawArg);
      }
      catch (err) {
          if (!(err instanceof ValueError)) {
              throw err;
          }
      }
      throw new ValueError(`Not a valid arg ${rawArg}`);
  };
  /** Parses a float from a .pd file. Returns the parsed float or throws ValueError. */
  const parseFloatToken = (val) => {
      if (isNumber(val)) {
          return val;
      }
      else if (isString(val)) {
          // `Number` is better than `parseFloat` for example 
          // which is too flexible.
          // REF : https://stackoverflow.com/questions/3257112/is-it-possible-to-parsefloat-the-whole-string
          const parsed = Number(val);
          if (isNaN(parsed)) {
              throw new ValueError(`Not a valid number arg ${val}`);
          }
          return parsed;
      }
      else {
          throw new ValueError(`Not a valid number arg ${val}`);
      }
  };
  /** Parses an int from a .pd file. Returns the parsed int or throws ValueError. */
  const parseIntToken = (token) => {
      if (token === undefined) {
          throw new ValueError(`Received undefined`);
      }
      return parseInt(token, 10);
  };
  /** Parses a '0' or '1' from a .pd file. */
  const parseBoolToken = (val) => {
      const parsed = parseFloatToken(val);
      if (parsed === 0 || parsed === 1) {
          return parsed;
      }
      throw new ValueError(`Should be 0 or 1`);
  };
  /**
   * Apply some operations to a string arg.
   * @todo : document + dollar-var substitution should not be done here.
   */
  const parseStringToken = (val, emptyValue = null) => {
      if (!isString(val)) {
          throw new ValueError(`Not a valid string arg ${val}`);
      }
      // If empty value, make real empty string
      if (emptyValue !== null && val === emptyValue) {
          return '';
      }
      // Unescape special characters
      let arg = val
          .replace(ESCAPED_COMMA_VAR_RE_GLOB, ',')
          .replace(ESCAPED_SEMICOLON_VAR_RE_GLOB, ';');
      // Unescape dollars
      let matched;
      while ((matched = ESCAPED_DOLLAR_VAR_RE_GLOB.exec(arg))) {
          arg = arg.replace(matched[0], matched[1]);
      }
      return arg;
  };
  class ValueError extends Error {
  }
  const isNumber = (obj) => Number.isFinite(obj);
  const isString = (obj) => typeof obj === 'string';

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * @param coordsTokenizedLine Defined only if the patch declares a graph on its parent,
   * i.e. if the patch has a UI visible in its parent.
   */
  const hydratePatch = (id, canvasTokenizedLine, coordsTokenizedLine) => {
      const { tokens: canvasTokens } = canvasTokenizedLine;
      const coordsTokens = coordsTokenizedLine ? coordsTokenizedLine.tokens : null;
      let layout = {
          windowX: parseIntToken(canvasTokens[2]),
          windowY: parseIntToken(canvasTokens[3]),
          windowWidth: parseIntToken(canvasTokens[4]),
          windowHeight: parseIntToken(canvasTokens[5]),
      };
      if (typeof canvasTokens[7] !== 'undefined') {
          layout.openOnLoad = parseBoolToken(canvasTokens[7]);
      }
      if (coordsTokens && typeof coordsTokens[8] !== 'undefined') {
          const graphOnParentRaw = parseFloatToken(coordsTokens[8]);
          layout.graphOnParent = graphOnParentRaw > 0 ? 1 : 0;
          if (layout.graphOnParent === 1) {
              layout = {
                  ...layout,
                  hideObjectNameAndArguments: graphOnParentRaw === 2 ? 1 : 0,
                  viewportX: coordsTokens[9] ? parseIntToken(coordsTokens[9]) : 0,
                  viewportY: coordsTokens[10] ? parseIntToken(coordsTokens[10]) : 0,
                  viewportWidth: parseIntToken(coordsTokens[6]),
                  viewportHeight: parseIntToken(coordsTokens[7]),
              };
          }
      }
      return {
          id,
          layout,
          args: [parseStringToken(canvasTokens[6])],
          nodes: {},
          connections: [],
          inlets: [],
          outlets: [],
      };
  };
  const hydrateArray = (id, { tokens }) => {
      const arrayName = parseStringToken(tokens[2]);
      const arraySize = parseIntToken(tokens[3]);
      // Options flag :
      // first bit if for `saveContents` second for `drawAs`
      const optionsFlag = parseIntToken(tokens[5]);
      const saveContents = (optionsFlag % 2);
      const drawAs = ['polygon', 'points', 'bezier'][optionsFlag >>> 1];
      return {
          id,
          args: [arrayName, arraySize, saveContents],
          data: saveContents ? Array(arraySize).fill(0) : null,
          layout: {
              drawAs,
          },
      };
  };
  const hydrateNodePatch = (id, { tokens }) => {
      const canvasType = tokens[4];
      const args = [];
      if (canvasType !== 'pd' && canvasType !== 'graph') {
          throw new Error(`unknown canvasType : ${canvasType}`);
      }
      // add subpatch name
      if (canvasType === 'pd') {
          args.push(parseStringToken(tokens[5]));
      }
      return {
          id,
          type: canvasType,
          patchId: parseStringToken(tokens[1]),
          nodeClass: 'subpatch',
          args,
          layout: {
              x: parseIntToken(tokens[2]),
              y: parseIntToken(tokens[3]),
          },
      };
  };
  const hydrateNodeArray = (id, { tokens }) => ({
      id,
      args: [],
      type: 'array',
      nodeClass: 'array',
      arrayId: parseStringToken(tokens[1]),
  });
  const hydrateNodeBase = (id, tokens) => {
      const elementType = tokens[1];
      let type = ''; // the object name
      let args; // the construction args for the object
      // 2 categories here :
      //  - elems whose name is `elementType`
      //  - elems whose name is `token[4]`
      if (elementType === 'obj') {
          type = parseStringToken(tokens[4]);
          args = tokens.slice(5);
      }
      else {
          type = parseStringToken(elementType);
          args = tokens.slice(4);
      }
      // If text, we need to re-join all tokens
      if (elementType === 'text') {
          args = [tokens.slice(4).join(' ')];
      }
      return {
          id,
          type,
          args,
          layout: {
              x: parseFloatToken(tokens[2]),
              y: parseFloatToken(tokens[3]),
          },
      };
  };
  const hydrateConnection = ({ tokens, }) => ({
      source: {
          nodeId: parseStringToken(tokens[2]),
          portletId: parseIntToken(tokens[3]),
      },
      sink: {
          nodeId: parseStringToken(tokens[4]),
          portletId: parseIntToken(tokens[5]),
      },
  });
  const hydrateNodeGeneric = (nodeBase) => {
      const node = {
          ...nodeBase,
          nodeClass: 'generic',
      };
      node.args = node.args.map(parseArg);
      return node;
  };
  // This is put here just for readability of the main `parse` function
  const hydrateNodeControl = (nodeBase) => {
      const args = nodeBase.args;
      const node = {
          ...nodeBase,
          type: nodeBase.type,
          nodeClass: 'control',
      };
      if (node.type === 'floatatom' || node.type === 'symbolatom') {
          // <width> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
          node.layout = {
              ...node.layout,
              width: parseFloatToken(args[0]),
              labelPos: parseFloatToken(args[3]),
              label: parseStringToken(args[4], '-'),
          };
          node.args = [
              parseFloatToken(args[1]),
              parseFloatToken(args[2]),
              parseStringToken(args[5], '-'),
              parseStringToken(args[6], '-'),
          ];
          // In Pd `msg` is actually more handled like a standard object, even though it is a control.
      }
      else if (node.type === 'msg') {
          node.args = node.args.map(parseArg);
      }
      else if (node.type === 'bng') {
          // <size> <hold> <interrupt> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color>
          node.layout = {
              ...node.layout,
              size: parseFloatToken(args[0]),
              hold: parseFloatToken(args[1]),
              interrupt: parseFloatToken(args[2]),
              label: parseStringToken(args[6], 'empty'),
              labelX: parseFloatToken(args[7]),
              labelY: parseFloatToken(args[8]),
              labelFont: args[9],
              labelFontSize: parseFloatToken(args[10]),
              bgColor: args[11],
              fgColor: args[12],
              labelColor: args[13],
          };
          node.args = [
              parseBoolToken(args[3]),
              parseStringToken(args[4], 'empty'),
              parseStringToken(args[5], 'empty'),
          ];
      }
      else if (node.type === 'tgl') {
          // <size> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <init_value> <default_value>
          node.layout = {
              ...node.layout,
              size: parseFloatToken(args[0]),
              label: parseStringToken(args[4], 'empty'),
              labelX: parseFloatToken(args[5]),
              labelY: parseFloatToken(args[6]),
              labelFont: args[7],
              labelFontSize: parseFloatToken(args[8]),
              bgColor: args[9],
              fgColor: args[10],
              labelColor: args[11],
          };
          node.args = [
              parseFloatToken(args[13]),
              parseBoolToken(args[1]),
              parseFloatToken(args[12]),
              parseStringToken(args[2], 'empty'),
              parseStringToken(args[3], 'empty'),
          ];
      }
      else if (node.type === 'nbx') {
          // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
          // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
          node.layout = {
              ...node.layout,
              widthDigits: parseFloatToken(args[0]),
              height: parseFloatToken(args[1]),
              log: parseFloatToken(args[4]),
              label: parseStringToken(args[8], 'empty'),
              labelX: parseFloatToken(args[9]),
              labelY: parseFloatToken(args[10]),
              labelFont: args[11],
              labelFontSize: parseFloatToken(args[12]),
              bgColor: args[13],
              fgColor: args[14],
              labelColor: args[15],
              logHeight: args[17],
          };
          node.args = [
              parseFloatToken(args[2]),
              parseFloatToken(args[3]),
              parseBoolToken(args[5]),
              parseFloatToken(args[16]),
              parseStringToken(args[6], 'empty'),
              parseStringToken(args[7], 'empty'),
          ];
      }
      else if (node.type === 'vsl' || node.type === 'hsl') {
          // <width> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value> <steady_on_click>
          node.layout = {
              ...node.layout,
              width: parseFloatToken(args[0]),
              height: parseFloatToken(args[1]),
              log: parseFloatToken(args[4]),
              label: parseStringToken(args[8], 'empty'),
              labelX: parseFloatToken(args[9]),
              labelY: parseFloatToken(args[10]),
              labelFont: args[11],
              labelFontSize: parseFloatToken(args[12]),
              bgColor: args[13],
              fgColor: args[14],
              labelColor: args[15],
              steadyOnClick: args[17],
          };
          const minValue = parseFloatToken(args[2]);
          const maxValue = parseFloatToken(args[3]);
          const isLogScale = parseBoolToken(args[4]);
          const pixValue = parseFloatToken(args[16]);
          const pixSize = node.type === 'hsl' ? node.layout.width : node.layout.height;
          let initValue = 0;
          if (isLogScale) {
              const k = Math.log(maxValue / minValue) / (pixSize - 1);
              initValue = minValue * Math.exp(k * pixValue * 0.01);
          }
          else {
              // Reversed engineered formula for the initial value.
              initValue =
                  minValue +
                      ((maxValue - minValue) * pixValue) / ((pixSize - 1) * 100);
          }
          node.args = [
              minValue,
              maxValue,
              parseBoolToken(args[5]),
              initValue,
              parseStringToken(args[6], 'empty'),
              parseStringToken(args[7], 'empty'),
          ];
      }
      else if (node.type === 'vradio' || node.type === 'hradio') {
          // <size> <new_old> <init> <number> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <default_value>
          node.layout = {
              ...node.layout,
              size: parseFloatToken(args[0]),
              label: parseStringToken(args[6], 'empty'),
              labelX: parseFloatToken(args[7]),
              labelY: parseFloatToken(args[8]),
              labelFont: args[9],
              labelFontSize: parseFloatToken(args[10]),
              bgColor: args[11],
              fgColor: args[12],
              labelColor: args[13],
          };
          node.args = [
              parseFloatToken(args[3]),
              parseBoolToken(args[1]),
              parseFloatToken(args[14]),
              parseStringToken(args[4], 'empty'),
              parseStringToken(args[5], 'empty'),
              parseBoolToken(args[2]),
          ];
      }
      else if (node.type === 'vu') {
          // <width> <height> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <label_color> <scale> <?>
          node.layout = {
              ...node.layout,
              width: parseFloatToken(args[0]),
              height: parseFloatToken(args[1]),
              label: parseStringToken(args[3], 'empty'),
              labelX: parseFloatToken(args[4]),
              labelY: parseFloatToken(args[5]),
              labelFont: args[6],
              labelFontSize: parseFloatToken(args[7]),
              bgColor: args[8],
              labelColor: args[9],
              log: parseFloatToken(args[10]),
          };
          node.args = [parseStringToken(args[2], 'empty'), parseStringToken(args[11])];
      }
      else if (node.type === 'cnv') {
          // <size> <width> <height> <send> <receive> <label> <x_off> <y_off> <font> <font_size> <bg_color> <label_color> <?>
          node.layout = {
              ...node.layout,
              size: parseFloatToken(args[0]),
              width: parseFloatToken(args[1]),
              height: parseFloatToken(args[2]),
              label: parseStringToken(args[5], 'empty'),
              labelX: parseFloatToken(args[6]),
              labelY: parseFloatToken(args[7]),
              labelFont: args[8],
              labelFontSize: parseFloatToken(args[9]),
              bgColor: args[10],
              labelColor: args[11],
          };
          node.args = [parseStringToken(args[3], 'empty'), parseStringToken(args[4], 'empty'), parseStringToken(args[12])];
      }
      else {
          throw new Error(`Unexpected control node ${node.type}`);
      }
      return node;
  };
  function hydrateLineAfterComma(node, lineAfterComma) {
      // Handling stuff after the comma
      // I have no idea what's the specification for this, so this is really reverse
      // engineering on what appears in pd files.
      if (lineAfterComma) {
          const afterCommaTokens = lineAfterComma;
          while (afterCommaTokens.length) {
              const command = afterCommaTokens.shift();
              if (command === 'f') {
                  node.layout.width =
                      parseFloatToken(afterCommaTokens.shift());
              }
          }
      }
      return node;
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // Regular expression to split tokens in a message.
  const TOKENS_RE = /(\s*\\,\s*)|(\s*\\;\s*)|\s+|\r\n?|\n/;
  const AFTER_COMMA_RE = /,(?!\\)/;
  // Regular expression for finding valid lines of Pd in a file
  const LINES_RE = /(#((.|\r|\n)*?)[^\\\\])\r{0,1}\n{0,1};\r{0,1}(\n|$)/gi;
  // Helper function to reverse a string
  const _reverseString = (s) => s.split('').reverse().join('');
  var tokenize = (pdString) => {
      const tokenizedLines = [];
      // use our regular expression to match instances of valid Pd lines
      LINES_RE.lastIndex = 0; // reset lastIndex, in case the previous call threw an error
      let lineMatch = null;
      while ((lineMatch = LINES_RE.exec(pdString))) {
          // In order to support object width, pd vanilla adds something like ", f 10" at the end
          // of the line. So we need to look for non-escaped comma, and get that part after it.
          // Doing that is annoying in JS since regexps have no look-behind assertions.
          // The hack is to reverse the string, and use a regexp look-forward assertion.
          const lineParts = _reverseString(lineMatch[1])
              .split(AFTER_COMMA_RE)
              .reverse()
              .map(_reverseString);
          const lineIndex = pdString.slice(0, lineMatch.index).split('\n').length - 1;
          tokenizedLines.push({
              tokens: tokenizeLine(lineParts[0]),
              lineAfterComma: lineParts[1]
                  ? tokenizeLine(lineParts[1])
                  : undefined,
              lineIndex
          });
      }
      return tokenizedLines;
  };
  const tokenizeLine = (line) => {
      const matches = Array.from(line.matchAll(new RegExp(TOKENS_RE, 'g')));
      const tokens = [];
      matches.forEach((match, i) => {
          const tokenStart = i === 0 ? 0 : matches[i - 1].index + matches[i - 1][0].length;
          const tokenEnd = match.index;
          const token = line.slice(tokenStart, tokenEnd);
          if (token.length) {
              tokens.push(token);
          }
          if (match[1]) {
              tokens.push(',');
          }
          else if (match[2]) {
              tokens.push(';');
          }
      });
      const lastMatch = matches.slice(-1)[0];
      if (lastMatch) {
          tokens.push(line.slice(lastMatch.index + lastMatch[0].length));
      }
      return tokens;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const nextPatchId = () => `${++nextPatchId.counter}`;
  nextPatchId.counter = -1;
  const nextArrayId = () => `${++nextArrayId.counter}`;
  nextArrayId.counter = -1;
  const NODES = ['obj', 'floatatom', 'symbolatom', 'msg', 'text'];
  const _tokensMatch = (tokens, ...values) => values.every((value, i) => value === tokens[i]);
  /** Parses a Pd file, returns a simplified JSON version */
  var parse = (pdString) => {
      let pd = {
          patches: {},
          arrays: {},
      };
      let tokenizedLines = tokenize(pdString);
      let patchTokenizedLinesMap = {};
      [pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(pd, tokenizedLines, patchTokenizedLinesMap);
      Object.values(pd.patches).forEach((patch) => {
          let patchTokenizedLines = patchTokenizedLinesMap[patch.id];
          [pd, patchTokenizedLines] = parseArrays(pd, patchTokenizedLines);
          [patch, patchTokenizedLines] = parseNodesAndConnections(patch, patchTokenizedLines);
          patch = _computePatchPortlets(patch);
          if (patchTokenizedLines.length) {
              throw new ParseError('invalid chunks', patchTokenizedLines[0].lineIndex);
          }
          pd.patches[patch.id] = patch;
      });
      return pd;
  };
  const parsePatches = (pd, tokenizedLines, patchTokenizedLinesMap) => {
      pd = {
          patches: { ...pd.patches },
          arrays: { ...pd.arrays },
      };
      tokenizedLines = [...tokenizedLines];
      patchTokenizedLinesMap = { ...patchTokenizedLinesMap };
      const patchId = nextPatchId();
      const patchTokenizedLines = [];
      let patchCanvasTokens = null;
      let patchCoordsTokens = null;
      let iterCounter = -1;
      let continueIteration = true;
      while (tokenizedLines.length && continueIteration) {
          const { tokens, lineIndex } = tokenizedLines[0];
          iterCounter++;
          catchParsingErrors(lineIndex, () => {
              // First line of the patch / subpatch, initializes the patch
              if (_tokensMatch(tokens, '#N', 'canvas') && iterCounter === 0) {
                  patchCanvasTokens = tokenizedLines.shift();
                  // If not first line, starts a subpatch
              }
              else if (_tokensMatch(tokens, '#N', 'canvas')) {
                  ;
                  [pd, tokenizedLines, patchTokenizedLinesMap] = parsePatches(pd, tokenizedLines, patchTokenizedLinesMap);
                  // coords : visual range of framesets
              }
              else if (_tokensMatch(tokens, '#X', 'coords')) {
                  patchCoordsTokens = tokenizedLines.shift();
                  // Restore : ends a canvas definition
              }
              else if (_tokensMatch(tokens, '#X', 'restore')) {
                  // Creates a synthetic node that our parser will hydrate at a later stage
                  tokenizedLines[0].tokens = [
                      'PATCH',
                      patchId,
                      ...tokenizedLines[0].tokens.slice(2),
                  ];
                  continueIteration = false;
                  // A normal chunk to add to the current patch
              }
              else {
                  patchTokenizedLines.push(tokenizedLines.shift());
              }
          });
      }
      if (patchCanvasTokens === null) {
          throw new Error(`Parsing failed #canvas missing`);
      }
      pd.patches[patchId] = hydratePatch(patchId, patchCanvasTokens, patchCoordsTokens);
      patchTokenizedLinesMap[patchId] = patchTokenizedLines;
      return [pd, tokenizedLines, patchTokenizedLinesMap];
  };
  /**
   * Use the layout of [inlet] / [outlet] objects to compute the order
   * of portlets of a subpatch.
   */
  const _computePatchPortlets = (patch) => {
      const _comparePortletsId = (node1, node2) => parseFloat(node1.id) - parseFloat(node2.id);
      const _comparePortletsLayout = (node1, node2) => node1.layout.x - node2.layout.x;
      const inletNodes = Object.values(patch.nodes).filter((node) => ['inlet', 'inlet~'].includes(node.type));
      const inletsSortFunction = inletNodes.every((node) => !!node.layout)
          ? _comparePortletsLayout
          : _comparePortletsId;
      inletNodes.sort(inletsSortFunction);
      const outletNodes = Object.values(patch.nodes).filter((node) => ['outlet', 'outlet~'].includes(node.type));
      const outletsSortFunction = outletNodes.every((node) => !!node.layout)
          ? _comparePortletsLayout
          : _comparePortletsId;
      outletNodes.sort(outletsSortFunction);
      return {
          ...patch,
          inlets: inletNodes.map((node) => node.id),
          outlets: outletNodes.map((node) => node.id),
      };
  };
  const parseArrays = (pd, tokenizedLines) => {
      pd = {
          patches: { ...pd.patches },
          arrays: { ...pd.arrays },
      };
      tokenizedLines = [...tokenizedLines];
      const remainingTokenizedLines = [];
      // keep the last array for handling correctly
      // the array related instructions which might follow.
      let currentArray = null;
      while (tokenizedLines.length) {
          const { tokens, lineIndex } = tokenizedLines[0];
          catchParsingErrors(lineIndex, () => {
              // start of an array definition
              if (_tokensMatch(tokens, '#X', 'array')) {
                  currentArray = hydrateArray(nextArrayId(), tokenizedLines.shift());
                  pd.arrays[currentArray.id] = currentArray;
                  // Creates a synthetic node that our parser will hydrate at a later stage
                  remainingTokenizedLines.push({
                      tokens: ['ARRAY', currentArray.id],
                      lineAfterComma: [],
                      lineIndex,
                  });
                  // array data to add to the current array
              }
              else if (_tokensMatch(tokens, '#A')) {
                  if (!currentArray) {
                      throw new Error('got array data outside of a array.');
                  }
                  const currentData = currentArray.data;
                  if (currentData === null) {
                      throw new Error('got array data for an array that doesn\'t save contents.');
                  }
                  // reads in part of an array of data, starting at the index specified in this line
                  // name of the array comes from the the '#X array' and '#X restore' matches above
                  const indexOffset = parseFloatToken(tokens[1]);
                  tokens.slice(2).forEach((rawVal, i) => {
                      const val = parseFloatToken(rawVal);
                      if (Number.isFinite(val)) {
                          currentData[indexOffset + i] = val;
                      }
                  });
                  tokenizedLines.shift();
                  // A normal chunk to add to the current patch
              }
              else {
                  remainingTokenizedLines.push(tokenizedLines.shift());
              }
          });
      }
      return [pd, remainingTokenizedLines];
  };
  const parseNodesAndConnections = (patch, tokenizedLines) => {
      patch = {
          ...patch,
          nodes: { ...patch.nodes },
          connections: [...patch.connections],
      };
      tokenizedLines = [...tokenizedLines];
      const remainingTokenizedLines = [];
      // In Pd files it seems like node ids are assigned in order in which nodes are declared.
      // Then connection declarations use these same ids to identify nodes.
      let idCounter = -1;
      const nextId = () => `${++idCounter}`;
      while (tokenizedLines.length) {
          const { tokens, lineIndex } = tokenizedLines[0];
          catchParsingErrors(lineIndex, () => {
              let node = null;
              if (_tokensMatch(tokens, 'PATCH')) {
                  node = hydrateNodePatch(nextId(), tokenizedLines.shift());
              }
              else if (_tokensMatch(tokens, 'ARRAY')) {
                  node = hydrateNodeArray(nextId(), tokenizedLines.shift());
              }
              else if (NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))) {
                  const tokenizedLine = tokenizedLines.shift();
                  const nodeBase = hydrateNodeBase(nextId(), tokenizedLine.tokens);
                  if (Object.keys(CONTROL_TYPE$1).includes(nodeBase.type)) {
                      node = hydrateNodeControl(nodeBase);
                      node = hydrateLineAfterComma(node, tokenizedLine.lineAfterComma);
                  }
                  else {
                      node = hydrateNodeGeneric(nodeBase);
                      node = hydrateLineAfterComma(node, tokenizedLine.lineAfterComma);
                  }
              }
              if (node) {
                  patch.nodes[node.id] = node;
                  return;
              }
              if (_tokensMatch(tokens, '#X', 'connect')) {
                  patch.connections.push(hydrateConnection(tokenizedLines.shift()));
              }
              else {
                  remainingTokenizedLines.push(tokenizedLines.shift());
              }
          });
      }
      return [patch, remainingTokenizedLines];
  };
  const catchParsingErrors = (lineIndex, func) => {
      try {
          func();
      }
      catch (err) {
          if (err instanceof ValueError) {
              throw new ParseError(err, lineIndex);
          }
          else {
              throw err;
          }
      }
  };
  class ParseError extends Error {
      constructor(error, lineIndex) {
          super(typeof error === 'string' ? error : error.message);
          this.lineIndex = lineIndex;
      }
  }

  const PORTLET_ID = '0';

  const loadPdJson = async (url) => {
      const response = await fetch(url);
      const pdFile = await response.text();
      return parse(pdFile)
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const CONTROL_TYPE = {
      floatatom: 'floatatom',
      symbolatom: 'symbolatom',
      bng: 'bng',
      tgl: 'tgl',
      nbx: 'nbx',
      vsl: 'vsl',
      hsl: 'hsl',
      vradio: 'vradio',
      hradio: 'hradio',
      vu: 'vu',
      cnv: 'cnv',
      msg: 'msg',
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const getNode$1 = (graph, nodeId) => {
      const node = graph[nodeId];
      if (node) {
          return node;
      }
      throw new Error(`Node "${nodeId}" not found in graph`);
  };
  const getInlet$1 = (node, inletId) => {
      const inlet = node.inlets[inletId];
      if (inlet) {
          return inlet;
      }
      throw new Error(`Inlet "${inletId}" not found in node ${node.id}`);
  };
  const getOutlet$1 = (node, outletId) => {
      const outlet = node.outlets[outletId];
      if (outlet) {
          return outlet;
      }
      throw new Error(`Outlet "${outletId}" not found in node ${node.id}`);
  };
  /** Returns the list of sinks for the outlet or an empty list. */
  const getSinks$1 = (node, outletId) => node.sinks[outletId] || [];
  /** Returns the list of sources for the inlet or an empty list. */
  const getSources$1 = (node, inletId) => node.sources[inletId] || [];

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const endpointsEqual = (a1, a2) => a1.portletId === a2.portletId && a1.nodeId === a2.nodeId;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const addNode = (graph, node) => {
      if (!graph[node.id]) {
          graph[node.id] = node;
      }
      return graph[node.id];
  };
  const connect = (graph, source, sink) => {
      const sinkNode = getNode$1(graph, sink.nodeId);
      const sourceNode = getNode$1(graph, source.nodeId);
      const otherSources = getSources$1(sinkNode, sink.portletId);
      const otherSinks = getSinks$1(sourceNode, source.portletId);
      const outlet = getOutlet$1(sourceNode, source.portletId);
      const inlet = getInlet$1(sinkNode, sink.portletId);
      // Avoid duplicate connections : we check only on sinks,
      // because we assume that connections are always consistent on both sides.
      if (otherSinks.some((otherSink) => endpointsEqual(sink, otherSink))) {
          return;
      }
      // Check that connection is valid
      if (!outlet) {
          throw new Error(`Undefined outlet ${source.nodeId}:${source.portletId}`);
      }
      if (!inlet) {
          throw new Error(`Undefined inlet ${sink.nodeId}:${sink.portletId}`);
      }
      if (outlet.type !== inlet.type) {
          throw new Error(`Incompatible portlets types ${source.nodeId}:${source.portletId} (${outlet.type}) -> ${sink.nodeId}|${sink.portletId} (${inlet.type})`);
      }
      if (inlet.type === 'signal' && otherSources.length) {
          throw new Error(`Signal inlets can have only one connection`);
      }
      _ensureConnectionEndpointArray(sinkNode.sources, sink.portletId).push(source);
      _ensureConnectionEndpointArray(sourceNode.sinks, source.portletId).push(sink);
  };
  /** If it exists, remove single connection from `sourceNodeId` to `sinkNodeId`. */
  const disconnect = (graph, source, sink) => {
      const sinkNode = getNode$1(graph, sink.nodeId);
      const sourceNode = getNode$1(graph, source.nodeId);
      const sinks = getSinks$1(sourceNode, source.portletId);
      sourceNode.sinks[source.portletId] = sinks.filter((otherSink) => !endpointsEqual(sink, otherSink));
      const sources = getSources$1(sinkNode, sink.portletId);
      sinkNode.sources[sink.portletId] = sources.filter((otherSource) => !endpointsEqual(source, otherSource));
  };
  /** Remove all existing connections from `sourceNodeId` to `sinkNodeId`. */
  const disconnectNodes = (graph, sourceNodeId, sinkNodeId) => {
      const sourceNode = getNode$1(graph, sourceNodeId);
      const sinkNode = getNode$1(graph, sinkNodeId);
      Object.entries(sinkNode.sources).forEach(([inletId, sources]) => (sinkNode.sources[inletId] = sources.filter((source) => source.nodeId !== sourceNodeId)));
      Object.entries(sourceNode.sinks).forEach(([outletId, sinks]) => (sourceNode.sinks[outletId] = sinks.filter((sink) => sink.nodeId !== sinkNodeId)));
  };
  /** Delete node from the graph, also cleaning all the connections from and to other nodes. */
  const deleteNode = (graph, nodeId) => {
      const node = graph[nodeId];
      if (!node) {
          return;
      }
      // `slice(0)` because array might change during iteration
      Object.values(node.sources).forEach((sources) => sources
          .slice(0)
          .forEach((source) => disconnectNodes(graph, source.nodeId, nodeId)));
      Object.values(node.sinks).forEach((sinks) => sinks
          .slice(0)
          .forEach((sink) => disconnectNodes(graph, nodeId, sink.nodeId)));
      delete graph[nodeId];
  };
  const _ensureConnectionEndpointArray = (portletMap, portletId) => (portletMap[portletId] = portletMap[portletId] || []);

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * @returns The list of all subpatch nodes that represent {@link patchId} in another patch.
   */
  const getReferencesToSubpatch = (pd, patchId) => {
      return Object.values(pd.patches).reduce((allReferences, patch) => {
          const nodes = Object.values(patch.nodes)
              .filter((node) => node.nodeClass === 'subpatch' && node.patchId === patchId)
              .map((node) => [patch.id, node.id]);
          if (nodes.length === 0) {
              return allReferences;
          }
          return [...allReferences, ...nodes];
      }, []);
  };

  const subpatchNodeBuilder = {
      translateArgs: (pdNode, _, pd) => {
          if (pdNode.nodeClass !== 'subpatch') {
              throw new Error(`Invalid node for subpatch ${pdNode.id}`);
          }
          const subpatch = pd.patches[pdNode.patchId];
          if (!subpatch) {
              throw new Error(`Unknown patch ${pdNode.patchId}`);
          }
          return {
              inletTypes: subpatch.inlets.map((inletNodeId) => {
                  const portletNode = subpatch['nodes'][inletNodeId];
                  if (!portletNode) {
                      throw new Error(`Unknown [inlet]/[inlet~] node ${inletNodeId}`);
                  }
                  return _portletNodeToPortletType(portletNode);
              }),
              outletTypes: subpatch.outlets.map((outletNodeId) => {
                  const portletNode = subpatch['nodes'][outletNodeId];
                  if (!portletNode) {
                      throw new Error(`Unknown [outlet]/[outlet~] node ${outletNodeId}`);
                  }
                  return _portletNodeToPortletType(portletNode);
              }),
          };
      },
      build: ({ inletTypes, outletTypes }) => ({
          inlets: inletTypes.reduce((inlets, type, id) => ({
              ...inlets,
              ...(type === 'signal'
                  ? {
                      [`${id}`]: { id: `${id}`, type: 'signal' },
                      [`${id}_message`]: { id: `${id}_message`, type: 'message' },
                  }
                  : {
                      [`${id}_message`]: { id: `${id}_message`, type: 'message' },
                  }),
          }), {}),
          outlets: outletTypes.reduce((outlets, type, id) => ({
              ...outlets,
              [`${id}`]: { id: `${id}`, type },
          }), {}),
      }),
      rerouteMessageConnection: (inletId) => {
          if (!inletId.endsWith('_message')) {
              return `${inletId}_message`;
          }
          return undefined;
      }
  };
  const inletNodeBuilder = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {},
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  const outletNodeBuilder = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {},
      }),
  };
  const inletTildeNodeBuilder = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {},
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  const outletTildeNodeBuilder = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
          },
          outlets: {},
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      }
  };
  const _portletNodeToPortletType = (node) => {
      if (['inlet~', 'outlet~'].includes(node.type)) {
          return 'signal';
      }
      else if (['inlet', 'outlet'].includes(node.type)) {
          return 'message';
      }
      else {
          throw new Error(`Node type ${node.type} is not a portlet node.`);
      }
  };
  const NODE_BUILDERS$1 = {
      pd: subpatchNodeBuilder,
      inlet: inletNodeBuilder,
      outlet: outletNodeBuilder,
      'inlet~': inletTildeNodeBuilder,
      'outlet~': outletTildeNodeBuilder,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const MIXER_NODE_TYPE = 'mixer~';
  var IdNamespaces$1;
  (function (IdNamespaces) {
      IdNamespaces["PD"] = "n";
      IdNamespaces["MIXER"] = "m";
  })(IdNamespaces$1 || (IdNamespaces$1 = {}));
  var toDspGraph = (pd, nodeBuilders) => {
      const compilation = { pd, nodeBuilders, graph: {} };
      buildGraph(compilation);
      flattenGraph(compilation);
      return compilation.graph;
  };
  // --------------------------------------------- BUILDING GRAPH
  /** Given the base structure of a `pd` object, convert the explicit connections into our graph format. */
  const buildGraph = (compilation) => {
      const deletedNodeIds = new Set();
      Object.values(compilation.pd.patches).forEach((patch) => {
          Object.values(patch.nodes).forEach((pdNode) => {
              const nodeId = buildGraphNodeId(patch.id, pdNode.id);
              const node = _buildGraphNode(compilation, patch, pdNode, nodeId);
              if (node === null) {
                  deletedNodeIds.add(nodeId);
              }
          });
          // Convert pd patch connections to couples [source, sink]
          // representing connections in the graph.
          let allConnections = [];
          patch.connections.forEach((patchConnection) => {
              const sourceNodeId = buildGraphNodeId(patch.id, patchConnection.source.nodeId);
              const sinkNodeId = buildGraphNodeId(patch.id, patchConnection.sink.nodeId);
              if (deletedNodeIds.has(sourceNodeId) ||
                  deletedNodeIds.has(sinkNodeId)) {
                  return;
              }
              const source = {
                  nodeId: sourceNodeId,
                  portletId: patchConnection.source.portletId.toString(10),
              };
              allConnections.push([
                  source,
                  _rerouteMessageConnection(compilation, source, {
                      nodeId: sinkNodeId,
                      portletId: patchConnection.sink.portletId.toString(10),
                  }),
              ]);
          });
          // In Pd, several signal sources are summed when connected to the same inlet.
          // `_buildGraphConnections` is making that behavior explicit, therefore we can't create
          // all connections one by one, and need to batch all connections to the same sink.
          while (allConnections.length) {
              const [, sink] = allConnections[0];
              let connectionsToSink = [];
              allConnections = allConnections.filter((connection) => {
                  const [, otherSink] = connection;
                  if (endpointsEqual(sink, otherSink)) {
                      connectionsToSink.push(connection);
                      return false;
                  }
                  return true;
              });
              _buildGraphConnections(compilation, patch, connectionsToSink.map(([source]) => source), sink);
          }
      });
  };
  const _buildGraphNode = (compilation, patch, pdNode, nodeId) => {
      const { nodeBuilder, nodeType } = _getNodeBuilder(compilation, pdNode.type);
      if (nodeBuilder.isNoop === true) {
          return null;
      }
      const nodeArgs = nodeBuilder.translateArgs(pdNode, patch, compilation.pd);
      const partialNode = nodeBuilder.build(nodeArgs);
      return addNode(compilation.graph, {
          id: nodeId,
          type: nodeType,
          args: nodeArgs,
          sources: {},
          sinks: {},
          ...partialNode,
      });
  };
  const _buildGraphConnections = (compilation, patch, sources, sink) => {
      const { graph } = compilation;
      if (sources.length === 1) {
          connect(graph, sources[0], sink);
          return;
      }
      // Create Mixer node according to sink type
      let mixerNode = null;
      const sinkNode = getNode$1(compilation.graph, sink.nodeId);
      const sinkType = getInlet$1(sinkNode, sink.portletId).type;
      // Pd implicitely sums multiple signals when they are connected to the same inlet.
      // We want this behavior to be explicit, so we put a mixer node in between instead.
      if (sinkType === 'message') ;
      else if (sinkType === 'signal') {
          mixerNode = _buildGraphNode(compilation, patch, {
              id: 'dummy',
              type: MIXER_NODE_TYPE,
              args: [sources.length],
              nodeClass: 'generic',
          }, buildMixerNodeId(sink.nodeId, sink.portletId));
      }
      else {
          throw new Error(`unexpected portlet type "${sinkType}"`);
      }
      // Connect all sources to mixer, and mixer output to sink.
      // We assume that each source is connected to a different inlet of the mixer node.
      if (mixerNode) {
          sources.forEach((source, inletIndex) => {
              const mixerInlet = getInlet$1(mixerNode, inletIndex.toString());
              connect(graph, source, {
                  nodeId: mixerNode.id,
                  portletId: mixerInlet.id,
              });
          });
          const mixerOutlet = '0';
          connect(graph, {
              nodeId: mixerNode.id,
              portletId: mixerOutlet,
          }, sink);
      }
      else {
          sources.forEach((source) => {
              connect(graph, source, sink);
          });
      }
  };
  const _rerouteMessageConnection = (compilation, source, sink) => {
      // If the source isnt a message, we don't need to do anything
      const sourceNode = getNode$1(compilation.graph, source.nodeId);
      const outlet = getOutlet$1(sourceNode, source.portletId);
      if (outlet.type !== 'message') {
          return sink;
      }
      const sinkNode = getNode$1(compilation.graph, sink.nodeId);
      const { nodeBuilder: pdSinkNodeBuilder } = _getNodeBuilder(compilation, sinkNode.type);
      if (pdSinkNodeBuilder.rerouteMessageConnection) {
          const newInletId = pdSinkNodeBuilder.rerouteMessageConnection(sink.portletId);
          if (newInletId !== undefined) {
              return { nodeId: sink.nodeId, portletId: newInletId };
          }
      }
      return sink;
  };
  const _getNodeBuilder = (compilation, nodeType) => {
      const coreNodeBuilder = NODE_BUILDERS$1[nodeType];
      if (coreNodeBuilder) {
          return { nodeBuilder: coreNodeBuilder, nodeType };
      }
      const nodeBuilder = compilation.nodeBuilders[nodeType];
      if (!nodeBuilder) {
          throw new Error(`unknown node type ${nodeType}`);
      }
      if (nodeBuilder.aliasTo) {
          return _getNodeBuilder(compilation, nodeBuilder.aliasTo);
      }
      else {
          return { nodeBuilder: nodeBuilder, nodeType };
      }
  };
  // --------------------------------------------- FLATTENING THE GRAPH
  /*
   * Given a pd object, inline all the subpatches into the given `graph`, so that objects indirectly wired through
   * the [inlet] and [outlet] objects of a subpatch are instead directly wired into the same graph. Also, deletes
   * [pd subpatch], [inlet] and [outlet] nodes (tilde or not).
   */
  const flattenGraph = (compilation) => {
      const { pd } = compilation;
      const patchesToInline = new Set(Object.keys(pd.patches));
      // Iterate until all patches have been inlined
      while (patchesToInline.size) {
          patchesToInline.forEach((patchId) => {
              const patch = pd.patches[patchId];
              // If `patch` contains subpatches which haven't yet been inlined,
              // we need to inline these first.
              if (Object.values(patch.nodes).some((node) => node.nodeClass === 'subpatch' &&
                  patchesToInline.has(node.patchId))) {
                  return;
              }
              _inlineSubpatch(compilation, patch);
              patchesToInline.delete(patch.id);
          });
      }
  };
  // This inlines a subpatch in all the patches where it is defined.
  // !!! This works only on one level. If the subpatch contains other subpatches they won't be inlined
  const _inlineSubpatch = (compilation, subpatch) => {
      const { pd, graph } = compilation;
      const subpatchNodeIds = getReferencesToSubpatch(pd, subpatch.id)
          .map(([patchId, nodeLocalId]) => buildGraphNodeId(patchId, nodeLocalId))
          // Remove subpatches that have not been inserted in the graph because they were noop objects.
          .filter((subpatchNodeId) => !!compilation.graph[subpatchNodeId]);
      _inlineSubpatchInlets(compilation, subpatch, subpatchNodeIds);
      _inlineSubpatchOutlets(compilation, subpatch, subpatchNodeIds);
      subpatchNodeIds.forEach((nodeId) => deleteNode(graph, nodeId));
  };
  // Outer patch :                    Inside [ pd someSubpatch ] :
  //
  // [ osc~ ]  [ bla~ ]                      [ inlet (**) ]
  //       \    /                               /\
  //         \/                                /  \
  //         (*)                              /    \
  //       [ pd someSubpatch ]          [ blo~ ]  [ hihi~ ]
  //
  const _inlineSubpatchInlets = (compilation, subpatch, subpatchNodeIds) => {
      const { graph } = compilation;
      // (**) Get graph node ids of the [inlet] objects
      const inletNodeIds = subpatch.inlets.map((inletPdNodeId) => buildGraphNodeId(subpatch.id, inletPdNodeId));
      subpatchNodeIds.forEach((subpatchNodeId) => {
          const subpatchNode = getNode$1(graph, subpatchNodeId);
          inletNodeIds.forEach((inletNodeId, i) => {
              // (*) Inlet id of the subpatch node
              // We add an additional id for message inlets.
              const subpatchNodeInletIds = [
                  i.toString(),
              ];
              if (`${i}_message` in subpatchNode.inlets) {
                  subpatchNodeInletIds.push(`${i}_message`);
              }
              subpatchNodeInletIds.forEach((subpatchNodeInletId) => {
                  _deproxyConnections(compilation, {
                      nodeId: subpatchNodeId,
                      portletId: subpatchNodeInletId,
                  }, {
                      nodeId: inletNodeId,
                      portletId: '0',
                  });
              });
          });
      });
      inletNodeIds.forEach((inletNodeId) => {
          deleteNode(graph, inletNodeId);
      });
      // The subpatch node is not deleted at this stage, because it might be used by other processing steps
      // after this one.
  };
  // Inside [ pd someSubpatch ] :             Outer patch :
  //
  // [ osc~ ]   [ bla~ ]                  [ pd someSubpatch ]
  //       \    /                               (*)
  //        \  /                                 /\
  //         \/                                /    \
  //       [ outlet (**) ]               [ blo~ ]  [ hihi~ ]
  //
  const _inlineSubpatchOutlets = (compilation, subpatch, subpatchNodeIds) => {
      const { graph } = compilation;
      // (**) Get graph node ids of the [outlet] objects
      const outletNodeIds = subpatch.outlets.map((outletPdNodeId) => buildGraphNodeId(subpatch.id, outletPdNodeId));
      const outletNodeInletIds = ['0', '0_message'];
      subpatchNodeIds.forEach((subpatchNodeId) => {
          outletNodeIds.forEach((outletNodeId, i) => {
              // (*) Outlet id of the subpatch node
              // We add an additional id for message inlets.
              const subpatchNodeOutletId = `${i}`;
              outletNodeInletIds.forEach((outletNodeInletId) => {
                  _deproxyConnections(compilation, {
                      nodeId: outletNodeId,
                      portletId: outletNodeInletId,
                  }, {
                      nodeId: subpatchNodeId,
                      portletId: subpatchNodeOutletId,
                  });
              });
          });
      });
      outletNodeIds.forEach((outletNodeId) => {
          deleteNode(graph, outletNodeId);
      });
      // The subpatch node is not deleted at this stage, because it might be used by other processing steps
      // after this one.
  };
  // --------------------------------------------- HELPERS
  // Helper allowing to get rid of a couple of proxy nodes.
  // Connections are moved, but the proxy nodes are not deleted.
  // e.g. :
  //
  // ```text
  //   [float 440]  [330(            [r BLA]
  //           \     /                / \
  //             \ /                /     \
  //            [s BLA]         [osc~]   [phasor~]
  // ```
  //
  // With call `deproxyConnections(graph, {nodeId: sId, portletId: '0'}, {nodeId: rId, portletId: '0'})`,
  // graph will become this :
  //
  // ```text
  // [float 440]  [330(
  //      |\      /|
  //      |  \  /  |
  //      |  / \   |
  //      |/     \ |
  //    [osc ~]  [phasor~]
  // ```
  //
  //
  const _deproxyConnections = (compilation, proxyIn, proxyOut) => {
      const { graph } = compilation;
      const proxyInNode = getNode$1(graph, proxyIn.nodeId);
      const proxyOutNode = getNode$1(graph, proxyOut.nodeId);
      const sources = getSources$1(proxyInNode, proxyIn.portletId);
      const sinks = getSinks$1(proxyOutNode, proxyOut.portletId);
      sinks.forEach((sink) => sources.forEach((source) => {
          // Disconnect first : this is important for
          // signals which can't take in multiple connections.
          disconnect(graph, source, proxyIn);
          disconnect(graph, proxyOut, sink);
          sink = _rerouteMessageConnection(compilation, source, sink);
          connect(graph, source, sink);
      }));
  };
  const buildGraphNodeId = (patchId, nodeLocalId) => {
      return `${IdNamespaces$1.PD}_${patchId}_${nodeLocalId}`;
  };
  const buildMixerNodeId = (sinkId, inletId) => {
      return `${IdNamespaces$1.MIXER}_${sinkId}_${inletId}`;
  };

  const makeTranslationTransform = (fromPoint, toPoint) => {
      const xOffset = toPoint.x - fromPoint.x;
      const yOffset = toPoint.y - fromPoint.y;
      return (fromPoint) => {
          return {
              x: fromPoint.x + xOffset,
              y: fromPoint.y + yOffset,
          }
      }
  };

  const addPoints = (p1, p2) => ({
      x: p1.x + p2.x,
      y: p1.y + p2.y,
  });

  const computeRectanglesIntersection = (r1, r2) => {
      const topLeft = {
          x: Math.max(r1.topLeft.x, r2.topLeft.x),
          y: Math.max(r1.topLeft.y, r2.topLeft.y),
      };
      const bottomRight = {
          x: Math.min(r1.bottomRight.x, r2.bottomRight.x),
          y: Math.min(r1.bottomRight.y, r2.bottomRight.y),
      };
      if (bottomRight.x <= topLeft.x || bottomRight.y <= topLeft.y) {
          return null
      } else {
          return { topLeft, bottomRight }
      }
  };

  const isPointInsideRectangle = (p, r) =>
      r.topLeft.x <= p.x && p.x <= r.bottomRight.x 
      && r.topLeft.y <= p.y && p.y <= r.bottomRight.y; 

  const computePointsBoundingBox = (points) => points.reduce(
      ({ topLeft, bottomRight }, point) => {
          return {
              topLeft: {
                  x: Math.min(point.x, topLeft.x),
                  y: Math.min(point.y, topLeft.y),
              },
              bottomRight: {
                  x: Math.max(point.x, bottomRight.x),
                  y: Math.max(point.y, bottomRight.y),
              },
          }
      },
      {
          topLeft: { x: Infinity, y: Infinity },
          bottomRight: { x: -Infinity, y: -Infinity },
      }
  );

  const computeRectangleDimensions = (r) => ({
      x: r.bottomRight.x - r.topLeft.x,
      y: r.bottomRight.y - r.topLeft.y,
  });

  const createModels = (STATE) => 
      // We make sure all controls are inside a container at top level for easier layout
      _createModelsRecursive(STATE, STATE.pdJson.patches['0'])
      .map((control) =>
              control.type === 'control'
                  ? _buildContainerModel(control.patch, control.node, [control])
                  : control
          );

  const _createModelsRecursive = (STATE, patch, viewport = null) => {
      const { pdJson } = STATE;
      if (viewport === null) {
          viewport = {
              topLeft: { x: -Infinity, y: -Infinity },
              bottomRight: { x: Infinity, y: Infinity },
          };
      }

      const controls = [];
      Object.values(patch.nodes).forEach((node) => {
          if (node.type === 'pd') {
              const subpatch = pdJson.patches[node.patchId];
              if (!subpatch.layout.graphOnParent) {
                  return
              }

              // 1. we convert all coordinates to the subpatch coords system
              const toSubpatchCoords = makeTranslationTransform(
                  { x: node.layout.x, y: node.layout.y },
                  { x: subpatch.layout.viewportX, y: subpatch.layout.viewportY }
              );
              const parentViewport = {
                  topLeft: toSubpatchCoords(viewport.topLeft),
                  bottomRight: toSubpatchCoords(viewport.bottomRight),
              };

              const topLeft = {
                  x: subpatch.layout.viewportX,
                  y: subpatch.layout.viewportY,
              };
              const subpatchViewport = {
                  topLeft,
                  bottomRight: addPoints(topLeft, {
                      x: subpatch.layout.viewportWidth,
                      y: subpatch.layout.viewportHeight,
                  }),
              };

              // 2. we compute the visible intersection in the subpatch coords system
              // and call the function for the subpatch
              const visibleSubpatchViewport = computeRectanglesIntersection(
                  parentViewport,
                  subpatchViewport
              );

              if (visibleSubpatchViewport === null) {
                  return
              }

              const children = _createModelsRecursive(
                  STATE,
                  subpatch,
                  visibleSubpatchViewport
              );

              controls.push(_buildContainerModel(patch, node, children));

              // 3. When we get ab actual control node, we see if it is inside the
              // visible viewport (which was previously transformed to local coords).
          } else if (node.type in CONTROL_TYPE) {
              if (
                  !isPointInsideRectangle(
                      {
                          x: node.layout.x,
                          y: node.layout.y,
                      },
                      viewport
                  )
              ) {
                  return
              }
              controls.push(_buildControlModel(patch, node));
          }
      });
      return controls
  };

  const _buildContainerModel = (patch, node, children) => ({
      type: 'container',
      patch,
      node,
      children,
  });

  const _buildControlModel = (patch, node) => ({
      type: 'control',
      patch,
      node,
  });

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const Var$1 = (name) => `${name}`;
  const Func$1 = (args) => `(${args.join(', ')})`;
  const macros$1 = {
      Var: Var$1,
      Func: Func$1,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const Var = (name, typeString) => `${name}: ${typeString}`;
  const Func = (args, returnType) => `(${args.join(', ')}): ${returnType}`;
  const macros = {
      Var,
      Func,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const getNode = (graph, nodeId) => {
      const node = graph[nodeId];
      if (node) {
          return node;
      }
      throw new Error(`Node "${nodeId}" not found in graph`);
  };
  const getInlet = (node, inletId) => {
      const inlet = node.inlets[inletId];
      if (inlet) {
          return inlet;
      }
      throw new Error(`Inlet "${inletId}" not found in node ${node.id}`);
  };
  const getOutlet = (node, outletId) => {
      const outlet = node.outlets[outletId];
      if (outlet) {
          return outlet;
      }
      throw new Error(`Outlet "${outletId}" not found in node ${node.id}`);
  };
  /** Returns the list of sinks for the outlet or an empty list. */
  const getSinks = (node, outletId) => node.sinks[outletId] || [];
  /** Returns the list of sources for the inlet or an empty list. */
  const getSources = (node, inletId) => node.sources[inletId] || [];

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * Breadth first traversal for signal in the graph.
   * Traversal path is calculated by pulling incoming connections from
   * {@link nodesPullingSignal}.
   */
  const signalNodes = (graph, nodesPullingSignal) => {
      const traversal = [];
      nodesPullingSignal.forEach((node) => _signalNodesBreadthFirstRecursive(traversal, [], graph, node));
      return traversal;
  };
  const _signalNodesBreadthFirstRecursive = (traversal, currentPath, graph, node) => {
      const nextPath = [...currentPath, node.id];
      Object.entries(node.sources)
          .filter(([inletId]) => getInlet(node, inletId).type === 'signal')
          .forEach(([_, sources]) => {
          sources.forEach((source) => {
              const sourceNode = getNode(graph, source.nodeId);
              if (currentPath.indexOf(sourceNode.id) !== -1) {
                  return;
              }
              _signalNodesBreadthFirstRecursive(traversal, nextPath, graph, sourceNode);
          });
      });
      if (traversal.indexOf(node.id) === -1) {
          traversal.push(node.id);
      }
  };
  /**
   * Breadth first traversal for signal in the graph.
   * Traversal path is calculated by pulling incoming connections from
   * {@link nodesPushingMessages}.
   */
  const messageNodes = (graph, nodesPushingMessages) => {
      const traversal = [];
      nodesPushingMessages.forEach((node) => {
          _messageNodesDepthFirstRecursive(traversal, graph, node);
      });
      return traversal;
  };
  const _messageNodesDepthFirstRecursive = (traversal, graph, node) => {
      if (traversal.indexOf(node.id) !== -1) {
          return;
      }
      traversal.push(node.id);
      Object.entries(node.sinks)
          .filter(([outletId]) => getOutlet(node, outletId).type === 'message')
          .forEach(([_, sinks]) => {
          sinks.forEach((sink) => {
              _messageNodesDepthFirstRecursive(traversal, graph, getNode(graph, sink.nodeId));
          });
      });
  };
  /**
   * Remove dead sinks and sources in graph.
   */
  const trimGraph = (graph, graphTraversal) => {
      Object.entries(graph).forEach(([nodeId, node]) => {
          if (!graphTraversal.includes(nodeId)) {
              delete graph[nodeId];
          }
          else {
              graph[nodeId] = {
                  ...node,
                  sources: removeDeadSources(node.sources, graphTraversal),
                  sinks: removeDeadSinks(node.sinks, graphTraversal),
              };
          }
      });
  };
  /**
   * When `node` has a sink node that is not connected to an end sink, that sink node won't be included
   * in the traversal, but will still appear in `node.sinks`.
   * Therefore, we need to make sure to filter `node.sinks` to exclude sink nodes that don't
   * appear in the traversal.
   */
  const removeDeadSinks = (sinks, graphTraversal) => {
      const filteredSinks = {};
      Object.entries(sinks).forEach(([outletId, outletSinks]) => {
          const filteredOutletSinks = outletSinks.filter(({ nodeId: sinkNodeId }) => graphTraversal.includes(sinkNodeId));
          if (filteredOutletSinks.length) {
              filteredSinks[outletId] = filteredOutletSinks;
          }
      });
      return filteredSinks;
  };
  /**
   * Filters a node's sources to exclude source nodes that don't
   * appear in the traversal.
   */
  const removeDeadSources = (sources, graphTraversal) => {
      const filteredSources = {};
      Object.entries(sources).forEach(([inletId, inletSources]) => {
          const filteredInletSources = inletSources.filter(({ nodeId: sourceNodeId }) => graphTraversal.includes(sourceNodeId));
          if (filteredInletSources.length) {
              filteredSources[inletId] = filteredInletSources;
          }
      });
      return filteredSources;
  };

  const FS_OPERATION_SUCCESS = 0;
  const FS_OPERATION_FAILURE = 1;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /** Helper to get node implementation or throw an error if not implemented. */
  const getNodeImplementation = (nodeImplementations, nodeType) => {
      const nodeImplementation = nodeImplementations[nodeType];
      if (!nodeImplementation) {
          throw new Error(`node [${nodeType}] is not implemented`);
      }
      return {
          stateVariables: {},
          declare: () => '',
          loop: () => '',
          messages: () => ({}),
          sharedCode: [],
          ...nodeImplementation,
      };
  };
  /** Helper to build engine metadata from compilation object */
  const buildMetadata = (compilation) => {
      const { audioSettings, inletCallerSpecs, outletListenerSpecs, codeVariableNames, } = compilation;
      return {
          audioSettings: {
              ...audioSettings,
              // Determined at configure
              sampleRate: 0,
              blockSize: 0,
          },
          compilation: {
              inletCallerSpecs,
              outletListenerSpecs,
              codeVariableNames: {
                  inletCallers: codeVariableNames.inletCallers,
                  outletListeners: codeVariableNames.outletListeners,
              },
          },
      };
  };
  /**
   * Takes the graph traversal, and for each node directly assign the
   * inputs of its next nodes where this can be done.
   * This allow the engine to avoid having to copy between a node's outs
   * and its next node's ins in order to pass data around.
   *
   * @returns Maps that contain inlets and outlets that have been handled
   * by precompilation and don't need to be dealt with further.
   */
  const preCompileSignalAndMessageFlow = (compilation) => {
      const { graph, graphTraversal, codeVariableNames, inletCallerSpecs, outletListenerSpecs, } = compilation;
      const graphTraversalNodes = graphTraversal.map((nodeId) => getNode(graph, nodeId));
      const precompiledInlets = {};
      const precompiledOutlets = {};
      const _pushEntry = (portletsIndex, nodeId, portletId) => {
          portletsIndex[nodeId] = portletsIndex[nodeId] || [];
          if (!portletsIndex[nodeId].includes(portletId)) {
              portletsIndex[nodeId].push(portletId);
          }
      };
      graphTraversalNodes.forEach((node) => {
          const { outs, snds } = codeVariableNames.nodes[node.id];
          Object.entries(node.outlets).forEach(([outletId, outlet]) => {
              const outletSinks = getSinks(node, outletId);
              const nodeOutletListenerSpecs = outletListenerSpecs[node.id] || [];
              // Signal inlets can receive input from ONLY ONE signal.
              // Therefore, we replace signal inlet directly with
              // previous node's outs. e.g. instead of :
              //
              //      NODE1_OUT = A + B
              //      NODE2_IN = NODE1_OUT
              //      NODE2_OUT = NODE2_IN * 2
              //
              // we will have :
              //
              //      NODE1_OUT = A + B
              //      NODE2_OUT = NODE1_OUT * 2
              //
              if (outlet.type === 'signal') {
                  outletSinks.forEach((sink) => {
                      codeVariableNames.nodes[sink.nodeId].ins[sink.portletId] =
                          outs[outletId];
                      _pushEntry(precompiledInlets, sink.nodeId, sink.portletId);
                  });
                  // For a message outlet that sends to a single sink node
                  // its out can be directly replaced by next node's in.
                  // e.g. instead of :
                  //
                  //      const NODE1_MSG = () => {
                  //          NODE1_SND('bla')
                  //      }
                  //
                  //      const NODE1_SND = NODE2_MSG
                  //
                  // we can have :
                  //
                  //      const NODE1_MSG = () => {
                  //          NODE2_MSG('bla')
                  //      }
                  //
              }
              else if (outlet.type === 'message') {
                  if (outletSinks.length === 1 &&
                      !nodeOutletListenerSpecs.includes(outlet.id)) {
                      snds[outletId] =
                          codeVariableNames.nodes[outletSinks[0].nodeId].rcvs[outletSinks[0].portletId];
                      _pushEntry(precompiledOutlets, node.id, outletId);
                      // Same thing if there's no sink, but one outlet listener
                  }
                  else if (outletSinks.length === 0 &&
                      nodeOutletListenerSpecs.includes(outlet.id)) {
                      snds[outletId] =
                          codeVariableNames.outletListeners[node.id][outletId];
                      _pushEntry(precompiledOutlets, node.id, outletId);
                      // If no sink, no message receiver, we assign the node SND
                      // a function that does nothing
                  }
                  else if (outletSinks.length === 0 &&
                      !nodeOutletListenerSpecs.includes(outlet.id)) {
                      snds[outletId] =
                          compilation.codeVariableNames.globs.nullMessageReceiver;
                      _pushEntry(precompiledOutlets, node.id, outletId);
                  }
              }
          });
          Object.entries(node.inlets).forEach(([inletId, inlet]) => {
              const nodeInletCallerSpecs = inletCallerSpecs[node.id] || [];
              // If message inlet has no source, no need to compile it.
              if (inlet.type === 'message' &&
                  getSources(node, inletId).length === 0 &&
                  !nodeInletCallerSpecs.includes(inlet.id)) {
                  _pushEntry(precompiledInlets, node.id, inletId);
              }
          });
      });
      compilation.precompiledPortlets.precompiledInlets = precompiledInlets;
      compilation.precompiledPortlets.precompiledOutlets = precompiledOutlets;
  };
  const replaceCoreCodePlaceholders = (bitDepth, code) => {
      const Int = 'i32';
      const Float = bitDepth === 32 ? 'f32' : 'f64';
      const FloatArray = bitDepth === 32 ? 'Float32Array' : 'Float64Array';
      const getFloat = bitDepth === 32 ? 'getFloat32' : 'getFloat64';
      const setFloat = bitDepth === 32 ? 'setFloat32' : 'setFloat64';
      return code
          .replaceAll('${Int}', Int)
          .replaceAll('${Float}', Float)
          .replaceAll('${FloatArray}', FloatArray)
          .replaceAll('${getFloat}', getFloat)
          .replaceAll('${setFloat}', setFloat)
          .replaceAll('${FS_OPERATION_SUCCESS}', FS_OPERATION_SUCCESS.toString())
          .replaceAll('${FS_OPERATION_FAILURE}', FS_OPERATION_FAILURE.toString());
  };
  /**
   * Build graph traversal for the compilation.
   * We first put nodes that push messages, so they have the opportunity
   * to change the engine state before running the loop.
   * !!! This is not fullproof ! For example if a node is pushing messages
   * but also writing signal outputs, it might be run too early / too late.
   * @TODO : outletListeners should also be included ?
   */
  const graphTraversalForCompile = (graph, inletCallerSpecs) => {
      const nodesPullingSignal = Object.values(graph).filter((node) => !!node.isPullingSignal);
      const nodesPushingMessages = Object.values(graph).filter((node) => !!node.isPushingMessages);
      const graphTraversalSignal = messageNodes(graph, nodesPushingMessages);
      const combined = graphTraversalSignal;
      signalNodes(graph, nodesPullingSignal).forEach((nodeId) => {
          if (combined.indexOf(nodeId) === -1) {
              combined.push(nodeId);
          }
      });
      Object.keys(inletCallerSpecs).forEach((nodeId) => {
          if (combined.indexOf(nodeId) === -1) {
              combined.push(nodeId);
          }
      });
      return combined;
  };
  const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * Renders templated strings which contain nested arrays of strings.
   * This helper allows to use functions such as `.map` to generate several lines
   * of code, without having to use `.join('\n')`.
   */
  const renderCode$1 = (strings, ...codeLines) => {
      let rendered = '';
      for (let i = 0; i < strings.length; i++) {
          rendered += strings[i];
          if (codeLines[i]) {
              rendered += _renderCodeRecursive$1(codeLines[i]);
          }
      }
      return rendered;
  };
  const _renderCodeRecursive$1 = (codeLines) => {
      if (Array.isArray(codeLines)) {
          return codeLines
              .map(_renderCodeRecursive$1)
              .filter((line) => line.length)
              .join('\n');
      }
      return codeLines.toString();
  };
  /**
   * @returns Generates a new object with the same keys as `src` and whose
   * values are the result of mapping `src`'s values with `func`.
   *
   * @todo : fix typings so that keys of SrcType appear in DestType.
   */
  const mapObject = (src, func) => {
      const dest = {};
      Object.entries(src).forEach(([key, srcValue], i) => {
          dest[key] = func(srcValue, key, i);
      });
      return dest;
  };
  /**
   * @param func Called for each element in `src`. Returns a pair `[<key>, <value>]`.
   * @returns A new object whoses keys and values are the result of
   * applying `func` to each element in `src`.
   */
  const mapArray$1 = (src, func) => {
      const dest = {};
      src.forEach((srcValue, i) => {
          const [key, destValue] = func(srcValue, i);
          dest[key] = destValue;
      });
      return dest;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  var compileDeclare = (compilation) => {
      const { graph, graphTraversal, macros, codeVariableNames, nodeImplementations, outletListenerSpecs, precompiledPortlets: { precompiledInlets, precompiledOutlets }, debug, } = compilation;
      const graphTraversalNodes = graphTraversal.map((nodeId) => getNode(graph, nodeId));
      const { Var, Func } = macros;
      const { globs } = codeVariableNames;
      const sharedCode = new Set();
      const _isInletAlreadyHandled = (nodeId, portletId) => (precompiledInlets[nodeId] || []).includes(portletId);
      const _isOutletAlreadyHandled = (nodeId, portletId) => (precompiledOutlets[nodeId] || []).includes(portletId);
      // prettier-ignore
      return renderCode$1 `
        let ${Var(globs.iterFrame, 'Int')} = 0
        let ${Var(globs.frame, 'Int')} = 0
        let ${Var(globs.blockSize, 'Int')} = 0
        let ${Var(globs.sampleRate, 'Float')} = 0
        function ${globs.nullMessageReceiver} ${Func([Var('m', 'Message')], 'void')} {}


        ${graphTraversalNodes.map(node => {
        // 0. De-duplicate and insert shared code required by nodes
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        return nodeImplementation.sharedCode.map(codeGenerator => codeGenerator({ macros }))
            .filter(code => {
            if (sharedCode.has(code)) {
                return false;
            }
            else {
                sharedCode.add(code);
                return true;
            }
        });
    })}

        ${graphTraversalNodes.map(node => {
        const { ins, outs, rcvs, snds, state } = codeVariableNames.nodes[node.id];
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        const nodeMessageReceivers = nodeImplementation.messages({
            macros, globs, state, snds, node, compilation
        });
        return [
            // 1. Declares signal inlets and outlets
            Object.values(node.inlets)
                .filter(inlet => inlet.type === 'signal')
                .filter(inlet => !_isInletAlreadyHandled(node.id, inlet.id))
                .map(inlet => `let ${Var(ins[inlet.id], 'Float')} = 0`),
            Object.values(node.outlets)
                .filter(outlet => outlet.type === 'signal')
                .filter(outlet => !_isOutletAlreadyHandled(node.id, outlet.id))
                .map(outlet => `let ${Var(outs[outlet.id], 'Float')} = 0`),
            // 2. Declares message receivers for all message inlets.
            Object.values(node.inlets)
                .filter(inlet => inlet.type === 'message')
                .filter(inlet => !_isInletAlreadyHandled(node.id, inlet.id))
                // prettier-ignore
                .map(inlet => {
                if (typeof nodeMessageReceivers[inlet.id] !== 'string') {
                    throw new Error(`Message receiver for inlet "${inlet.id}" of node type "${node.type}" is not implemented`);
                }
                return `
                            function ${rcvs[inlet.id]} ${Func([
                    Var(globs.m, 'Message')
                ], 'void')} {
                                ${nodeMessageReceivers[inlet.id]}
                                throw new Error('[${node.type}], id "${node.id}", inlet "${inlet.id}", unsupported message : ' + msg_display(${globs.m})${debug ? " + '\\nDEBUG : remember, you must return from message receiver'" : ''})
                            }
                        `;
            }),
            // 3. Custom declarations for the node
            nodeImplementation.declare({
                macros, globs, state, node, compilation
            }),
        ];
    })}

        ${ // 4. Declares message senders for all message outlets.
    // This needs to come after all message receivers are declared since we reference them here.
    // If there are outlets listeners declared we also inject the code here.
    graphTraversalNodes.map(node => {
        const { snds } = codeVariableNames.nodes[node.id];
        const nodeOutletListeners = outletListenerSpecs[node.id] || [];
        return Object.values(node.outlets)
            .filter(outlet => outlet.type === 'message')
            .filter(outlet => !_isOutletAlreadyHandled(node.id, outlet.id))
            .map(outlet => {
            const hasOutletListener = nodeOutletListeners.includes(outlet.id);
            const outletSinks = getSinks(node, outlet.id);
            return renderCode$1 `
                            function ${snds[outlet.id]} ${Func([
                Var('m', 'Message')
            ], 'void')} {
                                ${[
                hasOutletListener ?
                    `${codeVariableNames.outletListeners[node.id][outlet.id]}(${globs.m})` : '',
                outletSinks.map(({ nodeId: sinkNodeId, portletId: inletId }) => `${codeVariableNames.nodes[sinkNodeId].rcvs[inletId]}(${globs.m})`)
            ]}
                            }
                        `;
        });
    })}
    `;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  var compileLoop = (compilation) => {
      const { graph, graphTraversal, codeVariableNames, macros, nodeImplementations, } = compilation;
      const { globs } = codeVariableNames;
      const graphTraversalNodes = graphTraversal.map((nodeId) => getNode(graph, nodeId));
      // prettier-ignore
      return renderCode$1 `
        for (${globs.iterFrame} = 0; ${globs.iterFrame} < ${globs.blockSize}; ${globs.iterFrame}++) {
            ${graphTraversalNodes.map((node) => {
        const { outs, ins, snds, state } = codeVariableNames.nodes[node.id];
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        return [
            // 1. Node loop implementation
            nodeImplementation.loop({
                macros,
                globs,
                node,
                state,
                ins,
                outs,
                snds,
                compilation,
            }),
        ];
    })}
            ${globs.frame}++
        }
    `;
  };

  var BUF_JS = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n// =========================== BUF API\n/**\n * Ring buffer\n */\nclass buf_SoundBuffer {\n    constructor(length) {\n        this.length = length;\n        this.data = createFloatArray(length);\n        this.writeCursor = 0;\n        this.pullAvailableLength = 0;\n    }\n}\n/** Erases all the content from the buffer */\nfunction buf_create(length) {\n    return new buf_SoundBuffer(length);\n}\n/** Erases all the content from the buffer */\nfunction buf_clear(buffer) {\n    buffer.data.fill(0);\n}\n/**\n * Pushes a block to the buffer, throwing an error if the buffer is full.\n * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}\n * is moved corresponding with the length of data written.\n *\n * @todo : Optimize by allowing to read/write directly from host\n */\nfunction buf_pushBlock(buffer, block) {\n    if (buffer.pullAvailableLength + block.length > buffer.length) {\n        throw new Error('buffer full');\n    }\n    let left = block.length;\n    while (left > 0) {\n        const lengthToWrite = toInt(Math.min(toFloat(buffer.length - buffer.writeCursor), toFloat(left)));\n        buffer.data.set(block.subarray(block.length - left, block.length - left + lengthToWrite), buffer.writeCursor);\n        left -= lengthToWrite;\n        buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length;\n        buffer.pullAvailableLength += lengthToWrite;\n    }\n    return buffer.pullAvailableLength;\n}\n/**\n * Pulls a single sample from the buffer.\n * This is a destructive operation, and the sample will be\n * unavailable for subsequent readers with the same operation.\n */\nfunction buf_pullSample(buffer) {\n    if (buffer.pullAvailableLength <= 0) {\n        return 0;\n    }\n    const readCursor = buffer.writeCursor - buffer.pullAvailableLength;\n    buffer.pullAvailableLength -= 1;\n    return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor];\n}\n/**\n * Writes a sample at `@link writeCursor` and increments `writeCursor` by one.\n */\nfunction buf_writeSample(buffer, value) {\n    buffer.data[buffer.writeCursor] = value;\n    buffer.writeCursor = (buffer.writeCursor + 1) % buffer.length;\n}\n/**\n * Reads the sample at position `writeCursor - offset`.\n * @param offset Must be between 0 (for reading the last written sample)\n *  and {@link buf_SoundBuffer#length} - 1. A value outside these bounds will not cause\n *  an error, but might cause unexpected results.\n */\nfunction buf_readSample(buffer, offset) {\n    // R = (buffer.writeCursor - 1 - offset) -> ideal read position\n    // W = R % buffer.length -> wrap it so that its within buffer length bounds (but could be negative)\n    // (W + buffer.length) % buffer.length -> if W negative, (W + buffer.length) shifts it back to positive.\n    return buffer.data[(buffer.length + ((buffer.writeCursor - 1 - offset) % buffer.length)) % buffer.length];\n}\n";

  var SKED_JS = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n/**\n * Skeduler id that will never be used.\n * Can be used as a \"no id\", or \"null\" value.\n */\nconst SKED_ID_NULL = -1;\nconst _SKED_WAIT_IN_PROGRESS = 0;\nconst _SKED_WAIT_OVER = 1;\nconst _SKED_MODE_WAIT = 0;\nconst _SKED_MODE_SUBSCRIBE = 1;\n// =========================== SKED API\nclass SkedRequest {\n}\nclass Skeduler {\n    constructor() {\n        this.eventLog = new Set();\n        this.requests = new Map();\n        this.callbacks = new Map();\n        this.idCounter = 1;\n        this.isLoggingEvents = false;\n    }\n}\nfunction sked_create(isLoggingEvents) {\n    const skeduler = new Skeduler();\n    skeduler.isLoggingEvents = isLoggingEvents;\n    return skeduler;\n}\nfunction sked_wait(skeduler, event, callback) {\n    if (skeduler.isLoggingEvents === false) {\n        throw new Error(\"Please activate skeduler's isLoggingEvents\");\n    }\n    if (skeduler.eventLog.has(event)) {\n        callback(event);\n        return SKED_ID_NULL;\n    }\n    else {\n        return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT);\n    }\n}\nfunction sked_subscribe(skeduler, event, callback) {\n    return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE);\n}\nfunction sked_emit(skeduler, event) {\n    if (skeduler.isLoggingEvents === true) {\n        skeduler.eventLog.add(event);\n    }\n    if (skeduler.requests.has(event)) {\n        const requests = skeduler.requests.get(event);\n        const requestsStaying = [];\n        for (let i = 0; i < requests.length; i++) {\n            const request = requests[i];\n            if (skeduler.callbacks.has(request.id)) {\n                skeduler.callbacks.get(request.id)(event);\n                if (request.mode === _SKED_MODE_WAIT) {\n                    skeduler.callbacks.delete(request.id);\n                }\n                else {\n                    requestsStaying.push(request);\n                }\n            }\n        }\n        skeduler.requests.set(event, requestsStaying);\n    }\n}\nfunction sked_cancel(skeduler, id) {\n    skeduler.callbacks.delete(id);\n}\nfunction _sked_createRequest(skeduler, event, callback, mode) {\n    const id = _sked_nextId(skeduler);\n    const request = { id, mode };\n    skeduler.callbacks.set(id, callback);\n    if (!skeduler.requests.has(event)) {\n        skeduler.requests.set(event, [request]);\n    }\n    else {\n        skeduler.requests.get(event).push(request);\n    }\n    return id;\n}\nfunction _sked_nextId(skeduler) {\n    return skeduler.idCounter++;\n}\n";

  var FS_JS = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\nconst _FS_OPERATIONS_IDS = new Set();\nconst _FS_OPERATIONS_CALLBACKS = new Map();\nconst _FS_OPERATIONS_SOUND_CALLBACKS = new Map();\nconst _FS_SOUND_STREAM_BUFFERS = new Map();\n// We start at 1, because 0 is what ASC uses when host forgets to pass an arg to \n// a function. Therefore we can get false negatives when a test happens to expect a 0.\nlet _FS_OPERATION_COUNTER = 1;\nconst _FS_SOUND_BUFFER_LENGTH = 20 * 44100;\n// =========================== EXPORTED API\nfunction x_fs_onReadSoundFileResponse(id, status, sound) {\n    _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse');\n    _FS_OPERATIONS_IDS.delete(id);\n    // Finish cleaning before calling the callback in case it would throw an error.\n    const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id);\n    callback(id, status, sound);\n    _FS_OPERATIONS_SOUND_CALLBACKS.delete(id);\n}\nfunction x_fs_onWriteSoundFileResponse(id, status) {\n    _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse');\n    _FS_OPERATIONS_IDS.delete(id);\n    // Finish cleaning before calling the callback in case it would throw an error.\n    const callback = _FS_OPERATIONS_CALLBACKS.get(id);\n    callback(id, status);\n    _FS_OPERATIONS_CALLBACKS.delete(id);\n}\nfunction x_fs_onSoundStreamData(id, block) {\n    _fs_assertOperationExists(id, 'x_fs_onSoundStreamData');\n    const buffers = _FS_SOUND_STREAM_BUFFERS.get(id);\n    for (let i = 0; i < buffers.length; i++) {\n        buf_pushBlock(buffers[i], block[i]);\n    }\n    return buffers[0].pullAvailableLength;\n}\nfunction x_fs_onCloseSoundStream(id, status) {\n    fs_closeSoundStream(id, status);\n}\n// =========================== FS API\nclass fs_SoundInfo {\n}\nfunction fs_readSoundFile(url, soundInfo, callback) {\n    const id = _fs_createOperationId();\n    _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback);\n    i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo));\n    return id;\n}\nfunction fs_writeSoundFile(sound, url, soundInfo, callback) {\n    const id = _fs_createOperationId();\n    _FS_OPERATIONS_CALLBACKS.set(id, callback);\n    i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo));\n    return id;\n}\nfunction fs_openSoundReadStream(url, soundInfo, callback) {\n    const id = _fs_createOperationId();\n    const buffers = [];\n    for (let channel = 0; channel < soundInfo.channelCount; channel++) {\n        buffers.push(new buf_SoundBuffer(_FS_SOUND_BUFFER_LENGTH));\n    }\n    _FS_SOUND_STREAM_BUFFERS.set(id, buffers);\n    _FS_OPERATIONS_CALLBACKS.set(id, callback);\n    i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo));\n    return id;\n}\nfunction fs_openSoundWriteStream(url, soundInfo, callback) {\n    const id = _fs_createOperationId();\n    _FS_SOUND_STREAM_BUFFERS.set(id, []);\n    _FS_OPERATIONS_CALLBACKS.set(id, callback);\n    i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo));\n    return id;\n}\nfunction fs_sendSoundStreamData(id, block) {\n    _fs_assertOperationExists(id, 'fs_sendSoundStreamData');\n    i_fs_sendSoundStreamData(id, block);\n}\nfunction fs_closeSoundStream(id, status) {\n    if (!_FS_OPERATIONS_IDS.has(id)) {\n        return;\n    }\n    _FS_OPERATIONS_IDS.delete(id);\n    _FS_OPERATIONS_CALLBACKS.get(id)(id, status);\n    _FS_OPERATIONS_CALLBACKS.delete(id);\n    // Delete this last, to give the callback \n    // a chance to save a reference to the buffer\n    // If write stream, there won't be a buffer\n    if (_FS_SOUND_STREAM_BUFFERS.has(id)) {\n        _FS_SOUND_STREAM_BUFFERS.delete(id);\n    }\n    i_fs_closeSoundStream(id, status);\n}\nfunction fs_soundInfoToMessage(soundInfo) {\n    const info = msg_create([\n        MSG_FLOAT_TOKEN,\n        MSG_FLOAT_TOKEN,\n        MSG_FLOAT_TOKEN,\n        MSG_STRING_TOKEN,\n        soundInfo.encodingFormat.length,\n        MSG_STRING_TOKEN,\n        soundInfo.endianness.length,\n        MSG_STRING_TOKEN,\n        soundInfo.extraOptions.length\n    ]);\n    msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount));\n    msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate));\n    msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth));\n    msg_writeStringToken(info, 3, soundInfo.encodingFormat);\n    msg_writeStringToken(info, 4, soundInfo.endianness);\n    msg_writeStringToken(info, 5, soundInfo.extraOptions);\n    return info;\n}\n// =========================== PRIVATE\nfunction _fs_createOperationId() {\n    const id = _FS_OPERATION_COUNTER++;\n    _FS_OPERATIONS_IDS.add(id);\n    return id;\n}\nfunction _fs_assertOperationExists(id, operationName) {\n    if (!_FS_OPERATIONS_IDS.has(id)) {\n        throw new Error(operationName + ' operation unknown : ' + id.toString());\n    }\n}\n";

  var COMMONS_JS = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\nconst _commons_ARRAYS = new Map();\nconst _commons_ARRAYS_SKEDULER = sked_create(false);\nconst _commons_ENGINE_LOGGED_SKEDULER = sked_create(true);\n// =========================== COMMONS API\n/**\n * @param callback Called when the engine is configured, or immediately if the engine\n * was already configured.\n */\nfunction commons_waitEngineConfigure(callback) {\n    sked_wait(_commons_ENGINE_LOGGED_SKEDULER, 'configure', callback);\n}\n/**\n * @param callback Called immediately if the array exists, and subsequently, everytime\n * the array is set again.\n * @returns An id that can be used to cancel the subscription.\n */\nfunction commons_subscribeArrayChanges(arrayName, callback) {\n    const id = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback);\n    if (_commons_ARRAYS.has(arrayName)) {\n        callback(arrayName);\n    }\n    return id;\n}\n/**\n * @param id The id received when subscribing.\n */\nfunction commons_cancelArrayChangesSubscription(id) {\n    sked_cancel(_commons_ARRAYS_SKEDULER, id);\n}\n/** Gets an named array, throwing an error if the array doesn't exist. */\nfunction commons_getArray(arrayName) {\n    if (!_commons_ARRAYS.has(arrayName)) {\n        throw new Error('Unknown array ' + arrayName);\n    }\n    return _commons_ARRAYS.get(arrayName);\n}\nfunction commons_hasArray(arrayName) {\n    return _commons_ARRAYS.has(arrayName);\n}\nfunction commons_setArray(arrayName, array) {\n    _commons_ARRAYS.set(arrayName, array);\n    sked_emit(_commons_ARRAYS_SKEDULER, arrayName);\n}\n// =========================== PRIVATE API\nfunction _commons_emitEngineConfigure() {\n    sked_emit(_commons_ENGINE_LOGGED_SKEDULER, 'configure');\n}\n";

  const CORE = `
const i32 = (v) => v
const f32 = i32
const f64 = i32
const toInt = (v) => v
const toFloat = (v) => v
const createFloatArray = (length) => 
    new \${FloatArray}(length)
const setFloatDataView = (d, p, v) => d.\${setFloat}(p, v)
const getFloatDataView = (d, p) => d.\${getFloat}(p)
const FS_OPERATION_SUCCESS = ${FS_OPERATION_SUCCESS}
const FS_OPERATION_FAILURE = ${FS_OPERATION_FAILURE}
`;
  const MSG = `
const MSG_FLOAT_TOKEN = "number"
const MSG_STRING_TOKEN = "string"
const msg_create = () => []
const msg_getLength = (m) => m.length
const msg_getTokenType = (m, i) => typeof m[i]
const msg_isStringToken = (m, i) => msg_getTokenType(m, i) === 'string'
const msg_isFloatToken = (m, i) => msg_getTokenType(m, i) === 'number'
const msg_isMatching = (m, tokenTypes) => {
    return (m.length === tokenTypes.length) 
        && m.every((v, i) => msg_getTokenType(m, i) === tokenTypes[i])
}
const msg_writeFloatToken = ( m, i, v ) => m[i] = v
const msg_writeStringToken = msg_writeFloatToken
const msg_readFloatToken = ( m, i ) => m[i]
const msg_readStringToken = msg_readFloatToken
const msg_floats = (v) => v
const msg_strings = (v) => v
const msg_display = (m) => '[' + m
    .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
    .join(', ') + ']'
`;
  var generateCoreCodeJs = (bitDepth) => {
      return (replaceCoreCodePlaceholders(bitDepth, CORE) +
          BUF_JS +
          SKED_JS +
          COMMONS_JS +
          MSG +
          FS_JS);
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const compileOutletListeners = ({ outletListenerSpecs, codeVariableNames }, generateCode) => renderCode$1 `${Object.entries(outletListenerSpecs).map(([nodeId, outletIds]) => outletIds.map((outletId) => {
    const listenerVariableName = codeVariableNames.outletListeners[nodeId][outletId];
    return generateCode(listenerVariableName, nodeId, outletId);
}))}`;
  const compileInletCallers = ({ inletCallerSpecs, codeVariableNames, macros: { Var, Func }, }) => 
  // Here not possible to assign directly the receiver because otherwise assemblyscript
  // doesn't export a function but a global instead.
  renderCode$1 `${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => inletIds.map((inletId) => `function ${codeVariableNames.inletCallers[nodeId][inletId]} ${Func([Var('m', 'Message')], 'void')} {${codeVariableNames.nodes[nodeId].rcvs[inletId]}(m)}`))}`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  var compileToJavascript = (compilation) => {
      const { codeVariableNames, outletListenerSpecs, inletCallerSpecs, audioSettings, } = compilation;
      const globs = compilation.codeVariableNames.globs;
      const metadata = buildMetadata(compilation);
      // When setting an array we need to make sure it is converted to the right type.
      const floatArrayType = getFloatArrayType(audioSettings.bitDepth);
      // prettier-ignore
      return renderCode$1 `
        ${generateCoreCodeJs(audioSettings.bitDepth)}

        ${compileDeclare(compilation)}

        ${compileInletCallers(compilation)}

        ${compileOutletListeners(compilation, (variableName, nodeId, outletId) => `
            const ${variableName} = (m) => {
                exports.outletListeners['${nodeId}']['${outletId}'].onMessage(m)
            }
        `)}

        const exports = {
            metadata: ${JSON.stringify(metadata)},
            configure: (sampleRate, blockSize) => {
                exports.metadata.audioSettings.sampleRate = sampleRate
                exports.metadata.audioSettings.blockSize = blockSize
                ${globs.sampleRate} = sampleRate
                ${globs.blockSize} = blockSize
                _commons_emitEngineConfigure()
            },
            loop: (${globs.input}, ${globs.output}) => {
                ${compileLoop(compilation)}
            },
            commons: {
                getArray: commons_getArray,
                setArray: (arrayName, array) => commons_setArray(arrayName, new ${floatArrayType.name}(array)),
            },
            outletListeners: {
                ${Object.entries(outletListenerSpecs).map(([nodeId, outletIds]) => renderCode$1 `${nodeId}: {
                        ${outletIds.map(outletId => `"${outletId}": {onMessage: () => undefined},`)}
                    },`)}
            },
            inletCallers: {
                ${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => renderCode$1 `${nodeId}: {
                        ${inletIds.map(inletId => `"${inletId}": ${codeVariableNames.inletCallers[nodeId][inletId]},`)}
                    },`)}
            },
            fs: {
                onReadSoundFile: () => undefined,
                onWriteSoundFile: () => undefined,
                onOpenSoundReadStream: () => undefined,
                onOpenSoundWriteStream: () => undefined,
                onSoundStreamData: () => undefined,
                onCloseSoundStream: () => undefined,
                sendReadSoundFileResponse: x_fs_onReadSoundFileResponse,
                sendWriteSoundFileResponse: x_fs_onWriteSoundFileResponse,
                sendSoundStreamData: x_fs_onSoundStreamData,
                closeSoundStream: x_fs_onCloseSoundStream,
            },
        }

        // FS IMPORTS
        const i_fs_readSoundFile = (...args) => exports.fs.onReadSoundFile(...args)
        const i_fs_writeSoundFile = (...args) => exports.fs.onWriteSoundFile(...args)
        const i_fs_openSoundReadStream = (...args) => exports.fs.onOpenSoundReadStream(...args)
        const i_fs_openSoundWriteStream = (...args) => exports.fs.onOpenSoundWriteStream(...args)
        const i_fs_sendSoundStreamData = (...args) => exports.fs.onSoundStreamData(...args)
        const i_fs_closeSoundStream = (...args) => exports.fs.onCloseSoundStream(...args)
    `;
  };

  var CORE_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\ntype FloatArray = ${FloatArray}\ntype Float = ${Float}\ntype Int = ${Int}\n\n// =========================== CORE API\nfunction toInt (v: ${Float}): ${Int} { return ${Int}(v) }\nfunction toFloat (v: ${Int}): ${Float} { return ${Float}(v) }\nfunction createFloatArray (length: Int): FloatArray {\n    return new ${FloatArray}(length)\n}\nfunction setFloatDataView (\n    dataView: DataView, \n    position: Int, \n    value: Float,\n): void { dataView.${setFloat}(position, value) }\nfunction getFloatDataView (\n    dataView: DataView, \n    position: Int, \n): Float { return dataView.${getFloat}(position) }\n\n// =========================== FS CONSTANTS\nconst FS_OPERATION_SUCCESS: Int = ${FS_OPERATION_SUCCESS}\nconst FS_OPERATION_FAILURE: Int = ${FS_OPERATION_FAILURE}\n\n// =========================== EXPORTED API\nfunction x_core_createListOfArrays(): FloatArray[] {\n    const arrays: FloatArray[] = []\n    return arrays\n}\n\nfunction x_core_pushToListOfArrays(arrays: FloatArray[], array: FloatArray): void {\n    arrays.push(array)\n}\n\nfunction x_core_getListOfArraysLength(arrays: FloatArray[]): Int {\n    return arrays.length\n}\n\nfunction x_core_getListOfArraysElem(arrays: FloatArray[], index: Int): FloatArray {\n    return arrays[index]\n}";

  var BUF_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\n// =========================== BUF API\n/**\n * Ring buffer \n */\nclass buf_SoundBuffer {\n    public data: FloatArray\n    public length: Int\n    public writeCursor: Int\n    public pullAvailableLength: Int\n\n    constructor(length: Int) {\n        this.length = length\n        this.data = createFloatArray(length)\n        this.writeCursor = 0\n        this.pullAvailableLength = 0\n    }\n}\n\n/** Erases all the content from the buffer */\nfunction buf_create (length: Int): buf_SoundBuffer {\n    return new buf_SoundBuffer(length)\n}\n\n/** Erases all the content from the buffer */\nfunction buf_clear (buffer: buf_SoundBuffer): void {\n    buffer.data.fill(0)\n}\n\n/**\n * Pushes a block to the buffer, throwing an error if the buffer is full. \n * If the block is written successfully, {@link buf_SoundBuffer#writeCursor} \n * is moved corresponding with the length of data written.\n * \n * @todo : Optimize by allowing to read/write directly from host\n */\nfunction buf_pushBlock (\n    buffer: buf_SoundBuffer,\n    block: FloatArray,\n): Int {\n    if (buffer.pullAvailableLength + block.length > buffer.length) {\n        throw new Error('buffer full')\n    }\n\n    let left: Int = block.length\n    while (left > 0) {\n        const lengthToWrite = toInt(Math.min(\n            toFloat(buffer.length - buffer.writeCursor), \n            toFloat(left)\n        ))\n        buffer.data.set(\n            block.subarray(\n                block.length - left, \n                block.length - left + lengthToWrite\n            ), \n            buffer.writeCursor\n        )\n        left -= lengthToWrite\n        buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length\n        buffer.pullAvailableLength += lengthToWrite\n    }\n    return buffer.pullAvailableLength\n}\n\n/**\n * Pulls a single sample from the buffer. \n * This is a destructive operation, and the sample will be \n * unavailable for subsequent readers with the same operation.\n */\nfunction buf_pullSample (buffer: buf_SoundBuffer): Float {\n    if (buffer.pullAvailableLength <= 0) {\n        return 0\n    }\n    const readCursor: Int = buffer.writeCursor - buffer.pullAvailableLength\n    buffer.pullAvailableLength -= 1\n    return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]\n}\n\n/**\n * Writes a sample at `@link writeCursor` and increments `writeCursor` by one.\n */\nfunction buf_writeSample (buffer: buf_SoundBuffer, value: Float): void {\n    buffer.data[buffer.writeCursor] = value\n    buffer.writeCursor = (buffer.writeCursor + 1) % buffer.length\n}\n\n/**\n * Reads the sample at position `writeCursor - offset`.\n * @param offset Must be between 0 (for reading the last written sample)\n *  and {@link buf_SoundBuffer#length} - 1. A value outside these bounds will not cause \n *  an error, but might cause unexpected results.\n */\nfunction buf_readSample (buffer: buf_SoundBuffer, offset: Int): Float {\n    // R = (buffer.writeCursor - 1 - offset) -> ideal read position\n    // W = R % buffer.length -> wrap it so that its within buffer length bounds (but could be negative)\n    // (W + buffer.length) % buffer.length -> if W negative, (W + buffer.length) shifts it back to positive.\n    return buffer.data[(buffer.length + ((buffer.writeCursor - 1 - offset) % buffer.length)) % buffer.length]\n}";

  var SKED_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\ntype SkedCallback = (event: SkedEvent) => void\ntype SkedId = Int\ntype SkedMode = Int\ntype SkedEvent = string\n\n/** \n * Skeduler id that will never be used. \n * Can be used as a \"no id\", or \"null\" value. \n */\nconst SKED_ID_NULL: SkedId = -1\n\nconst _SKED_WAIT_IN_PROGRESS: Int = 0\nconst _SKED_WAIT_OVER: Int = 1\n\nconst _SKED_MODE_WAIT = 0\nconst _SKED_MODE_SUBSCRIBE = 1\n\n// =========================== SKED API\n\nclass SkedRequest {\n    id: SkedId\n    mode: SkedMode\n}\n\nclass Skeduler {\n    requests: Map<SkedEvent, Array<SkedRequest>>\n\n    callbacks: Map<SkedId, SkedCallback>\n\n    isLoggingEvents: boolean\n    eventLog: Set<SkedEvent>\n\n    idCounter: SkedId\n    \n    constructor() {\n        this.eventLog = new Set()\n        this.requests = new Map()\n        this.callbacks = new Map()\n        this.idCounter = 1\n        this.isLoggingEvents = false\n    }\n}\n\nfunction sked_create (isLoggingEvents: boolean): Skeduler {\n    const skeduler = new Skeduler()\n    skeduler.isLoggingEvents = isLoggingEvents\n    return skeduler\n}\n\nfunction sked_wait (\n    skeduler: Skeduler,\n    event: SkedEvent,\n    callback: SkedCallback,\n): SkedId {\n    if (skeduler.isLoggingEvents === false) {\n        throw new Error(\"Please activate skeduler's isLoggingEvents\")\n    }\n\n    if (skeduler.eventLog.has(event)) {\n        callback(event)\n        return SKED_ID_NULL\n    } else {\n        return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)\n    }\n}\n\nfunction sked_subscribe (\n    skeduler: Skeduler,\n    event: SkedEvent,\n    callback: SkedCallback,\n): SkedId {\n    return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE)\n}\n\nfunction sked_emit (\n    skeduler: Skeduler,\n    event: SkedEvent,\n): void {\n    if (skeduler.isLoggingEvents === true) {\n        skeduler.eventLog.add(event)\n    }\n    if (skeduler.requests.has(event)) {\n        const requests: Array<SkedRequest> = skeduler.requests.get(event)\n        const requestsStaying: Array<SkedRequest> = []\n        for (let i: Int = 0; i < requests.length; i++) {\n            const request: SkedRequest = requests[i]\n            if (skeduler.callbacks.has(request.id)) {\n                skeduler.callbacks.get(request.id)(event)\n                if (request.mode === _SKED_MODE_WAIT) {\n                    skeduler.callbacks.delete(request.id)\n                } else {\n                    requestsStaying.push(request)\n                }\n            }\n        }\n        skeduler.requests.set(event, requestsStaying)\n    }\n}\n\nfunction sked_cancel (\n    skeduler: Skeduler,\n    id: SkedId,\n): void {\n    skeduler.callbacks.delete(id)\n}\n\nfunction _sked_createRequest (\n    skeduler: Skeduler,\n    event: SkedEvent,\n    callback: SkedCallback,\n    mode: SkedMode,\n): SkedId {\n    const id = _sked_nextId(skeduler)\n    const request: SkedRequest = {id, mode}\n    skeduler.callbacks.set(id, callback)\n    if (!skeduler.requests.has(event)) {\n        skeduler.requests.set(event, [request])    \n    } else {\n        skeduler.requests.get(event).push(request)\n    }\n    return id\n}\n\nfunction _sked_nextId (\n    skeduler: Skeduler,\n): SkedId {\n    return skeduler.idCounter++\n}";

  var MSG_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\ntype MessageFloatToken = Float\ntype MessageCharToken = Int\n\ntype MessageTemplate = Array<Int>\ntype MessageHeaderEntry = Int\ntype MessageHeader = Int32Array\n\nconst MSG_FLOAT_TOKEN: MessageHeaderEntry = 0\nconst MSG_STRING_TOKEN: MessageHeaderEntry = 1\n\n\n// =========================== EXPORTED API\nfunction x_msg_create(templateTypedArray: Int32Array): Message {\n    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)\n    for (let i: Int = 0; i < templateTypedArray.length; i++) {\n        template[i] = templateTypedArray[i]\n    }\n    return msg_create(template)\n}\n\nfunction x_msg_getTokenTypes(message: Message): MessageHeader {\n    return message.tokenTypes\n}\n\nfunction x_msg_createTemplate(length: i32): Int32Array {\n    return new Int32Array(length)\n}\n\n\n// =========================== MSG API\nfunction msg_create(template: MessageTemplate): Message {\n    let i: Int = 0\n    let byteCount: Int = 0\n    let tokenTypes: Array<MessageHeaderEntry> = []\n    let tokenPositions: Array<MessageHeaderEntry> = []\n\n    i = 0\n    while (i < template.length) {\n        switch(template[i]) {\n            case MSG_FLOAT_TOKEN:\n                byteCount += sizeof<MessageFloatToken>()\n                tokenTypes.push(MSG_FLOAT_TOKEN)\n                tokenPositions.push(byteCount)\n                i += 1\n                break\n            case MSG_STRING_TOKEN:\n                byteCount += sizeof<MessageCharToken>() * template[i + 1]\n                tokenTypes.push(MSG_STRING_TOKEN)\n                tokenPositions.push(byteCount)\n                i += 2\n                break\n            default:\n                throw new Error(`unknown token type \" + template[i]`)\n        }\n    }\n\n    const tokenCount = tokenTypes.length\n    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()\n    byteCount += headerByteCount\n\n    const buffer = new ArrayBuffer(byteCount)\n    const dataView = new DataView(buffer)\n    let writePosition: Int = 0\n    \n    dataView.setInt32(writePosition, tokenCount)\n    writePosition += sizeof<MessageHeaderEntry>()\n\n    for (i = 0; i < tokenCount; i++) {\n        dataView.setInt32(writePosition, tokenTypes[i])\n        writePosition += sizeof<MessageHeaderEntry>()\n    }\n\n    dataView.setInt32(writePosition, headerByteCount)\n    writePosition += sizeof<MessageHeaderEntry>()\n    for (i = 0; i < tokenCount; i++) {\n        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])\n        writePosition += sizeof<MessageHeaderEntry>()\n    }\n\n    return new Message(buffer)\n}\n\nfunction msg_writeStringToken(\n    message: Message, \n    tokenIndex: Int,\n    value: string,\n): void {\n    const startPosition = message.tokenPositions[tokenIndex]\n    const endPosition = message.tokenPositions[tokenIndex + 1]\n    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n    if (value.length !== expectedStringLength) {\n        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())\n    }\n\n    for (let i = 0; i < value.length; i++) {\n        message.dataView.setInt32(\n            startPosition + i * sizeof<MessageCharToken>(), \n            value.codePointAt(i)\n        )\n    }\n}\n\nfunction msg_writeFloatToken(\n    message: Message, \n    tokenIndex: Int,\n    value: MessageFloatToken,\n): void {\n    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)\n}\n\nfunction msg_readStringToken(\n    message: Message, \n    tokenIndex: Int,\n): string {\n    const startPosition = message.tokenPositions[tokenIndex]\n    const endPosition = message.tokenPositions[tokenIndex + 1]\n    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n    let value: string = ''\n    for (let i = 0; i < stringLength; i++) {\n        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))\n    }\n    return value\n}\n\nfunction msg_readFloatToken(\n    message: Message, \n    tokenIndex: Int,\n): MessageFloatToken {\n    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])\n}\n\nfunction msg_getLength(message: Message): Int {\n    return message.tokenTypes.length\n}\n\nfunction msg_getTokenType(message: Message, tokenIndex: Int): Int {\n    return message.tokenTypes[tokenIndex]\n}\n\nfunction msg_isStringToken(\n    message: Message, \n    tokenIndex: Int    \n): boolean {\n    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN\n}\n\nfunction msg_isFloatToken(\n    message: Message, \n    tokenIndex: Int    \n): boolean {\n    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN\n}\n\nfunction msg_isMatching(message: Message, tokenTypes: Array<MessageHeaderEntry>): boolean {\n    if (message.tokenTypes.length !== tokenTypes.length) {\n        return false\n    }\n    for (let i: Int = 0; i < tokenTypes.length; i++) {\n        if (message.tokenTypes[i] !== tokenTypes[i]) {\n            return false\n        }\n    }\n    return true\n}\n\nfunction msg_floats(values: Array<Float>): Message {\n    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))\n    for (let i: Int = 0; i < values.length; i++) {\n        msg_writeFloatToken(message, i, values[i])\n    }\n    return message\n}\n\nfunction msg_strings(values: Array<string>): Message {\n    const template: MessageTemplate = []\n    for (let i: Int = 0; i < values.length; i++) {\n        template.push(MSG_STRING_TOKEN)\n        template.push(values[i].length)\n    }\n    const message: Message = msg_create(template)\n    for (let i: Int = 0; i < values.length; i++) {\n        msg_writeStringToken(message, i, values[i])\n    }\n    return message\n}\n\nfunction msg_display(message: Message): string {\n    let displayArray: Array<string> = []\n    for (let i: Int = 0; i < msg_getLength(message); i++) {\n        if (msg_isFloatToken(message, i)) {\n            displayArray.push(msg_readFloatToken(message, i).toString())\n        } else {\n            displayArray.push('\"' + msg_readStringToken(message, i) + '\"')\n        }\n    }\n    return '[' + displayArray.join(', ') + ']'\n}\n\n\n// =========================== PRIVATE\n// Message header : [\n//      <Token count>, \n//      <Token 1 type>,  ..., <Token N type>, \n//      <Token 1 start>, ..., <Token N start>, <Token N end>\n//      ... DATA ...\n// ]\nclass Message {\n    public dataView: DataView\n    public header: MessageHeader\n    public tokenCount: MessageHeaderEntry\n    public tokenTypes: MessageHeader\n    public tokenPositions: MessageHeader\n\n    constructor(messageBuffer: ArrayBuffer) {\n        const dataView = new DataView(messageBuffer)\n        const tokenCount = _msg_unpackTokenCount(dataView)\n        const header = _msg_unpackHeader(dataView, tokenCount)\n        this.dataView = dataView\n        this.tokenCount = tokenCount\n        this.header = header \n        this.tokenTypes = _msg_unpackTokenTypes(header)\n        this.tokenPositions = _msg_unpackTokenPositions(header)\n    }\n}\n\nfunction _msg_computeHeaderLength(tokenCount: Int): Int {\n    return 1 + tokenCount * 2 + 1\n}\n\nfunction _msg_unpackTokenCount(messageDataView: DataView): MessageHeaderEntry {\n    return messageDataView.getInt32(0)\n}\n\nfunction _msg_unpackHeader(messageDataView: DataView, tokenCount: MessageHeaderEntry): MessageHeader {\n    const headerLength = _msg_computeHeaderLength(tokenCount)\n    // TODO : why is this `wrap` not working ?\n    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)\n    const messageHeader = new Int32Array(headerLength)\n    for (let i = 0; i < headerLength; i++) {\n        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)\n    }\n    return messageHeader\n}\n\nfunction _msg_unpackTokenTypes(header: MessageHeader): MessageHeader {\n    return header.slice(1, 1 + header[0])\n}\n\nfunction _msg_unpackTokenPositions(header: MessageHeader): MessageHeader {\n    return header.slice(1 + header[0])\n}";

  var COMMONS_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\nconst _commons_ARRAYS: Map<string, FloatArray> = new Map()\nconst _commons_ARRAYS_SKEDULER: Skeduler = sked_create(false)\n\nconst _commons_ENGINE_LOGGED_SKEDULER: Skeduler = sked_create(true)\n\n// =========================== COMMONS API\n/** \n * @param callback Called when the engine is configured, or immediately if the engine\n * was already configured.\n */\nfunction commons_waitEngineConfigure(\n    callback: SkedCallback,\n): void {\n    sked_wait(_commons_ENGINE_LOGGED_SKEDULER, 'configure', callback)\n}\n\n/** \n * @param callback Called immediately if the array exists, and subsequently, everytime \n * the array is set again.\n * @returns An id that can be used to cancel the subscription.\n */\nfunction commons_subscribeArrayChanges(\n    arrayName: string,\n    callback: SkedCallback,\n): SkedId {\n    const id: SkedId = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback)\n    if (_commons_ARRAYS.has(arrayName)) {\n        callback(arrayName)\n    }\n    return id\n}\n\n/** \n * @param id The id received when subscribing.\n */\nfunction commons_cancelArrayChangesSubscription(\n    id: SkedId,\n): void {\n    sked_cancel(_commons_ARRAYS_SKEDULER, id)\n}\n\n/** Gets an named array, throwing an error if the array doesn't exist. */\nfunction commons_getArray(\n    arrayName: string,\n): FloatArray {\n    if (!_commons_ARRAYS.has(arrayName)) {\n        throw new Error('Unknown array ' + arrayName)\n    }\n    return _commons_ARRAYS.get(arrayName)\n}\n\nfunction commons_hasArray(\n    arrayName: string,\n): boolean {\n    return _commons_ARRAYS.has(arrayName)\n}\n\nfunction commons_setArray(\n    arrayName: string,\n    array: FloatArray,\n): void {\n    _commons_ARRAYS.set(arrayName, array)\n    sked_emit(_commons_ARRAYS_SKEDULER, arrayName)\n}\n\n// =========================== PRIVATE API\nfunction _commons_emitEngineConfigure(): void {\n    sked_emit(_commons_ENGINE_LOGGED_SKEDULER, 'configure')\n}";

  var FS_ASC = "/*\n * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>\n *\n * BSD Simplified License.\n * For information on usage and redistribution, and for a DISCLAIMER OF ALL\n * WARRANTIES, see the file, \"LICENSE.txt,\" in this distribution.\n *\n * See https://github.com/sebpiq/WebPd_pd-parser for documentation\n *\n */\n\ntype fs_OperationId = Int\ntype fs_OperationStatus = Int\ntype fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void\ntype fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void\n\ntype Url = string\n\nconst _FS_OPERATIONS_IDS = new Set<fs_OperationId>()\nconst _FS_OPERATIONS_CALLBACKS = new Map<fs_OperationId, fs_OperationCallback>()\nconst _FS_OPERATIONS_SOUND_CALLBACKS = new Map<fs_OperationId, fs_OperationSoundCallback>()\nconst _FS_SOUND_STREAM_BUFFERS = new Map<fs_OperationId, Array<buf_SoundBuffer>>()\n\n// We start at 1, because 0 is what ASC uses when host forgets to pass an arg to \n// a function. Therefore we can get false negatives when a test happens to expect a 0.\nlet _FS_OPERATION_COUNTER: Int = 1\n\nconst _FS_SOUND_BUFFER_LENGTH = 20 * 44100\n\n// =========================== EXPORTED API\nfunction x_fs_onReadSoundFileResponse (\n    id: fs_OperationId, \n    status: fs_OperationStatus,\n    sound: FloatArray[]\n): void {\n    _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')\n    _FS_OPERATIONS_IDS.delete(id)\n    // Finish cleaning before calling the callback in case it would throw an error.\n    const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)\n    callback(id, status, sound)\n    _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)\n}\n\nfunction x_fs_onWriteSoundFileResponse (\n    id: fs_OperationId,\n    status: fs_OperationStatus,\n): void {\n    _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')\n    _FS_OPERATIONS_IDS.delete(id)\n    // Finish cleaning before calling the callback in case it would throw an error.\n    const callback = _FS_OPERATIONS_CALLBACKS.get(id)\n    callback(id, status)\n    _FS_OPERATIONS_CALLBACKS.delete(id)\n}\n\nfunction x_fs_onSoundStreamData (\n    id: fs_OperationId, \n    block: FloatArray[]\n): Int {\n    _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')\n    const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)\n    for (let i: Int = 0; i < buffers.length; i++) {\n        buf_pushBlock(buffers[i], block[i])\n    }\n    return buffers[0].pullAvailableLength\n}\n\nfunction x_fs_onCloseSoundStream (\n    id: fs_OperationId, \n    status: fs_OperationStatus\n): void {\n    fs_closeSoundStream(id, status)\n}\n\n// =========================== FS API\nclass fs_SoundInfo {\n    channelCount: Int\n    sampleRate: Int\n    bitDepth: Int\n    encodingFormat: string\n    endianness: string\n    extraOptions: string\n}\n\nfunction fs_readSoundFile(\n    url: Url,\n    soundInfo: fs_SoundInfo,\n    callback: fs_OperationSoundCallback\n): fs_OperationId {\n    const id: fs_OperationId = _fs_createOperationId()\n    _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)\n    i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))\n    return id\n}\n\nfunction fs_writeSoundFile(\n    sound: FloatArray[],\n    url: Url,\n    soundInfo: fs_SoundInfo,\n    callback: fs_OperationCallback,\n): fs_OperationId {\n    const id: fs_OperationId = _fs_createOperationId()\n    _FS_OPERATIONS_CALLBACKS.set(id, callback)\n    i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))\n    return id\n}\n\nfunction fs_openSoundReadStream(\n    url: Url, \n    soundInfo: fs_SoundInfo,\n    callback: fs_OperationCallback,\n): fs_OperationId {\n    const id: fs_OperationId = _fs_createOperationId()\n    const buffers: Array<buf_SoundBuffer> = []\n    for (let channel = 0; channel < soundInfo.channelCount; channel++) {\n        buffers.push(new buf_SoundBuffer(_FS_SOUND_BUFFER_LENGTH))\n    }\n    _FS_SOUND_STREAM_BUFFERS.set(id, buffers)\n    _FS_OPERATIONS_CALLBACKS.set(id, callback)\n    i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))\n    return id\n}\n\nfunction fs_openSoundWriteStream(\n    url: Url, \n    soundInfo: fs_SoundInfo,\n    callback: fs_OperationCallback,\n): fs_OperationId {\n    const id: fs_OperationId = _fs_createOperationId()\n    _FS_SOUND_STREAM_BUFFERS.set(id, [])\n    _FS_OPERATIONS_CALLBACKS.set(id, callback)\n    i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))\n    return id\n}\n\nfunction fs_sendSoundStreamData(\n    id: fs_OperationId, \n    block: FloatArray[],\n): void {\n    _fs_assertOperationExists(id, 'fs_sendSoundStreamData')\n    i_fs_sendSoundStreamData(id, block)\n}\n\nfunction fs_closeSoundStream (\n    id: fs_OperationId, \n    status: fs_OperationStatus\n): void {\n    if (!_FS_OPERATIONS_IDS.has(id)) {\n        return\n    }\n    _FS_OPERATIONS_IDS.delete(id)\n    _FS_OPERATIONS_CALLBACKS.get(id)(id, status)\n    _FS_OPERATIONS_CALLBACKS.delete(id)\n    // Delete this last, to give the callback \n    // a chance to save a reference to the buffer\n    // If write stream, there won't be a buffer\n    if (_FS_SOUND_STREAM_BUFFERS.has(id)) {\n        _FS_SOUND_STREAM_BUFFERS.delete(id)\n    }\n    i_fs_closeSoundStream(id, status)\n}\n\nfunction fs_soundInfoToMessage(soundInfo: fs_SoundInfo): Message {\n    const info: Message = msg_create([\n        MSG_FLOAT_TOKEN,\n        MSG_FLOAT_TOKEN,\n        MSG_FLOAT_TOKEN,\n        MSG_STRING_TOKEN,\n        soundInfo.encodingFormat.length,\n        MSG_STRING_TOKEN,\n        soundInfo.endianness.length,\n        MSG_STRING_TOKEN,\n        soundInfo.extraOptions.length\n    ])\n    msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))\n    msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))\n    msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))\n    msg_writeStringToken(info, 3, soundInfo.encodingFormat)\n    msg_writeStringToken(info, 4, soundInfo.endianness)\n    msg_writeStringToken(info, 5, soundInfo.extraOptions)\n    return info\n}\n\n// =========================== PRIVATE\nfunction _fs_createOperationId(): fs_OperationId {\n    const id: fs_OperationId = _FS_OPERATION_COUNTER++\n    _FS_OPERATIONS_IDS.add(id)\n    return id\n}\n\nfunction _fs_assertOperationExists(\n    id: fs_OperationId,\n    operationName: string,\n): void {\n    if (!_FS_OPERATIONS_IDS.has(id)) {\n        throw new Error(operationName + ' operation unknown : ' + id.toString())\n    }\n}";

  var generateCoreCodeAsc = (bitDepth) => {
      return (replaceCoreCodePlaceholders(bitDepth, CORE_ASC) +
          BUF_ASC +
          SKED_ASC +
          COMMONS_ASC +
          MSG_ASC +
          FS_ASC);
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  var compileToAssemblyscript = (compilation) => {
      const { audioSettings, inletCallerSpecs, codeVariableNames } = compilation;
      const { channelCount } = audioSettings;
      const globs = compilation.codeVariableNames.globs;
      const metadata = buildMetadata(compilation);
      // prettier-ignore
      return renderCode$1 `
        ${generateCoreCodeAsc(audioSettings.bitDepth)}

        ${compileDeclare(compilation)}

        ${compileInletCallers(compilation)}
        
        ${compileOutletListeners(compilation, (variableName) => `
            export declare function ${variableName}(m: Message): void
        `)}

        const metadata: string = '${JSON.stringify(metadata)}'
        let ${globs.input}: FloatArray = createFloatArray(0)
        let ${globs.output}: FloatArray = createFloatArray(0)
        
        export function configure(sampleRate: Float, blockSize: Int): void {
            ${globs.input} = createFloatArray(blockSize * ${channelCount.in.toString()})
            ${globs.output} = createFloatArray(blockSize * ${channelCount.out.toString()})
            ${globs.sampleRate} = sampleRate
            ${globs.blockSize} = blockSize
            _commons_emitEngineConfigure()
        }

        export function getInput(): FloatArray { return ${globs.input} }

        export function getOutput(): FloatArray { return ${globs.output} }

        export function loop(): void {
            ${compileLoop(compilation)}
        }

        // FS IMPORTS
        export declare function i_fs_readSoundFile (id: fs_OperationId, url: Url, info: Message): void
        export declare function i_fs_writeSoundFile (id: fs_OperationId, sound: FloatArray[], url: Url, info: Message): void
        export declare function i_fs_openSoundReadStream (id: fs_OperationId, url: Url, info: Message): void
        export declare function i_fs_openSoundWriteStream (id: fs_OperationId, url: Url, info: Message): void
        export declare function i_fs_sendSoundStreamData (id: fs_OperationId, block: FloatArray[]): void
        export declare function i_fs_closeSoundStream (id: fs_OperationId, status: fs_OperationStatus): void

        export {
            metadata,

            // FS EXPORTS
            x_fs_onReadSoundFileResponse as fs_onReadSoundFileResponse,
            x_fs_onWriteSoundFileResponse as fs_onWriteSoundFileResponse,
            x_fs_onSoundStreamData as fs_onSoundStreamData,
            x_fs_onCloseSoundStream as fs_onCloseSoundStream,

            // MSG EXPORTS
            x_msg_create as msg_create,
            x_msg_getTokenTypes as msg_getTokenTypes,
            x_msg_createTemplate as msg_createTemplate,
            msg_writeStringToken,
            msg_writeFloatToken,
            msg_readStringToken,
            msg_readFloatToken,
            MSG_FLOAT_TOKEN,
            MSG_STRING_TOKEN,

            // COMMONS EXPORTS
            commons_setArray,
            commons_getArray, 

            // CORE EXPORTS
            createFloatArray,
            x_core_createListOfArrays as core_createListOfArrays,
            x_core_pushToListOfArrays as core_pushToListOfArrays,
            x_core_getListOfArraysLength as core_getListOfArraysLength,
            x_core_getListOfArraysElem as core_getListOfArraysElem,

            // INLET CALLERS
            ${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => inletIds.map(inletId => codeVariableNames.inletCallers[nodeId][inletId] + ','))}
        }
    `;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * Generates the whole set of variable names for a compilation for a given graph.
   *
   * @param nodeImplementations
   * @param graph
   * @returns
   */
  const generate = (nodeImplementations, graph, debug) => ({
      nodes: createNamespace('n', Object.values(graph).reduce((nodeMap, node) => {
          const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
          const namespaceLabel = `[${node.type}] ${node.id}`;
          const prefix = debug
              ? _v(`${node.type.replace(/[^a-zA-Z0-9_]/g, '')}_${node.id}`)
              : _v(node.id);
          nodeMap[node.id] = {
              ins: createNamespaceFromPortlets(`${namespaceLabel}.ins`, node.inlets, 'signal', (inlet) => `${prefix}_INS_${_v(inlet.id)}`),
              rcvs: createNamespaceFromPortlets(`${namespaceLabel}.rcvs`, node.inlets, 'message', (inlet) => `${prefix}_RCVS_${_v(inlet.id)}`),
              outs: createNamespaceFromPortlets(`${namespaceLabel}.outs`, node.outlets, 'signal', (outlet) => `${prefix}_OUTS_${_v(outlet.id)}`),
              snds: createNamespaceFromPortlets(`${namespaceLabel}.snds`, node.outlets, 'message', (outlet) => `${prefix}_SNDS_${_v(outlet.id)}`),
              state: createNamespace(`${namespaceLabel}.state`, mapObject(nodeImplementation.stateVariables, (_, stateVariable) => `${prefix}_STATE_${_v(stateVariable)}`)),
          };
          return nodeMap;
      }, {})),
      globs: createNamespace('g', {
          iterFrame: 'F',
          frame: 'FRAME',
          blockSize: 'BLOCK_SIZE',
          sampleRate: 'SAMPLE_RATE',
          output: 'OUTPUT',
          input: 'INPUT',
          nullMessageReceiver: 'SND_TO_NULL',
          // TODO : not a glob
          m: 'm',
      }),
      outletListeners: createNamespace('outletListeners', {}),
      inletCallers: createNamespace('inletCallers', {}),
  });
  /**
   * Helper that attaches to the generated `codeVariableNames` the names of specified outlet listeners.
   *
   * @param codeVariableNames
   * @param outletListenerSpecs
   */
  const attachOutletListeners = (codeVariableNames, outletListenerSpecs) => {
      Object.entries(outletListenerSpecs).forEach(([nodeId, outletIds]) => {
          codeVariableNames.outletListeners[nodeId] = {};
          outletIds.forEach((outletId) => {
              codeVariableNames.outletListeners[nodeId][outletId] = `outletListener_${nodeId}_${outletId}`;
          });
      });
  };
  /**
   * Helper that attaches to the generated `codeVariableNames` the names of specified inlet callers.
   *
   * @param codeVariableNames
   * @param inletCallerSpecs
   */
  const attachInletCallers = (codeVariableNames, inletCallerSpecs) => {
      Object.entries(inletCallerSpecs).forEach(([nodeId, inletIds]) => {
          codeVariableNames.inletCallers[nodeId] = {};
          inletIds.forEach((inletId) => {
              codeVariableNames.inletCallers[nodeId][inletId] = `inletCaller_${nodeId}_${inletId}`;
          });
      });
  };
  /**
   * Helper to generate VariableNames, essentially a proxy object that throws an error
   * when trying to access undefined properties.
   *
   * @param namespace
   * @returns
   */
  const createNamespace = (label, namespace) => {
      return new Proxy(namespace, {
          get: (target, k) => {
              const key = String(k);
              if (!target.hasOwnProperty(key)) {
                  if (key[0] === '$' && target.hasOwnProperty(key.slice(1))) {
                      return target[key.slice(1)];
                  }
                  // Whitelist some fields that are undefined but accessed at
                  // some point or another by our code.
                  if ([
                      'toJSON',
                      'Symbol(Symbol.toStringTag)',
                      'constructor',
                      '$$typeof',
                      '@@__IMMUTABLE_ITERABLE__@@',
                      '@@__IMMUTABLE_RECORD__@@',
                  ].includes(key)) {
                      return undefined;
                  }
                  throw new Error(`Namespace "${label}" doesn't know key "${String(key)}"`);
              }
              return target[key];
          },
      });
  };
  const assertValidNamePart = (namePart) => {
      const isInvalid = !VALID_NAME_PART_REGEXP.exec(namePart);
      if (isInvalid) {
          throw new Error(`Invalid variable name for code generation "${namePart}"`);
      }
      return namePart;
  };
  const _v = assertValidNamePart;
  const VALID_NAME_PART_REGEXP = /^[a-zA-Z0-9_]+$/;
  const createNamespaceFromPortlets = (label, portletMap, portletType, mapFunction) => createNamespace(label, mapArray$1(Object.values(portletMap).filter((portlet) => portlet.type === portletType), (portlet) => [portlet.id, mapFunction(portlet)]));

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  var compile = (graph, nodeImplementations, compilerSettings) => {
      const { audioSettings, inletCallerSpecs, outletListenerSpecs, target, debug, } = validateSettings(compilerSettings);
      const macros = getMacros(target);
      const codeVariableNames = generate(nodeImplementations, graph, debug);
      attachInletCallers(codeVariableNames, inletCallerSpecs);
      attachOutletListeners(codeVariableNames, outletListenerSpecs);
      const graphTraversal = graphTraversalForCompile(graph, inletCallerSpecs);
      trimGraph(graph, graphTraversal);
      return executeCompilation({
          target,
          graph,
          graphTraversal,
          nodeImplementations,
          audioSettings,
          inletCallerSpecs,
          outletListenerSpecs,
          codeVariableNames,
          macros,
          debug,
          precompiledPortlets: {
              precompiledInlets: {},
              precompiledOutlets: {},
          },
      });
  };
  /** Asserts settings are valid (or throws error) and sets default values. */
  const validateSettings = (settings) => {
      const inletCallerSpecs = settings.inletCallerSpecs || {};
      const outletListenerSpecs = settings.outletListenerSpecs || {};
      const debug = settings.debug || false;
      if (![32, 64].includes(settings.audioSettings.bitDepth)) {
          throw new InvalidSettingsError(`"bitDepth" can be only 32 or 64`);
      }
      return {
          ...settings,
          outletListenerSpecs,
          inletCallerSpecs,
          debug,
      };
  };
  /** Helper to get code macros from compile target. */
  const getMacros = (target) => ({ javascript: macros$1, assemblyscript: macros }[target]);
  /** Helper to execute compilation */
  const executeCompilation = (compilation) => {
      preCompileSignalAndMessageFlow(compilation);
      if (compilation.target === 'javascript') {
          return compileToJavascript(compilation);
      }
      else if (compilation.target === 'assemblyscript') {
          return compileToAssemblyscript(compilation);
      }
      else {
          throw new Error(`Invalid compilation.target ${compilation.target}`);
      }
  };
  class InvalidSettingsError extends Error {
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  /**
   * Renders templated strings which contain nested arrays of strings.
   * This helper allows to use functions such as `.map` to generate several lines
   * of code, without having to use `.join('\n')`.
   */
  const renderCode = (strings, ...codeLines) => {
      let rendered = '';
      for (let i = 0; i < strings.length; i++) {
          rendered += strings[i];
          if (codeLines[i]) {
              rendered += _renderCodeRecursive(codeLines[i]);
          }
      }
      return rendered;
  };
  const _renderCodeRecursive = (codeLines) => {
      if (Array.isArray(codeLines)) {
          return codeLines
              .map(_renderCodeRecursive)
              .filter((line) => line.length)
              .join('\n');
      }
      return codeLines.toString();
  };
  /** Generate an integer series from 0 to `count`. */
  const countTo = (count) => {
      const results = [];
      for (let i = 0; i < count; i++) {
          results.push(i);
      }
      return results;
  };
  /**
   * @param func Called for each element in `src`. Returns a pair `[<key>, <value>]`.
   * @returns A new object whoses keys and values are the result of
   * applying `func` to each element in `src`.
   */
  const mapArray = (src, func) => {
      const dest = {};
      src.forEach((srcValue, i) => {
          const [key, destValue] = func(srcValue, i);
          dest[key] = destValue;
      });
      return dest;
  };
  /**
   * Renders one of several alternative bits of code.
   *
   * @param routes A list of alternatives `[<test>, <code>]`
   * @returns The first `code` whose `test` evaluated to true.
   */
  const renderSwitch = (...routes) => {
      const route = routes.find(([test]) => test);
      if (!route) {
          throw new Error(`no route found`);
      }
      return route[1];
  };
  /** Renders `code` only if `test` is truthy. */
  const renderIf = (test, code) => {
      if (!test) {
          return '';
      }
      if (typeof code === 'function') {
          return code();
      }
      else {
          return code;
      }
  };

  var IdNamespaces;
  (function (IdNamespaces) {
      IdNamespaces["PD"] = "n";
      IdNamespaces["MIXER"] = "m";
  })(IdNamespaces || (IdNamespaces = {}));

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const assertNumber = (value) => {
      if (typeof value !== 'number') {
          throw new ValidationError(`${value} is not a number`);
      }
      return value;
  };
  const assertString = (value) => {
      if (typeof value !== 'string') {
          throw new ValidationError(`${value} is not a string`);
      }
      return value;
  };
  const assertOptionalNumber = (value) => {
      return value !== undefined ? assertNumber(value) : undefined;
  };
  const assertOptionalString = (value) => {
      return value !== undefined ? assertString(value) : undefined;
  };
  class ValidationError extends Error {
  }

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$C = {};
  // TODO : set message not supported
  // ------------------------------- node builder ------------------------------ //
  const builder$y = {
      translateArgs: (pdNode, patch) => {
          let channelMapping;
          if (pdNode.args.length) {
              // Channels are provided as 1-indexed, so we translate them back to 0-indexed.
              channelMapping = pdNode.args.map((channel) => assertNumber(channel) - 1);
          }
          else {
              // If no channel is provided, since a patch doesn't contain the channel count info,
              // we just guess the `channelMapping` according to inlets that are defined on the dac.
              const dacInletIds = new Set();
              patch.connections.forEach((connection) => {
                  if (connection.sink.nodeId === pdNode.id) {
                      dacInletIds.add(connection.sink.portletId);
                  }
              });
              const maxInlet = Math.max(...dacInletIds);
              channelMapping = [];
              for (let channel = 0; channel <= maxInlet; channel++) {
                  channelMapping.push(channel);
              }
          }
          return { channelMapping };
      },
      build: (nodeArgs) => ({
          inlets: mapArray(nodeArgs.channelMapping, (_, i) => [`${i}`, { type: 'signal', id: `${i}` }]),
          outlets: {},
          isPullingSignal: true,
      }),
  };
  // ------------------------------- loop ------------------------------ //
  const loop$j = ({ ins, globs, node, compilation: { audioSettings, target }, }) => node.args.channelMapping
      // Save the original index
      .map((destination, i) => [destination, i])
      // Ignore channels that are out of bounds
      .filter(([destination]) => 0 <= destination && destination < audioSettings.channelCount.out)
      .map(([destination, i]) => target === 'javascript'
      ? `${globs.output}[${destination}][${globs.iterFrame}] = ${ins[`${i}`]}`
      : `${globs.output}[${globs.iterFrame} + ${globs.blockSize} * ${destination}] = ${ins[`${i}`]}`)
      .join('\n') + '\n';
  // ------------------------------------------------------------------- //
  const nodeImplementation$s = { loop: loop$j, stateVariables: stateVariables$C };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$B = {};
  // TODO : set message not supported
  // ------------------------------- node builder ------------------------------ //
  const builder$x = {
      translateArgs: (pdNode, patch) => {
          let channelMapping;
          if (pdNode.args.length) {
              // Channels are provided as 1-indexed, so we translate them back to 0-indexed.
              channelMapping = pdNode.args.map((channel) => assertNumber(channel) - 1);
          }
          else {
              // If no channel is provided, since a patch doesn't contain the channel count info,
              // we just guess the `channelMapping` according to inlets that are defined on the dac.
              const adcOutletIds = new Set();
              patch.connections.forEach((connection) => {
                  if (connection.source.nodeId === pdNode.id) {
                      adcOutletIds.add(connection.source.portletId);
                  }
              });
              const maxOutlet = Math.max(...adcOutletIds);
              channelMapping = [];
              for (let channel = 0; channel <= maxOutlet; channel++) {
                  channelMapping.push(channel);
              }
          }
          return { channelMapping };
      },
      build: (nodeArgs) => ({
          inlets: {},
          outlets: mapArray(nodeArgs.channelMapping, (_, i) => [`${i}`, { type: 'signal', id: `${i}` }]),
      }),
  };
  // ------------------------------- loop ------------------------------ //
  const loop$i = ({ outs, globs, node, compilation: { audioSettings, target }, }) => node.args.channelMapping
      // Save the original index 
      .map((source, i) => [source, i])
      // Ignore channels that are out of bounds
      .filter(([source]) => 0 <= source && source < audioSettings.channelCount.in)
      .map(([source, i]) => target === 'javascript'
      ? `${outs[`${i}`]} = ${globs.input}[${source}][${globs.iterFrame}]`
      : `${outs[`${i}`]} = ${globs.input}[${globs.iterFrame} + ${globs.blockSize} * ${source}]`)
      .join('\n') + '\n';
  // ------------------------------------------------------------------- //
  const nodeImplementation$r = { loop: loop$i, stateVariables: stateVariables$B };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const coldFloatInlet = (messageName, storageName) => {
      return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${storageName} = msg_readFloatToken(${messageName}, 0)
        return
    }`;
  };
  const coldFloatInletWithSetter = (messageName, setterName) => {
      return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${setterName}(msg_readFloatToken(${messageName}, 0))
        return
    }`;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$A = {
      phase: 1,
      frequency: 1,
      J: 1,
      K: 1,
      funcSetFrequency: 1,
      funcSetPhase: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$w = {
      translateArgs: (pdNode) => ({
          frequency: assertOptionalNumber(pdNode.args[0]) || 0,
      }),
      build: () => ({
          inlets: {
              '0_message': { type: 'message', id: '0_message' },
              '0': { type: 'signal', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  const makeNodeImplementation$7 = ({ coeff, generateOperation, }) => {
      // ------------------------------ declare ------------------------------ //
      const declare = (context) => {
          const { state, macros: { Var, Func } } = context;
          return (_hasSignalInput$3(context.node)
              ? declareSignal(context)
              : declareMessage(context)) + `
                const ${state.funcSetPhase} = ${Func([
            Var('phase', 'Float')
        ], 'void')} => {${state.phase} = phase % 1.0${coeff ? ` * ${coeff}` : ''}}
            `;
      };
      const declareSignal = ({ state, globs, macros: { Var }, }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.J, 'Float')}

        commons_waitEngineConfigure(() => {
            ${state.J} = ${coeff ? `${coeff}` : '1'} / ${globs.sampleRate}
        })
    `;
      const declareMessage = ({ state, globs, node: { args }, macros: { Func, Var }, }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.frequency, 'Float')} = ${args.frequency}
        let ${Var(state.K, 'Float')} = 0

        const ${state.funcSetFrequency} = ${Func([
        Var('frequency', 'Float')
    ], 'void')} => {
            ${state.frequency} = frequency
            ${state.K} = ${coeff ? `${coeff} * ` : ''}${state.frequency} / ${globs.sampleRate}
        }

        commons_waitEngineConfigure(() => {
            ${state.funcSetFrequency}(${state.frequency})
        })
    `;
      // ------------------------------- loop ------------------------------ //
      const loop = (context) => _hasSignalInput$3(context.node)
          ? loopSignal(context)
          : loopMessage(context);
      const loopSignal = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += (${state.J} * ${ins.$0})
    `;
      // Take only the last received frequency message (first in the list)
      const loopMessage = ({ state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += ${state.K}
    `;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ globs, state }) => ({
          '0_message': coldFloatInletWithSetter(globs.m, state.funcSetFrequency),
          '1': coldFloatInletWithSetter(globs.m, state.funcSetPhase),
      });
      return {
          declare,
          messages,
          loop,
          stateVariables: stateVariables$A,
      };
  };
  // ------------------------------------------------------------------- //
  const _hasSignalInput$3 = (node) => node.sources['0'] && node.sources['0'].length;
  const nodeImplementations$9 = {
      'osc~': makeNodeImplementation$7({
          coeff: '2 * Math.PI',
          generateOperation: (phase) => `Math.cos(${phase})`
      }),
      'phasor~': makeNodeImplementation$7({
          generateOperation: (phase) => `${phase} % 1`
      }),
  };
  const builders$9 = {
      'osc~': builder$w,
      'phasor~': builder$w,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$z = {
      minValue: 1,
      maxValue: 1,
      inputValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$v = {
      translateArgs: ({ args }) => ({
          minValue: assertOptionalNumber(args[0]) || 0,
          maxValue: assertOptionalNumber(args[1]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
              '1': { type: 'message', id: '1' },
              '2': { type: 'message', id: '2' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------- declare ------------------------------ //
  const declare$l = ({ node: { args }, state, macros: { Var } }) => `
    let ${Var(state.inputValue, 'Float')} = 0
    let ${Var(state.minValue, 'Float')} = ${args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${args.maxValue}
`;
  // ------------------------------- loop ------------------------------ //
  const loop$h = ({ ins, outs, state, node }) => `
    ${outs.$0} = Math.max(Math.min(${state.maxValue}, ${_hasSignalInput$2(node) ? ins.$0 : state.inputValue}), ${state.minValue})
`;
  // ------------------------------- messages ------------------------------ //
  const messages$o = ({ state, globs }) => ({
      '0_message': coldFloatInlet(globs.m, state.inputValue),
      '1': coldFloatInlet(globs.m, state.minValue),
      '2': coldFloatInlet(globs.m, state.maxValue),
  });
  // ------------------------------------------------------------------- //
  const _hasSignalInput$2 = (node) => node.sources['0'] && node.sources['0'].length;
  const nodeImplementation$q = {
      loop: loop$h,
      stateVariables: stateVariables$z,
      messages: messages$o,
      declare: declare$l,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$y = {
      currentValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$u = {
      translateArgs: ({ args }) => ({
          initValue: assertOptionalNumber(args[0]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$k = ({ node: { args }, state, macros: { Var } }) => `
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
`;
  // ------------------------------- loop ------------------------------ //
  const loop$g = ({ ins, outs, state }) => `
    ${outs.$0} = ${state.currentValue}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$n = ({ state, globs }) => ({
      '0': coldFloatInlet(globs.m, state.currentValue),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$p = {
      loop: loop$g,
      stateVariables: stateVariables$y,
      messages: messages$n,
      declare: declare$k,
  };

  const bangUtils = ({ macros: { Func, Var } }) => `
    function msg_isBang ${Func([
    Var('message', 'Message'),
], 'boolean')} {
        return (
            msg_isStringToken(message, 0) 
            && msg_readStringToken(message, 0) === 'bang'
        )
    }

    function msg_bang ${Func([], 'Message')} {
        const ${Var('message', 'Message')} = msg_create([MSG_STRING_TOKEN, 4])
        msg_writeStringToken(message, 0, 'bang')
        return message
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$x = {
      currentValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$t = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
          isPullingSignal: true,
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------- declare ------------------------------ //
  const declare$j = ({ state, macros: { Var } }) => `
    let ${Var(state.currentValue, 'Float')} = 0
`;
  // ------------------------------- loop ------------------------------ //
  const loop$f = ({ ins, state }) => `
    ${state.currentValue} = ${ins.$0}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$m = ({ state, globs, snds }) => ({
      '0_message': `
        if (msg_isBang(${globs.m})) {
            ${snds.$0}(msg_floats([${state.currentValue}]))
            return 
        }
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$o = {
      loop: loop$f,
      stateVariables: stateVariables$x,
      messages: messages$m,
      declare: declare$j,
      sharedCode: [bangUtils]
  };

  const point = ({ macros: { Var } }) => `
    class Point {
        ${Var('x', 'Float')}
        ${Var('y', 'Float')}
    }
`;
  const interpolateLin = [point, ({ macros: { Var, Func } }) => `
    function interpolateLin ${Func([
        Var('x', 'Float'),
        Var('p0', 'Point'),
        Var('p1', 'Point'),
    ], 'Float')} {
        return p0.y + (x - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
    }
`];

  // TODO : unit tests
  const linesUtils = [...interpolateLin, ({ macros: { Var, Func } }) => `

    class LineSegment {
        ${Var('p0', 'Point')}
        ${Var('p1', 'Point')}
        ${Var('slope', 'Float')}
    }

    function removePointsBeforeFrame ${Func([
        Var('points', 'Array<Point>'),
        Var('frame', 'Float'),
    ], 'Array<Point>')} {
        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        while (i < points.length) {
            if (frame <= points[i].x) {
                newPoints.push(points[i])
            }
            i++
        }
        return newPoints
    }

    function insertNewLinePoints ${Func([
        Var('points', 'Array<Point>'),
        Var('p0', 'Point'),
        Var('p1', 'Point'),
    ], 'Array<Point>')} {
        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        
        // Keep the points that are before the new points added
        while (i < points.length && points[i].x <= p0.x) {
            newPoints.push(points[i])
            i++
        }
        
        // Find the start value of the start point :
        
        // 1. If there is a previous point and that previous point
        // is on the same frame, we don't modify the start point value.
        // (represents a vertical line).
        if (0 < i - 1 && points[i - 1].x === p0.x) {

        // 2. If new points are inserted in between already existing points 
        // we need to interpolate the existing line to find the startValue.
        } else if (0 < i && i < points.length) {
            newPoints.push({
                x: p0.x,
                y: interpolateLin(p0.x, points[i - 1], points[i])
            })

        // 3. If new line is inserted after all existing points, 
        // we just take the value of the last point
        } else if (i >= points.length && points.length) {
            newPoints.push({
                x: p0.x,
                y: points[points.length - 1].y,
            })

        // 4. If new line placed in first position, we take the defaultStartValue.
        } else if (i === 0) {
            newPoints.push({
                x: p0.x,
                y: p0.y,
            })
        }
        
        newPoints.push({
            x: p1.x,
            y: p1.y,
        })
        return newPoints
    }

    function computeFrameAjustedPoints ${Func([
        Var('points', 'Array<Point>'),
    ], 'Array<Point>')} {
        if (points.length < 2) {
            throw new Error('invalid length for points')
        }

        const ${Var('newPoints', 'Array<Point>')} = []
        let ${Var('i', 'Int')} = 0
        let ${Var('p', 'Point')} = points[0]
        let ${Var('frameLower', 'Float')} = 0
        let ${Var('frameUpper', 'Float')} = 0
        
        while(i < points.length) {
            p = points[i]
            frameLower = Math.floor(p.x)
            frameUpper = frameLower + 1

            // I. Placing interpolated point at the lower bound of the current frame
            // ------------------------------------------------------------------------
            // 1. Point is already on an exact frame,
            if (p.x === frameLower) {
                newPoints.push({ x: p.x, y: p.y })

                // 1.a. if several of the next points are also on the same X,
                // we find the last one to draw a vertical line.
                while (
                    (i + 1) < points.length
                    && points[i + 1].x === frameLower
                ) {
                    i++
                }
                if (points[i].y !== newPoints[newPoints.length - 1].y) {
                    newPoints.push({ x: points[i].x, y: points[i].y })
                }

                // 1.b. if last point, we quit
                if (i + 1 >= points.length) {
                    break
                }

                // 1.c. if next point is in a different frame we can move on to next iteration
                if (frameUpper <= points[i + 1].x) {
                    i++
                    continue
                }
            
            // 2. Point isn't on an exact frame
            // 2.a. There's a previous point, the we use it to interpolate the value.
            } else if (newPoints.length) {
                newPoints.push({
                    x: frameLower,
                    y: interpolateLin(frameLower, points[i - 1], p),
                })
            
            // 2.b. It's the very first point, then we don't change its value.
            } else {
                newPoints.push({ x: frameLower, y: p.y })
            }

            // II. Placing interpolated point at the upper bound of the current frame
            // ---------------------------------------------------------------------------
            // First, we find the closest point from the frame upper bound (could be the same p).
            // Or could be a point that is exactly placed on frameUpper.
            while (
                (i + 1) < points.length 
                && (
                    Math.ceil(points[i + 1].x) === frameUpper
                    || Math.floor(points[i + 1].x) === frameUpper
                )
            ) {
                i++
            }
            p = points[i]

            // 1. If the next point is directly in the next frame, 
            // we do nothing, as this corresponds with next iteration frameLower.
            if (Math.floor(p.x) === frameUpper) {
                continue
            
            // 2. If there's still a point after p, we use it to interpolate the value
            } else if (i < points.length - 1) {
                newPoints.push({
                    x: frameUpper,
                    y: interpolateLin(frameUpper, p, points[i + 1]),
                })

            // 3. If it's the last point, we dont change the value
            } else {
                newPoints.push({ x: frameUpper, y: p.y })
            }

            i++
        }

        return newPoints
    }

    function computeLineSegments ${Func([
        Var('points', 'Array<Point>'),
    ], 'Array<LineSegment>')} {
        const ${Var('lineSegments', 'Array<LineSegment>')} = []
        let ${Var('i', 'Int')} = 0
        let ${Var('p0', 'Point')}
        let ${Var('p1', 'Point')}

        while(i < points.length - 1) {
            p0 = points[i]
            p1 = points[i + 1]
            lineSegments.push({
                p0, p1, slope: p1.x !== p0.x ? (p1.y - p0.y) / (p1.x - p0.x) : 0
            })
            i++
        }
        return lineSegments
    }

`];

  // TODO : unit testing
  // TODO : amount = 0 ?
  // TODO : missing persec and all per...
  const computeUnitInSamples = ({ macros: { Func, Var } }) => `
    function computeUnitInSamples ${Func([
    Var('sampleRate', 'Float'),
    Var('amount', 'Float'),
    Var('unit', 'string'),
], 'Float')} {
        if (unit === 'msec' || unit === 'millisecond') {
            return amount / 1000 * sampleRate
        } else if (unit === 'sec' || unit === 'seconds' || unit === 'second') {
            return amount * sampleRate
        } else if (unit === 'min' || unit === 'minutes' || unit === 'minute') {
            return amount * 60 * sampleRate
        } else if (unit === 'samp' || unit === 'samples' || unit === 'sample') {
            return amount
        } else {
            throw new Error("invalid time unit : " + unit)
        }
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$w = {
      points: 1,
      lineSegments: 1,
      currentValue: 1,
      nextDurationSamp: 1,
      nextDelaySamp: 1,
      funcSetNewLine: 1,
      funcSetNextDuration: 1,
      funcSetNextDelay: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$s = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
              '2': { type: 'message', id: '2' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$i = ({ globs, state, macros: { Var, Func } }) => `
    let ${Var(state.points, 'Array<Point>')} = []
    let ${Var(state.lineSegments, 'Array<LineSegment>')} = []
    let ${Var(state.currentValue, 'Float')} = 0
    let ${Var(state.nextDurationSamp, 'Float')} = 0
    let ${Var(state.nextDelaySamp, 'Float')} = 0

    function ${state.funcSetNewLine} ${Func([
    Var('targetValue', 'Float'),
], 'void')} {
        ${state.points} = removePointsBeforeFrame(${state.points}, toFloat(${globs.frame}))
        const ${Var('startFrame', 'Float')} = toFloat(${globs.frame}) + ${state.nextDelaySamp}
        ${state.points} = insertNewLinePoints(
            ${state.points}, 
            {x: startFrame, y: ${state.currentValue}},
            {x: startFrame + ${state.nextDurationSamp}, y: targetValue}
        )
        ${state.lineSegments} = computeLineSegments(
            computeFrameAjustedPoints(${state.points}))
        ${state.nextDurationSamp} = 0
        ${state.nextDelaySamp} = 0
    }

    function ${state.funcSetNextDuration} ${Func([
    Var('durationMsec', 'Float'),
], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcSetNextDelay} ${Func([
    Var('delayMsec', 'Float'),
], 'void')} {
        ${state.nextDelaySamp} = computeUnitInSamples(${globs.sampleRate}, delayMsec, 'msec')
    }
`;
  // ------------------------------- loop ------------------------------ //
  const loop$e = ({ outs, state, globs }) => `
    if (${state.lineSegments}.length) {
        if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p0.x) {

        // This should come first to handle vertical lines
        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p1.y
            ${state.lineSegments}.shift()
            
        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p0.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p0.y

        } else if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} += ${state.lineSegments}[0].slope

        }
    }
    ${outs.$0} = ${state.currentValue}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$l = ({ state, globs }) => ({
      '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        switch (msg_getLength(${globs.m})) {
            case 3:
                ${state.funcSetNextDelay}(msg_readFloatToken(${globs.m}, 2))
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                ${state.funcSetNewLine}(msg_readFloatToken(${globs.m}, 0))
        }
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'stop'
    ) {
        ${state.points} = []
        ${state.lineSegments} = []
        return
    }
    `,
      '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
      '2': coldFloatInletWithSetter(globs.m, state.funcSetNextDelay),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$n = {
      loop: loop$e,
      stateVariables: stateVariables$w,
      messages: messages$l,
      declare: declare$i,
      sharedCode: [...linesUtils, computeUnitInSamples]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$v = {};
  // ------------------------------- node builder ------------------------------ //
  const builder$r = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  // ------------------------------- loop ------------------------------ //
  const makeNodeImplementation$6 = ({ generateOperation, }) => {
      const loop = ({ ins, outs }) => `
        ${outs.$0} = ${generateOperation(ins.$0)}
    `;
      return { loop, stateVariables: stateVariables$v };
  };
  // ------------------------------------------------------------------- //
  const nodeImplementations$8 = {
      'abs~': makeNodeImplementation$6({ generateOperation: (input) => `Math.abs(${input})` }),
      'cos~': makeNodeImplementation$6({ generateOperation: (input) => `Math.cos(${input} * 2 * Math.PI)` }),
  };
  const builders$8 = {
      'abs~': builder$r,
      'cos~': builder$r,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  // Regular expressions to deal with dollar-args
  const DOLLAR_VAR_REGEXP_GLOB = /\$(\d+)/g;
  // Takes an object string arg which might contain dollars, and returns the resolved version.
  // e.g. :
  // [table $0-ARRAY] inside a patch with ID 1887 would resolve to [table 1887-ARRAY]
  const resolveDollarArg = (arg, patch) => {
      const patchArgs = [patch.id, ...patch.args.map((arg) => arg.toString())];
      let matchDollar;
      while ((matchDollar = DOLLAR_VAR_REGEXP_GLOB.exec(arg))) {
          const patchInd = parseInt(matchDollar[1], 10);
          if (patchInd >= patchArgs.length || patchInd < 0) {
              throw new Error('$' + (patchInd + 1) + ': argument number out of range');
          }
          arg = arg.replace(matchDollar[0], patchArgs[patchInd]);
      }
      return arg;
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$u = {
      array: 1,
      arrayName: 1,
      arrayChangesSubscription: 1,
      readPosition: 1,
      readUntil: 1,
      funcSetArrayName: 1,
      funcPlay: 1,
  };
  // TODO : Should work also if array was set the play started
  // ------------------------------- node builder ------------------------------ //
  const builder$q = {
      translateArgs: (pdNode, patch) => ({
          arrayName: resolveDollarArg(pdNode.args[0].toString(), patch),
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
              '1': { type: 'message', id: '1' },
          },
      }),
  };
  // ------------------------------ declare ------------------------------ //
  const declare$h = ({ state, node, macros: { Func, Var } }) => `
    let ${Var(state.array, 'FloatArray')} = createFloatArray(0)
    let ${Var(state.arrayName, 'string')} = "${node.args.arrayName}"
    let ${Var(state.arrayChangesSubscription, 'SkedId')} = SKED_ID_NULL
    let ${Var(state.readPosition, 'Int')} = 0
    let ${Var(state.readUntil, 'Int')} = 0

    const ${state.funcSetArrayName} = ${Func([
    Var('arrayName', 'string')
], 'void')} => {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        ${state.readPosition} = 0
        ${state.readUntil} = 0        
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
            ${state.readPosition} = ${state.array}.length
            ${state.readUntil} = ${state.array}.length
        })
    }

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`;
  // ------------------------------- loop ------------------------------ //
  const loop$d = ({ state, snds, outs }) => `
    if (${state.readPosition} < ${state.readUntil}) {
        ${outs.$0} = ${state.array}[${state.readPosition}]
        ${state.readPosition}++
        if (${state.readPosition} >= ${state.readUntil}) {
            ${snds.$1}(msg_bang())
        }
    } else {
        ${outs.$0} = 0
    }
`;
  // ------------------------------- messages ------------------------------ //
  const messages$k = ({ state, globs }) => ({
      '0': `
    if (msg_getLength(${globs.m}) === 1) {
        if (msg_isBang(${globs.m})) {
            ${state.readPosition} = 0
            ${state.readUntil} = ${state.array}.length
            return 

        } else if (msg_isFloatToken(${globs.m}, 0)) {
            ${state.readPosition} = toInt(msg_readFloatToken(${globs.m}, 0))
            ${state.readUntil} = ${state.array}.length
            return 
        }
    
    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))   
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
        ${state.readPosition} = toInt(msg_readFloatToken(${globs.m}, 0))
        ${state.readUntil} = toInt(Math.min(
            toFloat(${state.readPosition}) + msg_readFloatToken(${globs.m}, 1), 
            toFloat(${state.array}.length)
        ))
        return
    }
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$m = {
      declare: declare$h,
      messages: messages$k,
      loop: loop$d,
      stateVariables: stateVariables$u,
      sharedCode: [bangUtils],
  };

  // TODO : support for -raw (see soundfiler help)
  // TODO : find a better way to factorize this code
  // TODO : unit testing
  const parseSoundFileOpenOpts = ({ macros: { Func, Var } }) => `
    function parseSoundFileOpenOpts ${Func([
    Var('m', 'Message'),
    Var('soundInfo', 'fs_SoundInfo'),
], 'Set<Int>')} {
        const ${Var('unhandled', 'Set<Int>')} = new Set()
        let ${Var('i', 'Int')} = 0
        while (i < msg_getLength(m)) {
            if (msg_isStringToken(m, i)) {
                const ${Var('str', 'string')} = msg_readStringToken(m, i)
                if (['-wave', '-aiff', '-caf', '-next', '-ascii'].includes(str)) {
                    soundInfo.encodingFormat = str.slice(1)

                } else if (str === '-raw') {
                    console.log('-raw format not yet supported')
                    i += 4
                    
                } else if (str === '-big') {
                    soundInfo.endianness = 'b'

                } else if (str === '-little') {
                    soundInfo.endianness = 'l'

                } else if (str === '-bytes') {
                    if (i < msg_getLength(m) && msg_isFloatToken(m, i + 1)) {
                        soundInfo.bitDepth = msg_readFloatToken(m, i + 1) * 8
                        i++
                    } else {
                        console.log('failed to parse -bytes <value>')
                    }

                } else if (str === '-rate') {
                    if (i < msg_getLength(m) && msg_isFloatToken(m, i + 1)) {
                        soundInfo.sampleRate = msg_readFloatToken(m, i + 1)
                        i++
                    } else {
                        console.log('failed to parse -rate <value>')
                    }

                } else {
                    unhandled.add(i)
                }
                
            } else {
                unhandled.add(i)
            }
            i++
        }
        return unhandled
    }
`;
  // TODO : unit testing
  const parseReadWriteFsOpts = ({ macros: { Func, Var } }) => `
    function parseReadWriteFsOpts ${Func([
    Var('m', 'Message'),
    Var('soundInfo', 'fs_SoundInfo'),
    Var('unhandledOptions', 'Set<Int>'),
], 'string')} {
        // Remove the "open" token
        unhandledOptions.delete(0)

        let ${Var('url', 'string')} = ''
        let ${Var('urlFound', 'boolean')} = false
        let ${Var('errored', 'boolean')} = false
        let ${Var('i', 'Int')} = 1
        while (i < msg_getLength(m)) {
            if (!unhandledOptions.has(i)) {

            } else if (msg_isStringToken(m, i)) {
                url = msg_readStringToken(m, i)
                urlFound = true

            } else {
                console.log("[writesf/readsf~] invalid option index " + i.toString())
                errored = true
            }
            i++
        }
        if (!urlFound) {
            console.log("[writesf/readsf~] invalid options, file url not found")
            return ''
        }
        if (errored) {
            return ''
        }
        return url
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$t = {
      buffers: 1,
      readingStatus: 1,
      streamOperationId: 1,
      frame: 1,
  };
  // TODO : check the real state machine of readsf
  //      - what happens when start / stopping / start stream ?
  //      - what happens when stream ended and starting again ?
  //      - etc ...
  // TODO : second arg : "buffer channel size" not implemented
  // TODO : implement raw
  // ------------------------------- node builder ------------------------------ //
  const builder$p = {
      translateArgs: (pdNode) => ({
          channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
      }),
      build: (nodeArgs) => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              ...mapArray(countTo(nodeArgs.channelCount), (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]),
              [`${nodeArgs.channelCount}`]: {
                  type: 'message',
                  id: `${nodeArgs.channelCount}`,
              }
          },
      })
  };
  // ------------------------------ declare ------------------------------ //
  const declare$g = ({ macros: { Var }, state, }) => `
    let ${Var(state.buffers, 'Array<buf_SoundBuffer>')} = []
    let ${Var(state.streamOperationId, 'fs_OperationId')} = -1
    let ${Var(state.readingStatus, 'Int')} = 0
`;
  // ------------------------------- loop ------------------------------ //
  const loop$c = ({ state, snds, outs, node: { args: { channelCount }, }, }) => renderCode `
    switch(${state.readingStatus}) {
        case 1: 
            ${countTo(channelCount).map((i) => `${outs[i]} = buf_pullSample(${state.buffers}[${i}])`)}
            break
            
        case 2: 
            ${countTo(channelCount).map((i) => `${outs[i]} = buf_pullSample(${state.buffers}[${i}])`)}
            if (${state.buffers}[0].pullAvailableLength === 0) {
                ${snds[channelCount]}(msg_bang())
                ${state.readingStatus} = 3
            }
            break

        case 3: 
            ${countTo(channelCount).map((i) => `${outs[i]} = 0`)}
            ${state.readingStatus} = 0
            break
    }
`;
  // ------------------------------- messages ------------------------------ //
  const messages$j = ({ node, state, globs, macros: { Var }, }) => ({
      '0': `
    if (msg_getLength(${globs.m}) >= 2) {
        if (msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'open'
        ) {
            if (${state.streamOperationId} !== -1) {
                ${state.readingStatus} = 3
                fs_closeSoundStream(${state.streamOperationId}, FS_OPERATION_SUCCESS)
            }

            const ${Var('soundInfo', 'fs_SoundInfo')} = {
                channelCount: ${node.args.channelCount},
                sampleRate: ${globs.sampleRate},
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }
            const ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
                ${globs.m},
                soundInfo,
            )
            const ${Var('url', 'string')} = parseReadWriteFsOpts(
                ${globs.m},
                soundInfo,
                unhandledOptions
            )
            if (url.length === 0) {
                return
            }
            ${state.streamOperationId} = fs_openSoundReadStream(
                url,
                soundInfo,
                () => {
                    ${state.streamOperationId} = -1
                    if (${state.readingStatus} === 1) {
                        ${state.readingStatus} = 2
                    } else {
                        ${state.readingStatus} = 3
                    }
                }
            )
            ${state.buffers} = _FS_SOUND_STREAM_BUFFERS.get(${state.streamOperationId})
            return
        }

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        if (msg_readFloatToken(${globs.m}, 0) === 0) {
            ${state.readingStatus} = 3
            return

        } else {
            if (${state.streamOperationId} !== -1) {
                ${state.readingStatus} = 1
            } else {
                console.log('[readsf~] start requested without prior open')
            }
            return

        }
    } else if (msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])) {
        const ${Var('action', 'string')} = msg_readStringToken(${globs.m}, 0)

        if (action === 'print') {
            console.log('[readsf~] reading = ' + ${state.readingStatus}.toString())
            return
        }
    }    
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$l = {
      declare: declare$g,
      messages: messages$j,
      loop: loop$c,
      stateVariables: stateVariables$t,
      sharedCode: [
          parseSoundFileOpenOpts,
          parseReadWriteFsOpts,
          bangUtils,
      ],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const BLOCK_SIZE = 44100 * 5;
  const stateVariables$s = {
      isWriting: 1,
      operationId: 1,
      block: 1,
      cursor: 1,
      funcFlushBlock: 1,
  };
  // TODO: lots of things left to implement
  // TODO : check the real state machine of writesf
  //      - what happens when start / stopping / start stream ? 
  //      - what happens when stream ended and starting again ? 
  //      - etc ...
  // ------------------------------- node builder ------------------------------ //
  const builder$o = {
      translateArgs: (pdNode) => ({
          channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
      }),
      build: ({ channelCount }) => ({
          inlets: {
              '0_message': { type: 'message', id: '0_message' },
              ...mapArray(countTo(channelCount), (channel) => [
                  `${channel}`,
                  { type: 'signal', id: `${channel}` },
              ]),
          },
          outlets: {},
          isPullingSignal: true,
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------ declare ------------------------------ //
  const declare$f = ({ state, node: { args }, macros: { Func, Var } }) => renderCode `
    let ${Var(state.operationId, 'fs_OperationId')} = -1
    let ${Var(state.isWriting, 'boolean')} = false
    const ${Var(state.block, 'Array<FloatArray>')} = [
        ${countTo(args.channelCount).map(() => `createFloatArray(${BLOCK_SIZE}),`)}
    ]
    let ${Var(state.cursor, 'Int')} = 0

    const ${state.funcFlushBlock} = ${Func([], 'void')} => {
        const ${Var('block', 'Array<FloatArray>')} = []
        for (let ${Var('i', 'Int')} = 0; i < ${state.block}.length; i++) {
            block.push(${state.block}[i].subarray(0, ${state.cursor}))
        }
        fs_sendSoundStreamData(${state.operationId}, block)
        ${state.cursor} = 0
    }
`;
  // ------------------------------- loop ------------------------------ //
  const loop$b = ({ state, ins, node: { args } }) => renderCode `
    if (${state.isWriting} === true) {
        ${countTo(args.channelCount).map((i) => `${state.block}[${i}][${state.cursor}] = ${ins[i]}`)}
        ${state.cursor}++
        if (${state.cursor} === ${BLOCK_SIZE}) {
            ${state.funcFlushBlock}()
        }
    }
`;
  // ------------------------------- messages ------------------------------ //
  const messages$i = ({ node, state, globs, macros: { Var } }) => ({
      '0_message': `
    if (msg_getLength(${globs.m}) >= 2) {
        if (
            msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'open'
        ) {
            if (${state.operationId} !== -1) {
                fs_closeSoundStream(${state.operationId}, FS_OPERATION_SUCCESS)
            }

            const ${Var('soundInfo', 'fs_SoundInfo')} = {
                channelCount: ${node.args.channelCount},
                sampleRate: ${globs.sampleRate},
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }
            const ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
                ${globs.m},
                soundInfo,
            )
            const ${Var('url', 'string')} = parseReadWriteFsOpts(
                ${globs.m},
                soundInfo,
                unhandledOptions
            )
            if (url.length === 0) {
                return
            }
            ${state.operationId} = fs_openSoundWriteStream(
                url,
                soundInfo,
                () => {
                    ${state.funcFlushBlock}()
                    ${state.operationId} = -1
                }
            )
            return
        }

    } else if (msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])) {
        const ${Var('action', 'string')} = msg_readStringToken(${globs.m}, 0)

        if (action === 'start') {
            ${state.isWriting} = true
            return

        } else if (action === 'stop') {
            ${state.funcFlushBlock}()
            ${state.isWriting} = false
            return

        } else if (action === 'print') {
            console.log('[writesf~] writing = ' + ${state.isWriting}.toString())
            return
        }
    }    
    `
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$k = {
      declare: declare$f,
      messages: messages$i,
      loop: loop$b,
      stateVariables: stateVariables$s,
      sharedCode: [
          parseSoundFileOpenOpts,
          parseReadWriteFsOpts,
      ],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$r = {
      frequency: 1,
      Q: 1,
      // Output value Y[n]
      y: 1,
      // Last output value Y[n-1]
      ym1: 1,
      // Last output value Y[n-2]
      ym2: 1,
      coef1: 1,
      coef2: 1,
      gain: 1,
      funcSetQ: 1,
      funcSetFrequency: 1,
      funcUpdateCoefs: 1,
      funcClear: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$n = {
      translateArgs: ({ args }) => ({
          frequency: assertOptionalNumber(args[0]) || 0,
          Q: assertOptionalNumber(args[1]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
              '1': { type: 'message', id: '1' },
              '2': { type: 'message', id: '2' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------- declare ------------------------------ //
  const declare$e = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.frequency, 'Float')} = ${args.frequency}
    let ${Var(state.Q, 'Float')} = ${args.Q}
    let ${Var(state.coef1, 'Float')} = 0
    let ${Var(state.coef2, 'Float')} = 0
    let ${Var(state.gain, 'Float')} = 0
    let ${Var(state.y, 'Float')} = 0
    let ${Var(state.ym1, 'Float')} = 0
    let ${Var(state.ym2, 'Float')} = 0

    function ${state.funcUpdateCoefs} ${Func([], 'void')} {
        let ${Var('omega', 'Float')} = ${state.frequency} * (2.0 * Math.PI) / ${globs.sampleRate};
        let ${Var('oneminusr', 'Float')} = ${state.Q} < 0.001 ? 1.0 : Math.min(omega / ${state.Q}, 1)
        let ${Var('r', 'Float')} = 1.0 - oneminusr
        let ${Var('sigbp_qcos', 'Float')} = (omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
            (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
            : 0

        ${state.coef1} = 2.0 * sigbp_qcos * r
        ${state.coef2} = - r * r
        ${state.gain} = 2 * oneminusr * (oneminusr + r * omega)
    }

    function ${state.funcSetFrequency} ${Func([
    Var('frequency', 'Float')
], 'void')} {
        ${state.frequency} = (frequency < 0.001) ? 10: frequency
        ${state.funcUpdateCoefs}()
    }

    function ${state.funcSetQ} ${Func([
    Var('Q', 'Float')
], 'void')} {
        ${state.Q} = Math.max(Q, 0)
        ${state.funcUpdateCoefs}()
    }

    function ${state.funcClear} ${Func([], 'void')} {
        ${state.ym1} = 0
        ${state.ym2} = 0
    }

    commons_waitEngineConfigure(() => {
        ${state.funcUpdateCoefs}()
    })
`;
  // ------------------------------- loop ------------------------------ //
  const loop$a = ({ ins, outs, state }) => `
    ${state.y} = ${ins.$0} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$h = ({ state, globs }) => ({
      '0_message': `
        if (
            msg_isMatching(${globs.m})
            && msg_readStringToken(${globs.m}, 0) === 'clear'
        ) {
            ${state.funcClear}()
            return 
        }
    `,
      '1': coldFloatInletWithSetter(globs.m, state.funcSetFrequency),
      '2': coldFloatInletWithSetter(globs.m, state.funcSetQ),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$j = {
      loop: loop$a,
      stateVariables: stateVariables$r,
      messages: messages$h,
      declare: declare$e,
  };

  // TODO : unit tests
  const buses = ({ macros: { Var, Func } }) => `
    const ${Var('SIGNAL_BUSES', 'Map<string, Float>')} = new Map()
    SIGNAL_BUSES.set('', 0)

    function addAssignSignalBus ${Func([
    Var('busName', 'string'),
    Var('value', 'Float'),
], 'Float')} {
        const ${Var('newValue', 'Float')} = SIGNAL_BUSES.get(busName) + value
        SIGNAL_BUSES.set(
            busName,
            newValue,
        )
        return newValue
    }

    function resetSignalBus ${Func([
    Var('busName', 'string')
], 'void')} {
        SIGNAL_BUSES.set(busName, 0)
    }

    function readSignalBus ${Func([
    Var('busName', 'string')
], 'Float')} {
        return SIGNAL_BUSES.get(busName)
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$q = {
      busName: 1,
      funcSetBusName: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$m = {
      translateArgs: ({ args }) => ({
          busName: assertOptionalString(args[0]) || '',
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
          },
          outlets: {},
          isPullingSignal: true,
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------- declare ------------------------------ //
  const declare$d = ({ state, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.busName, 'string')} = ""

    const ${state.funcSetBusName} = ${Func([
    Var('busName', 'string')
], 'void')} => {
        if (busName.length) {
            ${state.busName} = busName
            resetSignalBus(${state.busName})
        }
    }

    ${state.funcSetBusName}("${args.busName}")
`;
  // ------------------------------- loop ------------------------------ //
  const loop$9 = ({ ins, state }) => `
    addAssignSignalBus(${state.busName}, ${ins.$0})
`;
  // ------------------------------- messages ------------------------------ //
  const messages$g = ({ state, globs }) => ({
      '0_message': `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetBusName}(msg_readStringToken(${globs.m}, 1))
        return
    }
    `
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$i = {
      loop: loop$9,
      messages: messages$g,
      stateVariables: stateVariables$q,
      declare: declare$d,
      sharedCode: [buses]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$p = {
      busName: 1,
      funcSetBusName: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$l = {
      translateArgs: ({ args }) => ({
          busName: assertOptionalString(args[0]) || '',
      }),
      build: () => ({
          inlets: {},
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$c = ({ state, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.busName, 'string')} = ""

    const ${state.funcSetBusName} = ${Func([
    Var('busName', 'string')
], 'void')} => {
        if (busName.length) {
            ${state.busName} = busName
            resetSignalBus(${state.busName})
        }
    }

    ${state.funcSetBusName}("${args.busName}")
`;
  // ------------------------------- loop ------------------------------ //
  const loop$8 = ({ outs, state }) => `
    ${outs.$0} = readSignalBus(${state.busName})
    resetSignalBus(${state.busName})
`;
  // ------------------------------------------------------------------- //
  const nodeImplementation$h = {
      loop: loop$8,
      stateVariables: stateVariables$p,
      declare: declare$c,
      sharedCode: [buses]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$o = {
      rate: 1,
      sampleRatio: 1,
      nextTick: 1,
      realNextTick: 1,
      funcSetRate: 1,
      funcScheduleNextTick: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$k = {
      translateArgs: (pdNode) => ({
          rate: assertOptionalNumber(pdNode.args[0]) || 0,
          unitAmount: assertOptionalNumber(pdNode.args[1]) || 1,
          unit: assertOptionalString(pdNode.args[2]) || 'msec',
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------ declare ------------------------------ //
  const declare$b = ({ state, globs, node: { args }, macros: { Func, Var }, }) => 
  // Time units are all expressed in samples here
`
        let ${Var(state.rate, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.nextTick, 'Int')} = -1
        let ${Var(state.realNextTick, 'Float')} = -1

        const ${state.funcSetRate} = ${Func([
    Var('rate', 'Float')
], 'void')} => {
            ${state.rate} = Math.max(rate, 0)
        }

        const ${state.funcScheduleNextTick} = ${Func([], 'void')} => {
            ${state.realNextTick} = ${state.realNextTick} + ${state.rate} * ${state.sampleRatio}
            ${state.nextTick} = toInt(Math.round(${state.realNextTick}))
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetRate}(${args.rate})
        })
    `  ;
  // ------------------------------ messages ------------------------------ //
  const messages$f = ({ state, globs }) => ({
      '0': `
    if (msg_getLength(${globs.m}) === 1) {
        if (
            (msg_isFloatToken(${globs.m}, 0) && msg_readFloatToken(${globs.m}, 0) === 0)
            || (msg_isStringToken(${globs.m}, 0) && msg_readStringToken(${globs.m}, 0) === 'stop')
        ) {
            ${state.nextTick} = 0
            ${state.realNextTick} = 0
            return

        } else if (
            msg_isFloatToken(${globs.m}, 0)
            || msg_isBang(${globs.m})
        ) {
            ${state.nextTick} = ${globs.frame}
            ${state.realNextTick} = toFloat(${globs.frame})
            return
        }
    }
    `,
      '1': coldFloatInletWithSetter(globs.m, state.funcSetRate),
  });
  // ------------------------------- loop ------------------------------ //
  const loop$7 = ({ state, snds, globs }) => `
    if (${globs.frame} === ${state.nextTick}) {
        ${snds.$0}(msg_bang())
        ${state.funcScheduleNextTick}()
    }
`;
  // ------------------------------------------------------------------- //
  const nodeImplementation$g = {
      declare: declare$b,
      messages: messages$f,
      loop: loop$7,
      stateVariables: stateVariables$o,
      sharedCode: [computeUnitInSamples, bangUtils],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$n = {
      resetTime: 1,
      sampleRatio: 1
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$j = {
      translateArgs: (pdNode) => ({
          unitAmount: assertOptionalNumber(pdNode.args[0]) || 1,
          unit: assertOptionalString(pdNode.args[1]) || 'msec',
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$a = ({ state, globs, node: { args }, macros: { Var }, }) => `
    let ${Var(state.sampleRatio, 'Float')} = 0
    let ${Var(state.resetTime, 'Int')} = 0

    commons_waitEngineConfigure(() => {
        ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
    })
`;
  // ------------------------------- messages ------------------------------ //
  const messages$e = ({ snds, globs, state, }) => ({
      '0': `
    if (msg_isBang(${globs.m})) {
        ${state.resetTime} = ${globs.frame}
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'tempo'
    ) {
        ${state.sampleRatio} = computeUnitInSamples(
            ${globs.sampleRate}, 
            msg_readFloatToken(${globs.m}, 1), 
            msg_readStringToken(${globs.m}, 2)
        )
        return
    }
    `,
      '1': `
    if (msg_isBang(${globs.m})) {
        ${snds.$0}(msg_floats([toFloat(${globs.frame} - ${state.resetTime}) / ${state.sampleRatio}]))
        return
    }
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$f = {
      stateVariables: stateVariables$n,
      declare: declare$a,
      messages: messages$e,
      sharedCode: [computeUnitInSamples, bangUtils]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$m = {
      funcSetDelay: 1,
      funcScheduleDelay: 1,
      funcStopDelay: 1,
      delay: 1,
      scheduledBang: 1,
      sampleRatio: 1,
  };
  // TODO : alias [del]
  // ------------------------------- node builder ------------------------------ //
  const builder$i = {
      translateArgs: (pdNode) => ({
          delay: assertOptionalNumber(pdNode.args[0]) || 0,
          unitAmount: assertOptionalNumber(pdNode.args[1]) || 1,
          unit: assertOptionalString(pdNode.args[2]) || 'msec',
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------ declare ------------------------------ //
  const declare$9 = ({ state, globs, node: { args }, macros: { Func, Var } }) => `
        let ${Var(state.delay, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.scheduledBang, 'Int')} = -1

        const ${state.funcSetDelay} = ${Func([
    Var('delay', 'Float')
], 'void')} => {
            ${state.delay} = Math.max(0, delay)
        }

        const ${state.funcScheduleDelay} = ${Func([], 'void')} => {
            ${state.scheduledBang} = toInt(Math.round(
                toFloat(${globs.frame}) + ${state.delay} * ${state.sampleRatio}))
        }

        const ${state.funcStopDelay} = ${Func([], 'void')} => {
            ${state.scheduledBang} = -1
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetDelay}(${args.delay})
        })
    `;
  // ------------------------------- loop ------------------------------ //
  const loop$6 = ({ state, snds, globs }) => `
    if (
        ${state.scheduledBang} > -1 
        && ${state.scheduledBang} <= ${globs.frame}
    ) {
        ${snds.$0}(msg_bang())
        ${state.scheduledBang} = -1
    }
`;
  // ------------------------------ messages ------------------------------ //
  const messages$d = ({ node, state, globs, macros: { Var } }) => ({
      '0': `
        if (msg_getLength(${globs.m}) === 1) {
            if (msg_isStringToken(${globs.m}, 0)) {
                const ${Var('action', 'string')} = msg_readStringToken(${globs.m}, 0)
                if (action === 'bang' || action === 'start') {
                    ${state.funcScheduleDelay}()
                    return
                } else if (action === 'stop') {
                    ${state.funcStopDelay}()
                    return
                }
                
            } else if (msg_isFloatToken(${globs.m}, 0)) {
                ${state.funcSetDelay}(msg_readFloatToken(${globs.m}, 0))
                ${state.funcScheduleDelay}()
                return 
            }
        
        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'tempo'
        ) {
            ${state.sampleRatio} = computeUnitInSamples(
                ${globs.sampleRate}, 
                msg_readFloatToken(${globs.m}, 1), 
                msg_readStringToken(${globs.m}, 2)
            )
            return
        }
    `,
      '1': coldFloatInletWithSetter(globs.m, state.funcSetDelay)
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$e = {
      declare: declare$9,
      messages: messages$d,
      loop: loop$6,
      stateVariables: stateVariables$m,
      sharedCode: [computeUnitInSamples, bangUtils]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$l = {
      value: 1,
      funcPrepareStoreValue: 1,
      funcPrepareStoreValueBang: 1,
  };
  // TODO : send / receive + set send / receive messages
  // ------------------------------- node builder ------------------------------ //
  const build = ({ outputOnLoad }) => {
      const partialNode = {
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      };
      if (outputOnLoad) {
          partialNode.isPushingMessages = true;
      }
      return partialNode;
  };
  const builderWithInit = {
      translateArgs: ({ args: [minValue, maxValue, init, initValue], }) => ({
          minValue: assertNumber(minValue),
          maxValue: assertNumber(maxValue),
          initValue: init === 1 ? assertNumber(initValue) : 0,
          outputOnLoad: !!init,
      }),
      build,
  };
  const builderWithoutInit = {
      translateArgs: ({ args: [minValue, maxValue] }) => ({
          minValue: assertNumber(minValue),
          maxValue: assertNumber(maxValue),
          initValue: 0,
          outputOnLoad: false,
      }),
      build,
  };
  const builderWithoutMin = {
      translateArgs: ({ args: [maxValue, init, initValue], }) => ({
          minValue: 0,
          maxValue: assertNumber(maxValue),
          initValue: init === 1 ? assertNumber(initValue) : 0,
          outputOnLoad: !!init,
      }),
      build,
  };
  const makeNodeImplementation$5 = ({ prepareStoreValue, prepareStoreValueBang, }) => {
      // ------------------------------- declare ------------------------------ //
      const declare = ({ node, state, macros: { Var, Func } }) => `
        let ${Var(state.value, 'Float')} = ${node.args.initValue}

        ${renderIf(prepareStoreValue, () => `const ${state.funcPrepareStoreValue} = ${Func([
        Var('value', 'Float')
    ], 'Float')} => {
                return ${prepareStoreValue(node.args)}
            }`)}

        ${renderIf(prepareStoreValueBang, () => `const ${state.funcPrepareStoreValueBang} = ${Func([
        Var('value', 'Float')
    ], 'Float')} => {
                return ${prepareStoreValueBang(node.args)}
            }`)}
    `;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ globs, snds, state }) => ({
          '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            ${prepareStoreValue ?
            `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(${globs.m}, 0))`
            : `${state.value} = msg_readFloatToken(${globs.m}, 0)`}
            ${snds.$0}(msg_floats([${state.value}]))
            return

        } else if (msg_isBang(${globs.m})) {
            ${renderIf(prepareStoreValueBang, () => `${state.value} = ${state.funcPrepareStoreValueBang}(${state.value})`)}
            ${snds.$0}(msg_floats([${state.value}]))
            return

        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
            && msg_readStringToken(${globs.m}, 0) === 'set'
        ) {
            ${prepareStoreValue ?
            `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(${globs.m}, 1))`
            : `${state.value} = msg_readFloatToken(${globs.m}, 1)`}
            return
        }
        `
      });
      // ------------------------------- loop ------------------------------ //
      const loop = ({ node, snds, globs, state }) => renderIf(node.args.outputOnLoad, () => `if (${globs.frame} === 0) {
                ${snds.$0}(msg_floats([${state.value}]))
            }`);
      return { messages, declare, stateVariables: stateVariables$l, loop, sharedCode: [bangUtils] };
  };
  // ------------------------------------------------------------------- //
  const nodeImplementations$7 = {
      'floatatom': makeNodeImplementation$5({}),
      'tgl': makeNodeImplementation$5({
          prepareStoreValueBang: ({ maxValue }) => `value === 0 ? ${maxValue}: 0`
      }),
      'nbx': makeNodeImplementation$5({
          prepareStoreValue: ({ minValue, maxValue }) => `Math.min(Math.max(value,${minValue}),${maxValue})`
      }),
      'hsl': makeNodeImplementation$5({}),
      'hradio': makeNodeImplementation$5({}),
  };
  nodeImplementations$7['vsl'] = nodeImplementations$7['hsl'];
  nodeImplementations$7['vradio'] = nodeImplementations$7['hradio'];
  const builders$7 = {
      'floatatom': builderWithoutInit,
      'tgl': builderWithoutMin,
      'nbx': builderWithInit,
      'hsl': builderWithInit,
      'vsl': builderWithInit,
      'hradio': builderWithoutMin,
      'vradio': builderWithoutMin,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$k = {};
  // TODO : send / receive + set send / receive messages
  // ------------------------------- node builder ------------------------------ //
  const builder$h = {
      translateArgs: ({ args: [init] }) => ({
          bangOnLoad: !!init,
      }),
      build: ({ bangOnLoad }) => {
          const partialNode = {
              inlets: {
                  '0': { type: 'message', id: '0' },
              },
              outlets: {
                  '0': { type: 'message', id: '0' },
              },
          };
          if (bangOnLoad) {
              partialNode.isPushingMessages = true;
          }
          return partialNode;
      },
  };
  // ------------------------------- messages ------------------------------ //
  const messages$c = ({ snds }) => ({
      '0': `
        ${snds.$0}(msg_bang())
        return
    `,
  });
  // ------------------------------- loop ------------------------------ //
  const loop$5 = ({ node, snds, globs }) => renderIf(node.args.bangOnLoad, `if (${globs.frame} === 0) {
            ${snds.$0}(msg_bang())
        }`);
  // ------------------------------------------------------------------- //
  const nodeImplementation$d = {
      loop: loop$5,
      messages: messages$c,
      stateVariables: stateVariables$k,
      sharedCode: [bangUtils],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$j = {};
  // ------------------------------- node builder ------------------------------ //
  const builder$g = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {},
          outlets: {
              '0': { type: 'message', id: '0' },
          },
          isPushingMessages: true
      }),
  };
  // ------------------------------- loop ------------------------------ //
  const loop$4 = ({ snds, globs }) => `
        if (${globs.frame} === 0) {
            ${snds.$0}(msg_bang())
        }
    `;
  // ------------------------------------------------------------------- //
  const nodeImplementation$c = {
      loop: loop$4,
      stateVariables: stateVariables$j,
      sharedCode: [bangUtils],
  };

  const roundFloatAsPdInt = ({ macros: { Func, Var } }) => `
    function roundFloatAsPdInt ${Func([
    Var('value', 'Float'),
], 'Float')} {
        return value > 0 ? Math.floor(value): Math.ceil(value)
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$i = {
      value: 1,
      funcSetValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$f = {
      translateArgs: (pdNode) => ({
          value: assertOptionalNumber(pdNode.args[0]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
          isPushingMessages: true,
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const makeDeclare = (prepareValueCode = 'value') => ({ node: { args }, state, macros: { Var, Func } }) => `
        let ${Var(state.value, 'Float')} = 0

        const ${state.funcSetValue} = ${Func([
    Var('value', 'Float')
], 'void')} => { ${state.value} = ${prepareValueCode} }
        
        ${state.funcSetValue}(${args.value})
    `;
  // ------------------------------- messages ------------------------------ //
  const messages$b = ({ snds, globs, state, }) => ({
      '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.funcSetValue}(msg_readFloatToken(${globs.m}, 0))
        ${snds.$0}(msg_floats([${state.value}]))
        return 

    } else if (msg_isBang(${globs.m})) {
        ${snds.$0}(msg_floats([${state.value}]))
        return
        
    }
    `,
      '1': coldFloatInletWithSetter(globs.m, state.funcSetValue),
  });
  // ------------------------------------------------------------------- //
  const builders$6 = {
      float: builder$f,
      f: { aliasTo: 'float' },
      int: builder$f,
      i: { aliasTo: 'int' },
  };
  const nodeImplementations$6 = {
      float: {
          declare: makeDeclare(),
          messages: messages$b,
          stateVariables: stateVariables$i,
          sharedCode: [bangUtils],
      },
      int: {
          declare: makeDeclare('roundFloatAsPdInt(value)'),
          messages: messages$b,
          stateVariables: stateVariables$i,
          sharedCode: [roundFloatAsPdInt, bangUtils],
      },
  };

  const stateVariables$h = {};
  // ------------------------------- node builder ------------------------------ //
  const builder$e = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  const makeNodeImplementation$4 = ({ operationCode, }) => {
      // ------------------------------- messages ------------------------------ //
      const messages = ({ globs, snds, macros: { Var } }) => ({
          '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            const ${Var('value', 'Float')} = msg_readFloatToken(${globs.m}, 0)
            ${snds.$0}(msg_floats([${operationCode}]))
            return
        }
        `
      });
      return { messages, stateVariables: stateVariables$h };
  };
  // ------------------------------------------------------------------- //
  const MAX_MIDI_FREQ = Math.pow(2, (1499 - 69) / 12) * 440;
  const nodeImplementations$5 = {
      'abs': makeNodeImplementation$4({ operationCode: `Math.abs(value)` }),
      // Also possible to use optimized version, but gives approximate results : 8.17579891564 * Math.exp(0.0577622650 * value)
      'mtof': makeNodeImplementation$4({ operationCode: `value <= -1500 ? 0: (value > 1499 ? ${MAX_MIDI_FREQ} : Math.pow(2, (value - 69) / 12) * 440)` }),
      // optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
      // which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
      // which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
      'ftom': makeNodeImplementation$4({ operationCode: `value <= 0 ? -1500: 12 * Math.log(value / 440) / Math.LN2 + 69` }),
      'rmstodb': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : 20 * Math.log(value) / Math.LN10 + 100` }),
      'dbtorms': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 20)` }),
      'powtodb': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : 10 * Math.log(value) / Math.LN10 + 100` }),
      'dbtopow': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 10)` }),
  };
  const builders$5 = {
      'abs': builder$e,
      'mtof': builder$e,
      'ftom': builder$e,
      'rmstodb': builder$e,
      'dbtorms': builder$e,
      'powtodb': builder$e,
      'dbtopow': builder$e,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$g = {
      'rightOp': 1
  };
  // ------------------------------- node builder ------------------------------ //
  const makeBuilder$1 = (defaultValue) => ({
      translateArgs: (pdNode) => {
          const value = assertOptionalNumber(pdNode.args[0]);
          return {
              value: value !== undefined ? value : defaultValue,
          };
      },
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '1_message': { type: 'message', id: '1_message' },
              '1': { type: 'signal', id: '1' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '1') {
              return '1_message';
          }
          return undefined;
      },
  });
  const makeNodeImplementation$3 = ({ generateOperation, }) => {
      // ------------------------------ declare ------------------------------ //
      const declare = ({ node, state, macros: { Var } }) => renderIf(_hasMessageRightInlet(node), `
                let ${Var(state.rightOp, 'Float')} = ${node.args.value}
            `);
      // ------------------------------- loop ------------------------------ //
      const loop = ({ node, ins, outs, state }) => _hasMessageRightInlet(node)
          ? `${outs.$0} = ${generateOperation(ins.$0, state.rightOp)}`
          : `${outs.$0} = ${generateOperation(ins.$0, ins.$1)}`;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ node, state, globs }) => ({
          '1_message': renderIf(_hasMessageRightInlet(node), `
            if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
                ${state.rightOp} = msg_readFloatToken(${globs.m}, 0)
                return
            }`)
      });
      return { declare, loop, messages, stateVariables: stateVariables$g };
  };
  // ------------------------------------------------------------------- //
  const _hasMessageRightInlet = (node) => !node.sources['1'] || !node.sources['1'].length;
  const nodeImplementations$4 = {
      '+~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} + ${rightOp}` }),
      '-~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} - ${rightOp}` }),
      '*~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} * ${rightOp}` }),
      '/~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${rightOp} !== 0 ? ${leftOp} / ${rightOp} : 0` }),
  };
  const builders$4 = {
      '+~': makeBuilder$1(0),
      '-~': makeBuilder$1(0),
      '*~': makeBuilder$1(1),
      '/~': makeBuilder$1(1),
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$f = {};
  // ------------------------------- node builder ------------------------------ //
  const builder$d = {
      translateArgs: (pdNode) => ({
          channelCount: assertNumber(pdNode.args[0]),
      }),
      build: (nodeArgs) => ({
          inlets: mapArray(countTo(nodeArgs.channelCount), (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]),
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
  };
  // ------------------------------- loop ------------------------------ //
  const loop$3 = ({ node, ins, outs }) => `
    ${outs.$0} = ${Object.keys(node.inlets)
    .map((inletId) => ins[inletId])
    .join(' + ')}
`;
  // ------------------------------------------------------------------- //
  const nodeImplementation$b = { loop: loop$3, stateVariables: stateVariables$f };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$e = {};
  // TODO : left inlet ?
  // ------------------------------- node builder ------------------------------ //
  const builder$c = {
      translateArgs: () => ({}),
      build: () => {
          return {
              inlets: {},
              outlets: {
                  '0': { type: 'signal', id: '0' },
              },
          };
      },
  };
  // ------------------------------- loop ------------------------------ //
  const loop$2 = ({ outs }) => `
    ${outs.$0} = Math.random() * 2 - 1
`;
  // ------------------------------------------------------------------- //
  const nodeImplementation$a = { loop: loop$2, stateVariables: stateVariables$e };

  // TODO : how to safely declare a global variable without clashing
  const delayBuffers = ({ macros: { Var, Func } }) => `
    const ${Var('DELAY_BUFFERS', 'Map<string, buf_SoundBuffer>')} = new Map()
    const ${Var('DELAY_BUFFERS_SKEDULER', 'Skeduler')} = sked_create(true)
    const ${Var('DELAY_BUFFERS_NULL', 'buf_SoundBuffer')} = buf_create(1)

    function DELAY_BUFFERS_set ${Func([
    Var('delayName', 'string'),
    Var('buffer', 'buf_SoundBuffer'),
], 'void')} {
        DELAY_BUFFERS.set(delayName, buffer)
        sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
    }

    function DELAY_BUFFERS_get ${Func([
    Var('delayName', 'string'),
    Var('callback', '(event: string) => void'),
], 'void')} {
        sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
    }

    function DELAY_BUFFERS_delete ${Func([
    Var('delayName', 'string'),
], 'void')} {
        DELAY_BUFFERS.delete(delayName)
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$d = {
      delayName: 1,
      buffer: 1,
      delaySamp: 1,
      delayMsec: 1,
      funcSetDelayName: 1,
      funcSetDelayMsec: 1,
  };
  // TODO : Implement 4-point interpolation for delread4
  // ------------------------------- node builder ------------------------------ //
  const builder$b = {
      translateArgs: ({ args }) => ({
          delayName: assertOptionalString(args[0]) || '',
          initDelayMsec: assertOptionalNumber(args[1]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  const makeNodeImplementation$2 = () => {
      // ------------------------------- declare ------------------------------ //
      const declare = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
        let ${Var(state.delayName, 'string')} = ""
        let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL
        let ${Var(state.delaySamp, 'Int')} = 0
        let ${Var(state.delayMsec, 'Float')} = 0

        const ${state.funcSetDelayMsec} = ${Func([
        Var('delayMsec', 'Float')
    ], 'void')} => {
            ${state.delayMsec} = delayMsec
            ${state.delaySamp} = toInt(Math.round(
                Math.min(
                    Math.max(computeUnitInSamples(${globs.sampleRate}, delayMsec, "msec"), 0), 
                    toFloat(${state.buffer}.length - 1)
                )
            ))
        }

        const ${state.funcSetDelayName} = ${Func([
        Var('delayName', 'string')
    ], 'void')} => {
            if (${state.delayName}.length) {
                ${state.buffer} = DELAY_BUFFERS_NULL
            }
            ${state.delayName} = delayName
            if (${state.delayName}.length) {
                DELAY_BUFFERS_get(${state.delayName}, () => { 
                    ${state.buffer} = DELAY_BUFFERS.get(${state.delayName})
                    ${state.funcSetDelayMsec}(${state.delayMsec})
                })
            }
        }

        commons_waitEngineConfigure(() => {
            if ("${args.delayName}".length) {
                ${state.funcSetDelayName}("${args.delayName}")
            }
            ${state.funcSetDelayMsec}(${args.initDelayMsec})
        })
    `;
      // ------------------------------- loop ------------------------------ //
      const loop = (context) => _hasSignalInput$1(context.node)
          ? loopSignal(context)
          : loopMessage(context);
      const loopMessage = ({ outs, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, ${state.delaySamp})
    `;
      const loopSignal = ({ globs, outs, ins, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, toInt(Math.round(
            Math.min(
                Math.max(computeUnitInSamples(${globs.sampleRate}, ${ins.$0}, "msec"), 0), 
                toFloat(${state.buffer}.length - 1)
            )
        )))
    `;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ state, globs }) => ({
          '0_message': coldFloatInletWithSetter(globs.m, state.funcSetDelayMsec)
      });
      // ------------------------------------------------------------------- //
      return {
          loop,
          stateVariables: stateVariables$d,
          messages,
          declare,
          sharedCode: [computeUnitInSamples, delayBuffers]
      };
  };
  const _hasSignalInput$1 = (node) => node.sources['0'] && node.sources['0'].length;
  const builders$3 = {
      'delread~': builder$b,
      'delread4~': builder$b,
  };
  const nodeImplementations$3 = {
      'delread~': makeNodeImplementation$2(),
      'delread4~': makeNodeImplementation$2(),
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$c = {
      delayName: 1,
      buffer: 1,
      funcSetDelayName: 1,
  };
  // TODO : default maxDurationMsec in Pd ? 
  // ------------------------------- node builder ------------------------------ //
  const builder$a = {
      translateArgs: ({ args }) => ({
          delayName: assertOptionalString(args[0]) || '',
          maxDurationMsec: assertOptionalNumber(args[1]) || 100,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '0_message': { type: 'message', id: '0_message' },
          },
          outlets: {},
          isPullingSignal: true,
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '0') {
              return '0_message';
          }
          return undefined;
      },
  };
  // ------------------------------- declare ------------------------------ //
  const declare$8 = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.delayName, 'string')} = ""
    let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL

    const ${state.funcSetDelayName} = ${Func([
    Var('delayName', 'string')
], 'void')} => {
        if (${state.delayName}.length) {
            DELAY_BUFFERS_delete(${state.delayName})
        }
        ${state.delayName} = delayName
        if (${state.delayName}.length) {
            DELAY_BUFFERS_set(${state.delayName}, ${state.buffer})
        }
    }

    commons_waitEngineConfigure(() => {
        ${state.buffer} = buf_create(
            toInt(computeUnitInSamples(
                ${globs.sampleRate}, 
                toFloat(${args.maxDurationMsec}), 
                "msec"
            ))
        )
        if ("${args.delayName}".length) {
            ${state.funcSetDelayName}("${args.delayName}")
        }
    })
`;
  // ------------------------------- loop ------------------------------ //
  const loop$1 = ({ ins, state }) => `
    buf_writeSample(${state.buffer}, ${ins.$0})
`;
  // ------------------------------- messages ------------------------------ //
  const messages$a = ({ state, globs }) => ({
      '0_message': `
        if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN]) 
            && msg_readStringToken(${globs.m}, 0) === 'clear'
        ) {
            buf_clear(${state.buffer})
            return
        }
    `
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$9 = {
      loop: loop$1,
      stateVariables: stateVariables$c,
      messages: messages$a,
      declare: declare$8,
      sharedCode: [computeUnitInSamples, delayBuffers]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$b = {
      lastInput: 1,
      lastOutput: 1,
      coeff: 1,
      funcSetCoeff: 1,
  };
  // TODO : tests + cleaner implementations
  // ------------------------------- node builder ------------------------------ //
  const builder$9 = {
      translateArgs: ({ args }) => ({
          initValue: assertOptionalNumber(args[0]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'signal', id: '0' },
              '1': { type: 'signal', id: '1' },
              '1_message': { type: 'message', id: '1_message' },
          },
          outlets: {
              '0': { type: 'signal', id: '0' },
          },
      }),
      rerouteMessageConnection: (inletId) => {
          if (inletId === '1') {
              return '1_message';
          }
          return undefined;
      },
  };
  const makeNodeImplementation$1 = ({ generateOperation, computeCoeff = () => 'value', }) => {
      // ------------------------------- declare ------------------------------ //
      const declare = (context) => _hasSignalInput(context.node)
          ? declareSignal(context)
          : declareMessage(context);
      const declareSignal = ({ state, macros: { Var }, }) => `
        let ${Var(state.lastOutput, 'Float')} = 0
        let ${Var(state.lastInput, 'Float')} = 0
    `;
      const declareMessage = ({ state, globs, node: { args }, macros: { Var, Func }, }) => `
        let ${Var(state.lastOutput, 'Float')} = 0
        let ${Var(state.lastInput, 'Float')} = 0
        let ${Var(state.coeff, 'Float')} = 0

        function ${state.funcSetCoeff} ${Func([
        Var('value', 'Float')
    ], 'void')} {
            ${state.coeff} = ${computeCoeff(globs.sampleRate)}
        }

        commons_waitEngineConfigure(() => {
            ${state.funcSetCoeff}(${args.initValue})
        })
    `;
      // ------------------------------- loop ------------------------------ //
      const loop = (context) => _hasSignalInput(context.node)
          ? loopSignal(context)
          : loopMessage(context);
      const loopSignal = ({ ins, state, outs }) => `
        ${state.lastOutput} = ${outs.$0} = ${generateOperation(ins.$0, ins.$1, state.lastOutput, state.lastInput)}
        ${state.lastInput} = ${ins.$0}
    `;
      const loopMessage = ({ ins, state, outs }) => `
        ${state.lastOutput} = ${outs.$0} = ${generateOperation(ins.$0, state.coeff, state.lastOutput, state.lastInput)}
        ${state.lastInput} = ${ins.$0}
    `;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ globs, state }) => ({
          '1_message': coldFloatInletWithSetter(globs.m, state.funcSetCoeff),
      });
      return {
          loop,
          stateVariables: stateVariables$b,
          messages,
          declare,
      };
  };
  // ------------------------------------------------------------------- //
  const _hasSignalInput = (node) => node.sources['1'] && node.sources['1'].length;
  const builders$2 = {
      'rpole~': builder$9,
      'rzero_rev~': builder$9,
      'hip~': builder$9,
  };
  const nodeImplementations$2 = {
      'rpole~': makeNodeImplementation$1({
          generateOperation: (input, coeff, lastOutput) => `${input} + ${coeff} * ${lastOutput}`,
      }),
      'rzero_rev~': makeNodeImplementation$1({
          generateOperation: (input, coeff, _, lastInput) => `${lastInput} - ${coeff} * ${input}`
      }),
      'hip~': makeNodeImplementation$1({
          generateOperation: (input, coeff, lastOutput, lastInput) => `${coeff} * (${lastOutput} + ${input} - ${lastInput})`,
          computeCoeff: (sampleRate) => `Math.min(1, Math.max(0, 1 - Math.max(0, value) * 2 * Math.PI / ${sampleRate}))`
      }),
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$a = {
      outTemplates: 1,
      outMessages: 1,
      messageTransferFunctions: 1
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$8 = {
      translateArgs: (pdNode) => {
          const templates = [[]];
          pdNode.args.forEach(arg => {
              if (arg === ',') {
                  templates.push([]);
              }
              else {
                  templates[templates.length - 1].push(arg);
              }
          });
          return ({
              templates: templates.filter(template => template.length),
          });
      },
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------ declare ------------------------------ //
  const declare$7 = (context) => {
      const { state, node, macros: { Var, Func }, } = context;
      const transferCodes = node.args.templates.map((template, i) => buildMsgTransferCode(context, template, i));
      return renderCode `
        let ${Var(state.outTemplates, 'Array<MessageTemplate>')} = []
        let ${Var(state.outMessages, 'Array<Message>')} = []
        ${transferCodes.map(({ inMessageUsed, outMessageCode }) => renderIf(!inMessageUsed, outMessageCode))}
        
        const ${Var(state.messageTransferFunctions, 'Array<(m: Message) => Message>')} = [
            ${transferCodes.map(({ inMessageUsed, outMessageCode }, i) => `
                ${Func([
        Var('inMessage', 'Message')
    ], 'Message')} => {
                    ${renderIf(inMessageUsed, outMessageCode)}
                    return ${state.outMessages}[${i}]
                }`).join(',')}
        ]
    `;
  };
  // ------------------------------- messages ------------------------------ //
  const messages$9 = ({ snds, state, globs, macros: { Var, Func }, }) => {
      return {
          '0': `
        if (
            msg_isStringToken(${globs.m}, 0) 
            && msg_readStringToken(${globs.m}, 0) === 'set'
        ) {
            ${state.outTemplates} = [[]]
            for (let ${Var('i', 'Int')} = 1; i < msg_getLength(${globs.m}); i++) {
                if (msg_isFloatToken(${globs.m}, i)) {
                    ${state.outTemplates}[0].push(MSG_FLOAT_TOKEN)
                } else {
                    ${state.outTemplates}[0].push(MSG_STRING_TOKEN)
                    ${state.outTemplates}[0].push(msg_readStringToken(${globs.m}, i).length)
                }
            }

            const ${Var('message', 'Message')} = msg_create(${state.outTemplates}[0])
            for (let ${Var('i', 'Int')} = 1; i < msg_getLength(${globs.m}); i++) {
                if (msg_isFloatToken(${globs.m}, i)) {
                    msg_writeFloatToken(
                        message, i - 1, msg_readFloatToken(${globs.m}, i)
                    )
                } else {
                    msg_writeStringToken(
                        message, i - 1, msg_readStringToken(${globs.m}, i)
                    )
                }
            }
            ${state.outMessages}[0] = message
            ${state.messageTransferFunctions}.splice(0, ${state.messageTransferFunctions}.length - 1)
            ${state.messageTransferFunctions}[0] = ${Func([
            Var('m', 'Message')
        ], 'Message')} => { return ${state.outMessages}[0] }
            return

        } else {
            for (let ${Var('i', 'Int')} = 0; i < ${state.messageTransferFunctions}.length; i++) {
                ${snds.$0}(${state.messageTransferFunctions}[i](${globs.m}))
            }
            return    
        }
    `,
      };
  };
  // ------------------------------------------------------------------- //
  const nodeImplementation$8 = { declare: declare$7, messages: messages$9, stateVariables: stateVariables$a };
  const buildMsgTransferCode = ({ state, macros: { Var } }, template, index) => {
      const outTemplate = `${state.outTemplates}[${index}]`;
      const outMessage = `${state.outMessages}[${index}]`;
      const operations = buildMessageTransferOperations(template);
      let outTemplateCode = '';
      let outMessageCode = '';
      let stringMemCount = 0;
      operations.forEach((operation, outIndex) => {
          if (operation.type === 'noop') {
              const { inIndex } = operation;
              outTemplateCode += `
                ${outTemplate}.push(msg_getTokenType(inMessage, ${inIndex}))
                if (msg_isStringToken(inMessage, ${inIndex})) {
                    stringMem[${stringMemCount}] = msg_readStringToken(inMessage, ${inIndex})
                    ${outTemplate}.push(stringMem[${stringMemCount}].length)
                }
            `;
              outMessageCode += `
                if (msg_isFloatToken(inMessage, ${inIndex})) {
                    msg_writeFloatToken(${outMessage}, ${outIndex}, msg_readFloatToken(inMessage, ${inIndex}))
                } else if (msg_isStringToken(inMessage, ${inIndex})) {
                    msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
                }
            `;
              stringMemCount++;
          }
          else if (operation.type === 'string-template') {
              outTemplateCode += `
                stringToken = "${operation.template}"
                ${operation.variables.map(({ placeholder, inIndex }) => `
                    if (msg_isFloatToken(inMessage, ${inIndex})) {
                        otherStringToken = msg_readFloatToken(inMessage, ${inIndex}).toString()
                        if (otherStringToken.endsWith('.0')) {
                            otherStringToken = otherStringToken.slice(0, -2)
                        }
                        stringToken = stringToken.replace("${placeholder}", otherStringToken)
                    } else if (msg_isStringToken(inMessage, ${inIndex})) {
                        stringToken = stringToken.replace("${placeholder}", msg_readStringToken(inMessage, ${inIndex}))
                    }`)}
                stringMem[${stringMemCount}] = stringToken
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(stringMem[${stringMemCount}].length)
            `;
              outMessageCode += `
                msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
            `;
              stringMemCount++;
          }
          else if (operation.type === 'string-constant') {
              outTemplateCode += `
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(${operation.value.length})
            `;
              outMessageCode += `
                msg_writeStringToken(${outMessage}, ${outIndex}, "${operation.value}")
            `;
          }
          else if (operation.type === 'float-constant') {
              outTemplateCode += `
                ${outTemplate}.push(MSG_FLOAT_TOKEN)
            `;
              outMessageCode += `
                msg_writeFloatToken(${outMessage}, ${outIndex}, ${operation.value})
            `;
          }
      });
      const hasStringTemplate = operations.some((op) => op.type === 'string-template');
      const inMessageUsed = operations.some((op) => op.type === 'noop' || op.type === 'string-template');
      return {
          inMessageUsed,
          outMessageCode: `
            ${renderIf(hasStringTemplate, `let ${Var('stringToken', 'string')}`)}
            ${renderIf(hasStringTemplate, `let ${Var('otherStringToken', 'string')}`)}
            ${renderIf(inMessageUsed, `let ${Var('stringMem', 'Array<string>')} = []`)}
            ${outTemplate} = []
            ${outTemplateCode}           
            ${outMessage} = msg_create(${outTemplate})
            ${outMessageCode}
        `,
      };
  };
  const buildMessageTransferOperations = (template) => {
      // Creates an array of transfer functions `inVal -> outVal`.
      return template.map((templateElem) => {
          if (typeof templateElem === 'string') {
              const matchDollar = DOLLAR_VAR_RE.exec(templateElem);
              // If the transfer is a dollar var :
              //      ['bla', 789] - ['$1'] -> ['bla']
              //      ['bla', 789] - ['$2'] -> [789]
              if (matchDollar && matchDollar[0] === templateElem) {
                  // -1, because $1 corresponds to value 0.
                  const inIndex = parseInt(matchDollar[1], 10) - 1;
                  return { type: 'noop', inIndex };
              }
              else if (matchDollar) {
                  const variables = [];
                  let matched;
                  while ((matched = DOLLAR_VAR_RE_GLOB.exec(templateElem))) {
                      // position -1, because $1 corresponds to value 0.
                      variables.push({
                          placeholder: matched[0],
                          inIndex: parseInt(matched[1], 10) - 1,
                      });
                  }
                  return {
                      type: 'string-template',
                      template: templateElem,
                      variables,
                  };
                  // Else the input doesn't matter
              }
              else {
                  return { type: 'string-constant', value: templateElem };
              }
          }
          else {
              return { type: 'float-constant', value: templateElem };
          }
      });
  };
  const DOLLAR_VAR_RE = /\$(\d+)/;
  const DOLLAR_VAR_RE_GLOB = /\$(\d+)/g;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$9 = {
      operations: 1,
      buildMessage1: 1,
  };
  // TODO: Implement -normalize for write operation
  // TODO: Implement output headersize
  // ------------------------------- node builder ------------------------------ //
  const builder$7 = {
      translateArgs: () => ({}),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
      }),
  };
  // ------------------------------ declare ------------------------------ //
  const declare$6 = ({ state, macros: { Func, Var } }) => `
    class SfOperation {
        ${Var('url', 'string')}
        ${Var('arrayNames', 'Array<string>')}
        ${Var('resize', 'boolean')}
        ${Var('maxSize', 'Float')}
        ${Var('framesToWrite', 'Float')}
        ${Var('skip', 'Float')}
        ${Var('soundInfo', 'fs_SoundInfo')}
    }
    const ${Var(state.operations, 'Map<fs_OperationId, SfOperation>')} = new Map()

    const ${state.buildMessage1} = ${Func([
    Var('soundInfo', 'fs_SoundInfo')
], 'Message')} => {
        const ${Var('m', 'Message')} = msg_create([
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_STRING_TOKEN,
            soundInfo.endianness.length,
        ])
        msg_writeFloatToken(m, 0, soundInfo.sampleRate)
        msg_writeFloatToken(m, 1, -1) // TODO IMPLEMENT headersize
        msg_writeFloatToken(m, 2, toFloat(soundInfo.channelCount))
        msg_writeFloatToken(m, 3, Math.round(soundInfo.bitDepth / 8))
        msg_writeStringToken(m, 4, soundInfo.endianness)
        return m
    }
`;
  // ------------------------------- messages ------------------------------ //
  const messages$8 = ({ node, state, globs, snds, macros: { Func, Var } }) => ({
      '0': `
    if (
        msg_getLength(${globs.m}) >= 3 
        && msg_isStringToken(${globs.m}, 0)
        && (
            msg_readStringToken(${globs.m}, 0) === 'read'
            || msg_readStringToken(${globs.m}, 0) === 'write'
        )
    ) {
        const ${Var('operationType', 'string')} = msg_readStringToken(${globs.m}, 0)
        const ${Var('soundInfo', 'fs_SoundInfo')} = {
            channelCount: 0,
            sampleRate: ${globs.sampleRate},
            bitDepth: 32,
            encodingFormat: '',
            endianness: '',
            extraOptions: '',
        }
        const ${Var('operation', 'SfOperation')} = {
            arrayNames: [],
            resize: false,
            maxSize: -1,
            skip: 0,
            framesToWrite: 0,
            url: '',
            soundInfo,
        }
        let ${Var('unhandledOptions', 'Set<Int>')} = parseSoundFileOpenOpts(
            ${globs.m},
            soundInfo,
        )
        
        // Remove the operation type
        unhandledOptions.delete(0)
        
        let ${Var('i', 'Int')} = 1
        let ${Var('str', 'string')} = ''
        while (i < msg_getLength(${globs.m})) {
            if (!unhandledOptions.has(i)) {

            } else if (msg_isStringToken(${globs.m}, i)) {
                str = msg_readStringToken(${globs.m}, i)
                if (str === '-resize') {
                    unhandledOptions.delete(i)
                    operation.resize = true

                } else if (str === '-maxsize' || str === '-nframes') {
                    unhandledOptions.delete(i)
                    if (
                        i + 1 >= msg_getLength(${globs.m}) 
                        || !msg_isFloatToken(${globs.m}, i + 1)
                    ) {
                        console.log("invalid value for -maxsize")
                    }
                    operation.maxSize = msg_readFloatToken(${globs.m}, i + 1)
                    unhandledOptions.delete(i + 1)
                    i++

                } else if (str === '-skip') {
                    unhandledOptions.delete(i)
                    if (
                        i + 1 >= msg_getLength(${globs.m}) 
                        || !msg_isFloatToken(${globs.m}, i + 1)
                    ) {
                        console.log("invalid value for -skip")
                    }
                    operation.skip = msg_readFloatToken(${globs.m}, i + 1)
                    unhandledOptions.delete(i + 1)
                    i++

                } else if (str === '-normalize') {
                    unhandledOptions.delete(i)
                    console.log('-normalize not implemented')
                }
            }
            i++
        }

        i = 1
        let ${Var('urlFound', 'boolean')} = false
        while (i < msg_getLength(${globs.m})) {
            if (!unhandledOptions.has(i)) {

            } else if (msg_isStringToken(${globs.m}, i)) {
                str = msg_readStringToken(${globs.m}, i)
                if (!str.startsWith('-') && urlFound === false) {
                    operation.url = str
                    urlFound = true
                } else {
                    operation.arrayNames.push(str)
                }
                unhandledOptions.delete(i)
            }
            i++
        }

        for (i = 0; i < operation.arrayNames.length; i++) {
            if (!commons_hasArray(operation.arrayNames[i])) {
                console.log('[soundfiler] unknown array ' + operation.arrayNames[i])
                return
            }
        }

        if (unhandledOptions.size) {
            console.log("soundfiler received invalid options")
        }

        soundInfo.channelCount = operation.arrayNames.length

        if (operationType === 'read') {
            const callback = ${Func([
        Var('id', 'fs_OperationId'),
        Var('status', 'fs_OperationStatus'),
        Var('sound', 'FloatArray[]'),
    ], 'void')} => {
                const ${Var('operation', 'SfOperation')} = ${state.operations}.get(id)
                ${state.operations}.delete(id)
                let ${Var('i', 'Int')} = 0
                let ${Var('maxFramesRead', 'Float')} = 0
                let ${Var('framesToRead', 'Float')} = 0
                let ${Var('array', 'FloatArray')} = createFloatArray(0)
                for (i = 0; i < sound.length; i++) {
                    if (operation.resize) {
                        if (operation.maxSize > 0) {
                            framesToRead = Math.min(
                                operation.maxSize, 
                                toFloat(sound[i].length) - operation.skip
                            )

                        } else {
                            framesToRead = toFloat(sound[i].length) - operation.skip
                        }

                        commons_setArray(
                            operation.arrayNames[i], 
                            sound[i].subarray(
                                toInt(operation.skip), 
                                toInt(operation.skip + framesToRead)
                            )
                        )
                        
                    } else {
                        array = commons_getArray(operation.arrayNames[i])
                        framesToRead = Math.min(
                            toFloat(array.length),
                            toFloat(sound[i].length) - operation.skip
                        )
                        array.set(sound[i].subarray(0, array.length))
                    }
                    maxFramesRead = Math.max(
                        maxFramesRead,
                        framesToRead
                    )
                }

                ${snds.$1}(${state.buildMessage1}(operation.soundInfo))
                ${snds.$0}(msg_floats([maxFramesRead]))
            }

            const ${Var('id', 'fs_OperationId')} = fs_readSoundFile(
                operation.url, 
                soundInfo,
                callback
            )

            ${state.operations}.set(id, operation)

        } else if (operationType === 'write') {
            let ${Var('i', 'Int')} = 0
            let ${Var('framesToWrite', 'Float')} = 0
            let ${Var('array', 'FloatArray')} = createFloatArray(0)
            const ${Var('sound', 'FloatArray[]')} = []
            
            for (i = 0; i < operation.arrayNames.length; i++) {
                framesToWrite = Math.max(
                    framesToWrite,
                    toFloat(commons_getArray(operation.arrayNames[i]).length) - operation.skip,
                )
            }

            if (operation.maxSize >= 0) {
                framesToWrite = Math.min(
                    operation.maxSize, 
                    framesToWrite
                )
            }
            operation.framesToWrite = framesToWrite

            if (framesToWrite < 1) {
                console.log('[soundfiler] no frames to write')
                return
            }

            for (i = 0; i < operation.arrayNames.length; i++) {
                array = commons_getArray(operation.arrayNames[i])
                if (framesToWrite > toFloat(array.length) - operation.skip) {
                    sound.push(createFloatArray(toInt(framesToWrite)))
                    sound[i].set(array.subarray(
                        toInt(operation.skip), 
                        toInt(operation.skip + framesToWrite)
                    ))
                } else {
                    sound.push(array.subarray(
                        toInt(operation.skip), 
                        toInt(operation.skip + framesToWrite)
                    ))
                }
            }

            const callback = ${Func([
        Var('id', 'fs_OperationId'),
        Var('status', 'fs_OperationStatus'),
    ], 'void')} => {
                const ${Var('operation', 'SfOperation')} = ${state.operations}.get(id)
                ${state.operations}.delete(id)
                ${snds.$1}(${state.buildMessage1}(operation.soundInfo))
                ${snds.$0}(msg_floats([operation.framesToWrite]))
            }

            const ${Var('id', 'fs_OperationId')} = fs_writeSoundFile(
                sound, 
                operation.url, 
                soundInfo, 
                callback
            )

            ${state.operations}.set(id, operation)
        }

        return
    }
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$7 = {
      declare: declare$6,
      messages: messages$8,
      stateVariables: stateVariables$9,
      sharedCode: [parseSoundFileOpenOpts],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$8 = {};
  // ------------------------------- node builder ------------------------------ //
  const builder$6 = {
      translateArgs: (pdNode) => {
          let prefix = 'print:';
          if (pdNode.args.length === 1 && pdNode.args[0] === '-n') {
              prefix = '';
          }
          else if (pdNode.args.length >= 1) {
              prefix = pdNode.args.join(' ') + ':';
          }
          return { prefix };
      },
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {},
      }),
  };
  // ------------------------------- messages ------------------------------ //
  const messages$7 = ({ globs, node: { args } }) => ({
      '0': `
        console.log("${args.prefix} " + msg_display(${globs.m}))
        return
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$6 = { messages: messages$7, stateVariables: stateVariables$8 };

  const TYPE_ARGUMENTS = [
      'float',
      'bang',
      'symbol',
      'list',
      'anything',
  ];
  const resolveTypeArgumentAlias = (value) => {
      switch (value) {
          case 'f':
              return 'float';
          case 'b':
              return 'bang';
          case 's':
              return 'symbol';
          case 'l':
              return 'list';
          case 'a':
              return 'anything';
          case 'p':
              return 'pointer';
          default:
              return value;
      }
  };
  const assertTypeArgument = (value) => {
      if (value === 'pointer') {
          throw new ValidationError(`"pointer" not supported (yet)`);
      }
      else if (!TYPE_ARGUMENTS.includes(value)) {
          throw new ValidationError(`invalid type ${value}`);
      }
      return value;
  };
  const renderMessageTransfer = (typeArgument, msgVariableName, index) => {
      switch (typeArgument) {
          case 'float':
              return `msg_floats([messageTokenToFloat(${msgVariableName}, ${index})])`;
          case 'bang':
              return `msg_bang()`;
          case 'symbol':
              return `msg_strings([messageTokenToString(${msgVariableName}, ${index})])`;
          case 'list':
          case 'anything':
              return `${msgVariableName}`;
          default:
              throw new Error(`type argument ${typeArgument} not supported (yet)`);
      }
  };
  const messageTokenToFloat = ({ macros: { Func, Var } }) => `
    function messageTokenToFloat ${Func([
    Var('m', 'Message'),
    Var('i', 'Int')
], 'Float')} {
        if (msg_isFloatToken(m, i)) {
            return msg_readFloatToken(m, i)
        } else {
            return 0
        }
    }
`;
  const messageTokenToString = ({ macros: { Func, Var } }) => `
    function messageTokenToString ${Func([
    Var('m', 'Message'),
    Var('i', 'Int')
], 'string')} {
        if (msg_isStringToken(m, i)) {
            const ${Var('str', 'string')} = msg_readStringToken(m, i)
            if (str === 'bang') {
                return 'symbol'
            } else {
                return str
            }
        } else {
            return 'float'
        }
    }
`;

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$7 = {};
  // TODO : 
  // - pointer
  // ------------------------------- node builder ------------------------------ //
  const builder$5 = {
      translateArgs: ({ args }) => ({
          typeArguments: args.length === 0 ? ['bang', 'bang'] : args
              .map(assertString)
              .map(resolveTypeArgumentAlias)
              .map(assertTypeArgument),
      }),
      build: ({ typeArguments }) => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: mapArray(typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
      }),
  };
  // ------------------------------- messages ------------------------------ //
  const messages$6 = ({ snds, globs, node: { args: { typeArguments } } }) => ({
      '0': renderCode `
        ${typeArguments.reverse().map((typeArg, i) => `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, globs.m, 0)})`)}
        return
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$5 = {
      messages: messages$6,
      stateVariables: stateVariables$7,
      sharedCode: [
          messageTokenToFloat,
          messageTokenToString,
          bangUtils,
      ],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$6 = {
      currentValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$4 = {
      translateArgs: ({ args }) => ({
          initValue: assertOptionalNumber(args[0]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$5 = ({ node, state, macros: { Var }, }) => `let ${Var(state.currentValue, 'Float')} = ${node.args.initValue}`;
  // ------------------------------- messages ------------------------------ //
  const messages$5 = ({ snds, globs, state, macros: { Var }, }) => ({
      '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        const ${Var('newValue', 'Float')} = msg_readFloatToken(${globs.m}, 0)
        if (newValue !== ${state.currentValue}) {
            ${state.currentValue} = newValue
            ${snds[0]}(msg_floats([${state.currentValue}]))
        }
        return

    } else if (msg_isBang(${globs.m})) {
        ${snds[0]}(msg_floats([${state.currentValue}]))
        return 

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.currentValue} = msg_readFloatToken(${globs.m}, 1)
        return
    }
    `,
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$4 = {
      messages: messages$5,
      stateVariables: stateVariables$6,
      declare: declare$5,
      sharedCode: [bangUtils],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$5 = {
      threshold: 1
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$3 = {
      translateArgs: ({ args }) => ({
          threshold: assertOptionalNumber(args[0]) || 0
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$4 = ({ node, state, macros: { Var }, }) => `
    let ${Var(state.threshold, 'Float')} = ${node.args.threshold}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$4 = ({ snds, globs, state, macros: { Var } }) => ({
      '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        const ${Var('value', 'Float')} = msg_readFloatToken(${globs.m}, 0)
        if (value >= ${state.threshold}) {
            ${snds[1]}(msg_floats([value]))
        } else {
            ${snds[0]}(msg_floats([value]))
        }
        return
    }
    `,
      '1': coldFloatInlet(globs.m, state.threshold),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$3 = { messages: messages$4, stateVariables: stateVariables$5, declare: declare$4 };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$4 = {
      minValue: 1,
      maxValue: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$2 = {
      translateArgs: ({ args }) => ({
          minValue: assertOptionalNumber(args[0]) || 0,
          maxValue: assertOptionalNumber(args[1]) || 0,
      }),
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
              '2': { type: 'message', id: '2' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$3 = ({ node, state, macros: { Var }, }) => `
    let ${Var(state.minValue, 'Float')} = ${node.args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${node.args.maxValue}
`;
  // ------------------------------- messages ------------------------------ //
  const messages$3 = ({ snds, globs, state }) => ({
      '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${snds[0]}(msg_floats([
            Math.max(Math.min(${state.maxValue}, msg_readFloatToken(${globs.m}, 0)), ${state.minValue})
        ]))
        return
    }
    `,
      '1': coldFloatInlet(globs.m, state.minValue),
      '2': coldFloatInlet(globs.m, state.maxValue),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$2 = { messages: messages$3, stateVariables: stateVariables$4, declare: declare$3 };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$3 = {
      delay: 1,
      scheduledMessages: 1,
      scheduledFrames: 1,
      lastReceived: 1,
      funcScheduleMessage: 1,
      funcSetDelay: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder$1 = {
      translateArgs: ({ args }) => {
          let delay = 0;
          if (args.length >= 1) {
              delay = assertNumber(args[args.length - 1]);
              args = args.slice(0, -1);
          }
          args = args.length ? args : [0];
          return {
              typeArguments: args.map(resolveTypeArgumentAlias)
                  .map(value => [
                  typeof value === 'number' ? 'float' : assertTypeArgument(value),
                  typeof value === 'number' ? value : value === 'float' ? 0 : 'symbol'
              ]),
              delay
          };
      },
      build: (args) => ({
          inlets: {
              ...mapArray(args.typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
              [`${args.typeArguments.length}`]: {
                  type: 'message',
                  id: `${args.typeArguments.length}`
              },
          },
          outlets: mapArray(args.typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
      }),
  };
  // ------------------------------- declare ------------------------------ //
  // !!! Array.splice insertion is not supported by assemblyscript, so : 
  // 1. We grow arrays to their post-insertion size by using `push`
  // 2. We use `copyWithin` to move old elements to their final position.
  // 3. We insert the new elements at their place.
  const declare$2 = ({ state, globs, node: { args }, macros: { Var, Func }, }) => renderCode `
    let ${state.delay} = 0
    let ${Var(state.scheduledMessages, 'Array<Message>')} = []
    let ${Var(state.scheduledFrames, 'Array<Int>')} = []
    const ${Var(state.lastReceived, 'Array<Message>')} = [${args.typeArguments
    .map(([_, value]) => typeof value === 'number' ?
    `msg_floats([${value}])`
    : `msg_strings(["${value}"])`).join(',')}]

    const ${state.funcScheduleMessage} = ${Func([
    Var('inMessage', 'Message')
], 'void')} => {
        let ${Var('insertIndex', 'Int')} = 0
        let ${Var('frame', 'Int')} = ${globs.frame} + ${state.delay}
        let ${Var('outMessage', 'Message')} = msg_create([])

        while (
            insertIndex < ${state.scheduledFrames}.length 
            && ${state.scheduledFrames}[insertIndex] <= frame
        ) {insertIndex++}

        
        ${countTo(args.typeArguments.length).map(_ => `${state.scheduledMessages}.push(msg_create([]))`)}
        ${state.scheduledMessages}.copyWithin((insertIndex + 1) * ${args.typeArguments.length}, insertIndex * ${args.typeArguments.length})
        ${state.scheduledFrames}.push(0)
        ${state.scheduledFrames}.copyWithin(insertIndex + 1, insertIndex)

        ${args.typeArguments.reverse()
    .map(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
    .map(([iReverse, typeArg], i) => `
                if (msg_getLength(inMessage) > ${iReverse}) {
                    outMessage = ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                    ${state.lastReceived}[${iReverse}] = outMessage
                } else {
                    outMessage = ${state.lastReceived}[${iReverse}]
                }
                ${state.scheduledMessages}[insertIndex * ${args.typeArguments.length} + ${i}] = outMessage
            `)}
        ${state.scheduledFrames}[insertIndex] = frame
    }

    const ${state.funcSetDelay} = ${Func([
    Var('delay', 'Float')
], 'void')} => {
        ${state.delay} = toInt(Math.round(delay / 1000 * ${globs.sampleRate}))
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetDelay}(${args.delay})
    })
`;
  // ------------------------------- loop ------------------------------ //
  const loop = ({ node, state, globs, snds, }) => `
    while (${state.scheduledFrames}.length && ${state.scheduledFrames}[0] <= ${globs.frame}) {
        ${state.scheduledFrames}.shift()
        ${countTo(node.args.typeArguments.length).reverse()
    .map((i) => `${snds[i]}(${state.scheduledMessages}.shift())`)}
    }
`;
  // ------------------------------- messages ------------------------------ //
  const messages$2 = ({ node, snds, globs, state, macros: { Var } }) => ({
      '0': renderCode `
    if (msg_isBang(${globs.m})) {
        ${state.funcScheduleMessage}(msg_create([]))
        return

    } else if (msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])) {
        const ${Var('action', 'string')} = msg_readStringToken(${globs.m}, 0)

        if (action === 'clear') {
            ${state.scheduledMessages} = []
            ${state.scheduledFrames} = []
            return 

        } else if (action === 'flush') {
            ${state.scheduledFrames} = []
            while (${state.scheduledMessages}.length) {
                ${countTo(node.args.typeArguments.length).reverse()
        .map((i) => `${snds[i]}(${state.scheduledMessages}.shift())`)}
            }
            return
        }

    } else {
        ${state.funcScheduleMessage}(${globs.m})
        return
    }
    `,
      ...mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => [
          `${i + 1}`,
          `${state.lastReceived}[${i + 1}] = ${renderMessageTransfer(typeArg, globs.m, 0)}
            return`
      ]),
      [node.args.typeArguments.length]: coldFloatInletWithSetter(globs.m, state.funcSetDelay)
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation$1 = {
      loop,
      messages: messages$2,
      stateVariables: stateVariables$3,
      declare: declare$2,
      sharedCode: [
          messageTokenToFloat,
          messageTokenToString,
          bangUtils,
      ],
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$2 = {
      floatValues: 1,
      stringValues: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const builder = {
      translateArgs: ({ args }) => ({
          typeArguments: (args.length ? args : ['float']).map(resolveTypeArgumentAlias)
              // Not sure why but 'bang' is supported as a creation argument, 
              // but turned into a float.
              .map(typeArg => {
              if (typeArg === 'bang') {
                  typeArg = 'float';
              }
              if (typeof typeArg === 'number') {
                  return typeArg;
              }
              else if (!['float', 'symbol'].includes(typeArg)) {
                  throw new Error(`${typeArg} not supported (yet)`);
              }
              return typeArg;
          })
              .map(value => [
              typeof value === 'number' ? 'float' : assertTypeArgument(value),
              typeof value === 'number' ? value : value === 'float' ? 0 : 'symbol'
          ]),
      }),
      build: (args) => ({
          inlets: mapArray(args.typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare$1 = ({ node: { args }, state, macros: { Var }, }) => renderCode `
    const ${Var(state.floatValues, 'Array<Float>')} = [${args.typeArguments.map(([typeArg, defaultValue]) => `${typeArg === 'float' ? defaultValue : 0}`).join(',')}]
    const ${Var(state.stringValues, 'Array<string>')} = [${args.typeArguments.map(([typeArg, defaultValue]) => `${typeArg === 'symbol' ? `"${defaultValue}"` : '""'}`).join(',')}]
`;
  // ------------------------------- messages ------------------------------ //
  const messages$1 = ({ snds, globs, state, node, macros: { Var } }) => ({
      '0': renderCode `
    if (!msg_isBang(${globs.m})) {
        for (let ${Var('i', 'Int')} = 0; i < msg_getLength(${globs.m}); i++) {
            ${state.stringValues}[i] = messageTokenToString(${globs.m}, i)
            ${state.floatValues}[i] = messageTokenToFloat(${globs.m}, i)
        }
    }

    const ${Var('template', 'MessageTemplate')} = [${node.args.typeArguments.map(([typeArg], i) => typeArg === 'symbol' ?
        `MSG_STRING_TOKEN,${state.stringValues}[${i}].length`
        : `MSG_FLOAT_TOKEN`).join(',')}]

    const ${Var('messageOut', 'Message')} = msg_create(template)

    ${node.args.typeArguments.map(([typeArg], i) => typeArg === 'symbol' ?
        `msg_writeStringToken(messageOut, ${i}, ${state.stringValues}[${i}])`
        : `msg_writeFloatToken(messageOut, ${i}, ${state.floatValues}[${i}])`)}

    ${snds[0]}(messageOut)
    return
    `,
      ...mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => [
          `${i + 1}`,
          renderSwitch([
              typeArg === 'symbol',
              `${state.stringValues}[${i + 1}] = messageTokenToString(${globs.m}, 0)`
          ], [
              typeArg === 'float',
              `${state.floatValues}[${i + 1}] = messageTokenToFloat(${globs.m}, 0)`
          ]) + ';return'
      ]),
  });
  // ------------------------------------------------------------------- //
  const nodeImplementation = {
      messages: messages$1,
      stateVariables: stateVariables$2,
      declare: declare$1,
      sharedCode: [messageTokenToString, messageTokenToFloat, bangUtils]
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables$1 = {
      floatInputs: 1,
      stringInputs: 1,
      outputs: 1,
  };
  // TODO : Implement if (`if(<test>, <then>, <else>)`)
  // ------------------------------- node builder ------------------------------ //
  const builderExpr = {
      translateArgs: ({ args }) => ({
          tokenizedExpressions: preprocessExpression(args).map(tokenizeExpression),
      }),
      build: (args) => ({
          inlets: mapArray(validateAndListInputsExpr(args.tokenizedExpressions), ({ id }) => [`${id}`, { type: 'message', id: `${id}` }]),
          outlets: mapArray(args.tokenizedExpressions, (_, i) => [
              `${i}`,
              { type: 'message', id: `${i}` },
          ]),
      }),
  };
  const builderExprTilde = {
      translateArgs: ({ args }) => ({
          tokenizedExpressions: preprocessExpression(args).map(tokenizeExpression),
      }),
      build: (args) => ({
          inlets: mapArray(validateAndListInputsExprTilde(args.tokenizedExpressions), ({ id, type }) => [
              `${id}`,
              { type: type === 'signal' ? 'signal' : 'message', id: `${id}` },
          ]),
          outlets: mapArray(args.tokenizedExpressions, (_, i) => [
              `${i}`,
              { type: 'signal', id: `${i}` },
          ]),
      }),
  };
  // ------------------------------- declare ------------------------------ //
  const declare = ({ node: { args, type }, state, macros: { Var }, }) => {
      const inputs = type === 'expr' ?
          validateAndListInputsExpr(args.tokenizedExpressions)
          : validateAndListInputsExprTilde(args.tokenizedExpressions)
              .filter(({ type }) => type !== 'signal');
      return renderCode `
        const ${Var(state.floatInputs, 'Map<Int, Float>')} = new Map()
        const ${Var(state.stringInputs, 'Map<Int, string>')} = new Map()
        const ${Var(state.outputs, 'Array<Float>')} = new Array(${args.tokenizedExpressions.length})
        ${inputs.filter(input => input.type === 'float' || input.type === 'int')
        .map(input => `${state.floatInputs}.set(${input.id}, 0)`)}
        ${inputs.filter(input => input.type === 'string')
        .map(input => `${state.stringInputs}.set(${input.id}, '')`)}
    `;
  };
  // ------------------------------- loop ------------------------------ //
  const loopExprTilde = ({ node: { args }, state, outs, ins, }) => `
    ${args.tokenizedExpressions.map((tokens, i) => `${outs[i]} = ${renderTokenizedExpression(state, ins, tokens)}`)}
`;
  // ------------------------------- messages ------------------------------ //
  const messages = ({ snds, globs, state, node: { args, type }, macros: { Var }, }) => {
      const inputs = type === 'expr' ?
          validateAndListInputsExpr(args.tokenizedExpressions)
          : validateAndListInputsExprTilde(args.tokenizedExpressions)
              .filter(({ type }) => type !== 'signal');
      const hasInput0 = inputs.length && inputs[0].id === 0;
      return {
          '0': renderCode `

        if (!msg_isBang(${globs.m})) {
            for (let ${Var('i', 'Int')} = 0; i < msg_getLength(${globs.m}); i++) {
                ${state.stringInputs}.set(i, messageTokenToString(${globs.m}, i))
                ${state.floatInputs}.set(i, messageTokenToFloat(${globs.m}, i))
            }
        }

        ${renderIf(type === 'expr', () => `
                ${args.tokenizedExpressions.map((tokens, i) => `${state.outputs}[${i}] = ${renderTokenizedExpression(state, null, tokens)}`)}
        
                ${args.tokenizedExpressions.map((_, i) => `${snds[`${i}`]}(msg_floats([${state.outputs}[${i}]]))`)}
            `)}
        
        return
        `,
          ...mapArray(inputs.slice(hasInput0 ? 1 : 0), ({ id, type }) => [
              `${id}`,
              renderSwitch([
                  type === 'float' || type === 'int',
                  `${state.floatInputs}.set(${id}, messageTokenToFloat(${globs.m}, 0));return`,
              ], [
                  type === 'string',
                  `${state.stringInputs}.set(${id}, messageTokenToString(${globs.m}, 0));return`,
              ])
          ])
      };
  };
  // ------------------------------------------------------------------- //
  const TOKENIZE_REGEXP = /(?<f>\$f(?<id_f>[0-9]+))|(?<v>\$v(?<id_v>[0-9]+))|(?<i>\$i(?<id_i>[0-9]+))|(?<s>\$s(?<id_s>[0-9]+)\s*\[(?<sIndex>[^\[\]]*)\])/;
  const tokenizeExpression = (expression) => {
      let match;
      let tokens = [];
      while (match = TOKENIZE_REGEXP.exec(expression)) {
          if (match.index) {
              tokens.push({
                  type: 'raw',
                  content: expression.slice(0, match.index)
              });
          }
          if (match.groups['f']) {
              tokens.push({
                  type: 'float',
                  id: parseInt(match.groups['id_f']) - 1,
              });
          }
          else if (match.groups['v']) {
              tokens.push({
                  type: 'signal',
                  id: parseInt(match.groups['id_v']) - 1,
              });
          }
          else if (match.groups['i']) {
              tokens.push({
                  type: 'int',
                  id: parseInt(match.groups['id_i']) - 1,
              });
              // Symbols in an expr are used normally only to index an array.
              // Since we need to cast to an int to index an array, we need 
              // to wrap the indexing expression with a cast to int :
              // $s1[$i1 + 2] -> $s1[toInt($i1 + 2)]
          }
          else if (match.groups['s']) {
              tokens = [
                  ...tokens,
                  {
                      type: 'string',
                      id: parseInt(match.groups['id_s']) - 1,
                  },
                  {
                      type: 'indexing-start'
                  },
                  ...tokenizeExpression(match.groups['sIndex']),
                  {
                      type: 'indexing-end'
                  },
              ];
          }
          expression = expression.slice(match.index + match[0].length);
      }
      if (expression.length) {
          tokens.push({
              type: 'raw',
              content: expression
          });
      }
      return tokens;
  };
  const renderTokenizedExpression = (state, ins, tokens) => tokens.map(token => {
      switch (token.type) {
          case 'float':
              return `${state.floatInputs}.get(${token.id})`;
          case 'signal':
              if (ins === null) {
                  throw new Error(`invalid token signal received`);
              }
              return ins[token.id];
          case 'int':
              return `roundFloatAsPdInt(${state.floatInputs}.get(${token.id}))`;
          case 'string':
              return `commons_getArray(${state.stringInputs}.get(${token.id}))`;
          case 'indexing-start':
              return '[toInt(';
          case 'indexing-end':
              return ')]';
          case 'raw':
              return token.content;
      }
  }).join('');
  const listInputs = (tokenizedExpressions) => {
      const inputs = [];
      tokenizedExpressions.forEach(tokenizedExpression => {
          tokenizedExpression.forEach(token => {
              if (token.type === 'float'
                  || token.type === 'signal'
                  || token.type === 'int'
                  || token.type === 'string') {
                  inputs.push(token);
              }
          });
      });
      // Sort so that input 0 appears first if it exists
      inputs.sort(({ id: i1 }, { id: i2 }) => i1 - i2);
      const inputsMap = new Map();
      return inputs.filter(token => {
          if (inputsMap.has(token.id)) {
              if (inputsMap.get(token.id).type !== token.type) {
                  throw new Error(`contradictory definitions for input ${token.id}`);
              }
              return false;
          }
          else {
              inputsMap.set(token.id, token);
              return true;
          }
      });
  };
  const validateAndListInputsExpr = (tokenizedExpressions) => {
      const inputs = listInputs(tokenizedExpressions);
      inputs.forEach(input => {
          if (input.type === 'signal') {
              throw new Error(`invalid signal token $v# for [expr]`);
          }
      });
      return inputs;
  };
  const validateAndListInputsExprTilde = (tokenizedExpressions) => {
      return listInputs(tokenizedExpressions);
  };
  const preprocessExpression = (args) => {
      let expression = args.join(' ');
      // Get all Math functions from the expression and prefix them with `Math.`
      Object.getOwnPropertyNames(Math).forEach(funcName => {
          expression = expression.replaceAll(funcName, `Math.${funcName}`);
      });
      // Split the several outputs from the expression
      return expression.split(';')
          .map(expression => expression.trim());
  };
  const nodeImplementations$1 = {
      'expr': {
          messages,
          stateVariables: stateVariables$1,
          declare,
          sharedCode: [
              messageTokenToString,
              messageTokenToFloat,
              roundFloatAsPdInt,
              bangUtils,
          ],
      },
      'expr~': {
          messages,
          stateVariables: stateVariables$1,
          declare,
          loop: loopExprTilde,
          sharedCode: [
              messageTokenToString,
              messageTokenToFloat,
              roundFloatAsPdInt,
              bangUtils,
          ],
      },
  };
  const builders$1 = {
      'expr': builderExpr,
      'expr~': builderExprTilde,
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const stateVariables = {
      leftOp: 1,
      rightOp: 1,
      funcSetRightOp: 1,
      funcSetLeftOp: 1,
  };
  // ------------------------------- node builder ------------------------------ //
  const makeBuilder = (defaultValue) => ({
      translateArgs: (pdNode) => {
          const value = assertOptionalNumber(pdNode.args[0]);
          return {
              value: value !== undefined ? value : defaultValue,
          };
      },
      build: () => ({
          inlets: {
              '0': { type: 'message', id: '0' },
              '1': { type: 'message', id: '1' },
          },
          outlets: {
              '0': { type: 'message', id: '0' },
          },
      }),
  });
  const makeNodeImplementation = ({ generateOperation, prepareLeftOp = 'value', prepareRightOp = 'value', }) => {
      // ------------------------------ declare ------------------------------ //
      const declare = ({ state, macros: { Var, Func }, node: { args }, }) => `
        let ${Var(state.leftOp, 'Float')} = 0
        let ${Var(state.rightOp, 'Float')} = 0

        const ${state.funcSetLeftOp} = ${Func([
        Var('value', 'Float')
    ], 'void')} => {
            ${state.leftOp} = ${prepareLeftOp}
        }

        const ${state.funcSetRightOp} = ${Func([
        Var('value', 'Float')
    ], 'void')} => {
            ${state.rightOp} = ${prepareRightOp}
        }

        ${state.funcSetLeftOp}(0)
        ${state.funcSetRightOp}(${args.value})
    `;
      // ------------------------------- messages ------------------------------ //
      const messages = ({ state, globs, snds, }) => ({
          '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            ${state.funcSetLeftOp}(msg_readFloatToken(${globs.m}, 0))
            ${snds.$0}(msg_floats([${generateOperation(state)}]))
            return
        
        } else if (msg_isBang(${globs.m})) {
            ${snds.$0}(msg_floats([${generateOperation(state)}]))
            return
        }
        `,
          '1': coldFloatInletWithSetter(globs.m, state.funcSetRightOp),
      });
      return {
          declare,
          messages,
          stateVariables,
          sharedCode: [bangUtils],
      };
  };
  // ------------------------------------------------------------------- //
  const nodeImplementations = {
      '+': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} + ${state.rightOp}`
      }),
      '-': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} - ${state.rightOp}`
      }),
      '*': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} * ${state.rightOp}`
      }),
      '/': makeNodeImplementation({
          generateOperation: (state) => `${state.rightOp} !== 0 ? ${state.leftOp} / ${state.rightOp}: 0`
      }),
      'mod': makeNodeImplementation({
          prepareRightOp: `Math.floor(Math.abs(value))`,
          // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly : 
          // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
          // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
          generateOperation: (state) => `${state.rightOp} !== 0 ? (${state.rightOp} + (${state.leftOp} % ${state.rightOp})) % ${state.rightOp}: 0`
      }),
      'pow': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} > 0 || (Math.round(${state.rightOp}) === ${state.rightOp}) ? Math.pow(${state.leftOp}, ${state.rightOp}): 0`
      }),
      '||': makeNodeImplementation({
          prepareLeftOp: `Math.floor(Math.abs(value))`,
          prepareRightOp: `Math.floor(Math.abs(value))`,
          generateOperation: (state) => `${state.leftOp} || ${state.rightOp} ? 1: 0`
      }),
      '&&': makeNodeImplementation({
          prepareLeftOp: `Math.floor(Math.abs(value))`,
          prepareRightOp: `Math.floor(Math.abs(value))`,
          generateOperation: (state) => `${state.leftOp} && ${state.rightOp} ? 1: 0`
      }),
      '>': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} > ${state.rightOp} ? 1: 0`
      }),
      '>=': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} >= ${state.rightOp} ? 1: 0`
      }),
      '<': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} < ${state.rightOp} ? 1: 0`
      }),
      '<=': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} <= ${state.rightOp} ? 1: 0`
      }),
      '==': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} == ${state.rightOp} ? 1: 0`
      }),
      '!=': makeNodeImplementation({
          generateOperation: (state) => `${state.leftOp} != ${state.rightOp} ? 1: 0`
      }),
  };
  const builders = {
      '+': makeBuilder(0),
      '-': makeBuilder(0),
      '*': makeBuilder(1),
      '/': makeBuilder(1),
      'mod': makeBuilder(0),
      'pow': makeBuilder(0),
      '||': makeBuilder(0),
      '&&': makeBuilder(0),
      '>': makeBuilder(0),
      '>=': makeBuilder(0),
      '<': makeBuilder(0),
      '<=': makeBuilder(0),
      '==': makeBuilder(0),
      '!=': makeBuilder(0),
  };

  /*
   * Copyright (c) 2012-2020 Sébastien Piquemal <sebpiq@gmail.com>
   *
   * BSD Simplified License.
   * For information on usage and redistribution, and for a DISCLAIMER OF ALL
   * WARRANTIES, see the file, "LICENSE.txt," in this distribution.
   *
   * See https://github.com/sebpiq/WebPd_pd-parser for documentation
   *
   */
  const NODE_BUILDERS = {
      ...builders$4,
      ...builders$8,
      ...builders$9,
      ...builders$2,
      ...builders$3,
      'noise~': builder$c,
      'snapshot~': builder$t,
      'sig~': builder$u,
      'clip~': builder$v,
      'vline~': builder$s,
      'dac~': builder$y,
      'adc~': builder$x,
      'tabplay~': builder$q,
      'readsf~': builder$p,
      'writesf~': builder$o,
      'mixer~': builder$d,
      'vd~': { aliasTo: 'delread4~' },
      'bp~': builder$n,
      'delwrite~': builder$a,
      'throw~': builder$m,
      'catch~': builder$l,
      ...builders$7,
      ...builders,
      ...builders$5,
      ...builders$6,
      ...builders$1,
      bng: builder$h,
      loadbang: builder$g,
      print: builder$6,
      trigger: builder$5,
      t: { aliasTo: 'trigger' },
      change: builder$4,
      clip: builder$2,
      pipe: builder$1,
      moses: builder$3,
      pack: builder,
      msg: builder$8,
      metro: builder$k,
      timer: builder$j,
      delay: builder$i,
      del: { aliasTo: 'delay' },
      soundfiler: builder$7,
      // The following don't need implementations as they will never
      // show up in the graph traversal.
      graph: { isNoop: true },
      array: { isNoop: true },
      text: { isNoop: true },
      cnv: { isNoop: true },
      'block~': { isNoop: true },
  };
  const NODE_IMPLEMENTATIONS = {
      ...nodeImplementations$4,
      ...nodeImplementations$8,
      ...nodeImplementations$9,
      ...nodeImplementations$2,
      ...nodeImplementations$3,
      'noise~': nodeImplementation$a,
      'snapshot~': nodeImplementation$o,
      'sig~': nodeImplementation$p,
      'clip~': nodeImplementation$q,
      'vline~': nodeImplementation$n,
      'mixer~': nodeImplementation$b,
      'dac~': nodeImplementation$s,
      'adc~': nodeImplementation$r,
      'tabplay~': nodeImplementation$m,
      'readsf~': nodeImplementation$l,
      'writesf~': nodeImplementation$k,
      'delwrite~': nodeImplementation$9,
      'bp~': nodeImplementation$j,
      'throw~': nodeImplementation$i,
      'catch~': nodeImplementation$h,
      ...nodeImplementations$7,
      ...nodeImplementations,
      ...nodeImplementations$6,
      ...nodeImplementations$5,
      ...nodeImplementations$1,
      bng: nodeImplementation$d,
      loadbang: nodeImplementation$c,
      print: nodeImplementation$6,
      trigger: nodeImplementation$5,
      change: nodeImplementation$4,
      clip: nodeImplementation$2,
      pipe: nodeImplementation$1,
      moses: nodeImplementation$3,
      pack: nodeImplementation,
      msg: nodeImplementation$8,
      metro: nodeImplementation$g,
      timer: nodeImplementation$f,
      delay: nodeImplementation$e,
      soundfiler: nodeImplementation$7,
  };

  const waitAscCompiler = async () => {
      return new Promise((resolve) => {
          const _waitRepeat = () => {
              setTimeout(() => {
                  if (window.asc) {
                      resolve();
                  } else _waitRepeat();
              }, 200);
          };
          _waitRepeat();        
      })
  };

  const compileAsc = async (code, bitDepth) => {
      const compileOptions = {
          optimizeLevel: 3,
          runtime: "incremental",
          exportRuntime: true,
      };
      if (bitDepth === 32) {
          // For 32 bits version of Math
          compileOptions.use = ['Math=NativeMathf'];
      }
      const { error, binary, stderr } = await window.asc.compileString(code, compileOptions);
      if (error) {
          console.error(code);
          throw new Error(stderr.toString())
      }
      return binary.buffer
  };

  const BIT_DEPTH = 32;

  const createEngine = async (STATE) => {
      const { pdJson, controls, audioContext } = STATE;
      const { target } = STATE.params;
      const dspGraph = toDspGraph(pdJson, NODE_BUILDERS);
      const inletCallerSpecs = _collectInletCallerSpecs(controls, dspGraph);
      const arrays = Object.values(pdJson.arrays).reduce(
          (arrays, array) => ({
              ...arrays,
              [array.args[0]]: array.data
                  ? new Float32Array(array.data)
                  : new Float32Array(array.args[1]),
          }),
          {}
      );

      const code = compile(dspGraph, NODE_IMPLEMENTATIONS, {
          target,
          inletCallerSpecs,
          audioSettings: {
              bitDepth: BIT_DEPTH,
              channelCount: { in: 0, out: 2 },
          },
      });

      const webpdNode = new WebPdWorkletNode(audioContext);
      webpdNode.connect(audioContext.destination);
      webpdNode.port.onmessage = (message) => index(webpdNode, message);
      if (target === 'javascript') {
          webpdNode.port.postMessage({
              type: 'code:JS',
              payload: {
                  jsCode: code,
                  arrays,
              },
          });
      } else if (target === 'assemblyscript') {
          const wasmBuffer = await compileAsc(
              code,
              BIT_DEPTH
          );
          webpdNode.port.postMessage({
              type: 'code:WASM',
              payload: {
                  wasmBuffer,
                  arrays,
              },
          });
      }
      return webpdNode
  };

  const _collectInletCallerSpecs = (controls, dspGraph, inletCallerSpecs = {}) => {
      controls.forEach((control) => {
          if (control.type === 'container') {
              inletCallerSpecs = _collectInletCallerSpecs(control.children, dspGraph, inletCallerSpecs);
          } else if (control.type === 'control') {
              const nodeId = buildGraphNodeId(control.patch.id, control.node.id);
              const portletId = PORTLET_ID;
              if (!dspGraph[nodeId]) { return }
              inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || [];
              inletCallerSpecs[nodeId].push(portletId);
          } else {
              throw new Error(`invalid type ${control.type}`)
          }
      });
      return inletCallerSpecs
  };

  const CONTAINER_PADDING = 0.5;
  const GRID_DETECT_THRESHOLD_PX = 5;

  const createViews = (STATE, controls = null) => {
      if (controls === null) {
          controls = STATE.controls;
      }

      const controlsViews = controls.map((control) => {
          if (control.type === 'container') {
              const nestedViews = createViews(STATE, control.children);
              return _buildContainerView(control, nestedViews)
          } else if (control.type === 'control') {
              return _buildControlView(control)
          }
      });

      _computeLayout(controlsViews)
          .forEach((column) =>
              column
                  .filter((cell) => !!cell.controlView)
                  .forEach(
                      (cell) => (cell.controlView.position = { x: cell.x, y: cell.y })
                  )
          );
      
      return controlsViews.filter(controlView => {
          // Can happen if 2 controls overlap, then only one of them will be placed in the grid 
          if (!controlView.position) {
              console.warn(`control view "${controlView.label}" could not be assigned a position`);
          }
          return controlView.position
      })
  };

  const _buildContainerView = (control, children) => ({
      type: 'container',
      label: control.node.args[0] || null,
      control,
      dimensions: addPoints(
          { x: CONTAINER_PADDING * 2, y: CONTAINER_PADDING * 2 },
          computeRectangleDimensions(
              computePointsBoundingBox([
                  ...children.map((c) => c.position),
                  ...children.map((c) => addPoints(c.position, c.dimensions)),
              ])
          )
      ),
      children,
      position: null,
  });

  const _buildControlView = (control) => ({
      type: 'control',
      label: (control.node.layout.label && control.node.layout.label.length) ? control.node.layout.label : null,
      control,
      dimensions: _getDimensionsGrid(control.node.type, control.node.args),
      position: null,
  });

  const _getDimensionsGrid = (nodeType, nodeArgs) => {
      switch (nodeType) {
          case 'floatatom':
          case 'symbolatom':
              return { x: 4, y: 2 }
          case 'bng':
          case 'tgl':
              return { x: 2, y: 2 }
          case 'nbx':
              return { x: 4, y: 2 }
          case 'vradio':
              return { x: 2, y: 2 * nodeArgs[0] }
          case 'hradio':
              return { x: 2 * nodeArgs[0], y: 2 }
          case 'vsl':
              return { x: 2, y: 8 }
          case 'hsl':
              return { x: 8, y: 2 }
          case 'msg':
              return { x: Math.round(nodeArgs.join(' ').length), y: 2 }
          default:
              throw new Error(`unsupported type ${nodeType}`)
      }
  };

  const _computeLayout = (controlsViews) => {
      const roughGrid = {
          x: {
              // controlsViews grouped by column
              grouped: [],
              // X for each column
              coordinates: [],
              // width for each column
              sizes: [],
          },
          y: {
              // controlsViews grouped by row
              grouped: [],
              // Y for each row
              coordinates: [],
              // height for each column
              sizes: [],
          },
      };

      // Start by creating a rough grid which groups the control views by rows
      // and by columns. 
      Object.keys(roughGrid).forEach((axis) => {
          const grouped = roughGrid[axis].grouped;
          const getCoordinate = (c) => c.control.node.layout[axis];
          controlsViews.forEach((controlView) => {
              const inserted = grouped.some((rowsOrColumns) => {
                  // Try to assign `controlView` to an existing row or column
                  if (
                      rowsOrColumns.some(
                          (otherControlView) =>
                              Math.abs(
                                  getCoordinate(controlView) -
                                      getCoordinate(otherControlView)
                              ) < GRID_DETECT_THRESHOLD_PX
                      )
                  ) {
                      rowsOrColumns.push(controlView);
                      return true
                  }
              });

              // If it could not be inserted to an existing one, we create a new rowOrColumn,
              // and insert it in the right place in the list of rowsOrColumns.
              if (!inserted) {
                  let i = 0;
                  while (
                      i < grouped.length &&
                      getCoordinate(grouped[i][0]) < getCoordinate(controlView)
                  ) {
                      i++;
                  }
                  grouped.splice(i, 0, [controlView]);
              }

              // Assigns the coordinate for the row or column by taking
              // sizes of the largest controls in each column or row.
              // and stacking these max sizes.
              roughGrid[axis].sizes = grouped.map(
                  (rowOrCol) =>
                      Math.max(
                          ...rowOrCol.map(
                              (controlView) => controlView.dimensions[axis]
                          )
                      ),
                  []
              );

              roughGrid[axis].coordinates = roughGrid[axis].sizes
                  .slice(0, -1)
                  .reduce((coords, size) => [...coords, coords.slice(-1)[0] + size], [0]);
          });
      });

      // Create a grid by placing controlViews in cells (col, row).
      const grid = roughGrid.x.grouped.map((column, colInd) =>
          roughGrid.y.grouped.map((row, rowInd) => {
              const controlView = row.filter((controlView) =>
                  column.includes(controlView)
              )[0];
              return {
                  x: roughGrid.x.coordinates[colInd],
                  y: roughGrid.y.coordinates[rowInd],
                  width: controlView ? controlView.dimensions.x: 0,
                  controlView: controlView || null,
              }
          })
      );

      // Pack the layout more compactly by moving left all columns 
      // that can be.
      grid.forEach((column, colInd) => {
          let dX = column[0].x;
          column
              .forEach((cell, rowInd) => {
                  if (cell.controlView === null) {
                      return
                  }
                  grid.slice(0, colInd)
                      .map((otherColumn) => otherColumn[rowInd])
                      .forEach((otherCell) => {
                          if (otherCell.controlView === null) {
                              return
                          }
                          dX = Math.min(
                              dX,
                              cell.x - (otherCell.x + otherCell.width)
                          );
                      });
              });
          if (dX) {
              grid.slice(colInd).forEach((column, j) => {
                  column.forEach((cell) => (cell.x -= dX));
              });
          }
      });

      return grid
  };

  const GRID_SIZE_PX = 30;
  const LABEL_HEIGHT_GRID = 0.6;

  const render = (STATE, parent, controlsViews = null) => {
      if (controlsViews === null) {
          controlsViews = STATE.controlsViews;
      }
      controlsViews.forEach((controlView) => {
          if (controlView.type === 'container') {
              const childrenContainerElem = _renderContainer(STATE, parent, controlView);
              render(STATE, childrenContainerElem, controlView.children);
          } else if (controlView.type === 'control') {
              _renderControl(STATE, parent, controlView);
          } else {
              throw new Error(`unexpected control type ${controlView.type}`)
          }
      });
  };

  const _renderControl = (STATE, parent, controlView) => {
      const { node, patch } = controlView.control;

      const color = STATE.colorScheme.next();

      const div = document.createElement('div');
      div.classList.add('control');
      div.id = `control-${patch.id}-${node.id}`;
      div.style.left = `${
        controlView.position.x * GRID_SIZE_PX + CONTAINER_PADDING * GRID_SIZE_PX
    }px`;
      div.style.top = `${
        controlView.position.y * GRID_SIZE_PX
    }px`;
      div.style.width = `${controlView.dimensions.x * GRID_SIZE_PX}px`;
      div.style.height = `${controlView.dimensions.y * GRID_SIZE_PX}px`;
      parent.appendChild(div);

      if (controlView.label) {
          const labelDiv = _renderLabel(div, controlView.label);
          labelDiv.style.color = color;
      }

      const innerDiv = document.createElement('div');
      div.appendChild(innerDiv);
      const nexusElem = _renderNexus(STATE, innerDiv, controlView);
      
      nexusElem.colorize('accent', color);
      nexusElem.colorize('fill', 'black');
      nexusElem.colorize('dark', color);
      nexusElem.colorize('mediumDark', '#222');
      nexusElem.colorize('mediumLight', '#333');

      return div
  };

  const _renderContainer = (_, parent, controlView) => {
      const div = document.createElement('div');
      div.classList.add('controls-container');

      div.style.left = `${controlView.position.x * GRID_SIZE_PX}px`;
      div.style.top = `${controlView.position.y * GRID_SIZE_PX}px`;
      div.style.width = `${(controlView.dimensions.x - CONTAINER_PADDING) * GRID_SIZE_PX}px`;
      div.style.height = `${
        (controlView.dimensions.y - CONTAINER_PADDING) * GRID_SIZE_PX
    }px`;
      div.style.padding = `${CONTAINER_PADDING * 0.5 * GRID_SIZE_PX}px`;
      if (controlView.label) {
          _renderLabel(div, controlView.label);
      }

      parent.appendChild(div);
      return div
  };

  const _renderLabel = (parent, label) => {
      const labelDiv = document.createElement('div');
      labelDiv.classList.add('label');
      labelDiv.innerHTML = label;
      parent.appendChild(labelDiv);
      return labelDiv
  };

  const _renderNexus = (STATE, div, controlView) => {
      const { node, patch } = controlView.control;
      const nodeId = buildGraphNodeId(patch.id, node.id);
      const width = controlView.dimensions.x * GRID_SIZE_PX;
      const height = (controlView.dimensions.y - LABEL_HEIGHT_GRID) * GRID_SIZE_PX;
      const storedValue = STATE.controlsValues.get(nodeId);

      let nexusElem;
      switch (node.type) {
          case 'hsl':
          case 'vsl':
              nexusElem = new Nexus.Add.Slider(div, {
                  min: node.args[0],
                  max: node.args[1],
                  value: storedValue !== undefined ? storedValue : node.args[3],
                  size: [width, height],
              });
              break

          case 'hradio':
          case 'vradio':
              nexusElem = new Nexus.RadioButton(div, {
                  numberOfButtons: node.args[0],
                  active: storedValue !== undefined ? storedValue : node.args[2],
                  size: [width * 0.9, height * 0.9],
              });
              break

          case 'bng':
              nexusElem = new Nexus.Button(div, {
                  size: [height, height],
              });
              break

          case 'msg':
              nexusElem = new Nexus.TextButton(div, {
                  size: [width, height],
                  text: node.args.join(' ')
              });
              break

          case 'nbx':
          case 'floatatom':
              nexusElem = new Nexus.Number(div, {
                  value: storedValue !== undefined ? storedValue : (node.type === 'nbx' ? node.args[3] : 0),
                  size: [width, height],
              });
              break

          case 'tgl':
              nexusElem = new Nexus.Toggle(div, {
                  state: storedValue !== undefined ? storedValue : (!!node.args[2]),
                  size: [width, height],
              });
              break

          default:
              throw new Error(`Not supported ${node.type}`)
      }

      let msgBuilder = (v) => [v];
      if (node.type === 'bng' || node.type === 'msg') {
          msgBuilder = () => ['bang'];
      } else if (node.type === 'tgl') {
          msgBuilder = (v) => [+v];
      }

      STATE.controlsValues.register(nodeId, msgBuilder);
      nexusElem.on('change', (v) => STATE.controlsValues.set(nodeId, v));
      return nexusElem
  };

  const generateColorScheme = (STATE) => {
      const colors = [];
      const colorCount = 10;
      const colorSchemeSelector = STATE.pdJson.patches[0].connections.length % 2;

      switch (colorSchemeSelector) {
          case 0:
              for (let i = 0; i < colorCount; i++) {
                  const r = 0;
                  const g = 180 + (colorCount - i) * (240 - 180) / colorCount;
                  const b = 100 + i * 150 / colorCount;
                  colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
              }
              break
          case 1:
              for (let i = 0; i < colorCount; i++) {
                  const r = 160 + i * 95 / colorCount;
                  const b = 80 + (colorCount - i) * 100 / colorCount;
                  const g = 0;
                  colors.push(`rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
              }
              break
      }

      return {
          counter: 0,
          next () {
              return colors[this.counter++ % colors.length]
          }
      }
  };

  const nextTick = () => new Promise((resolve) => setTimeout(resolve, 1));

  const sendMsgToWebPd = (STATE, nodeId, msg) => {
      STATE.webpdNode.port.postMessage({
          type: 'inletCaller',
          payload: {
              nodeId,
              portletId: PORTLET_ID,
              message: msg,
          },
      });
  };

  const loadStateFromUrl = () => {
      const rawParams = new URLSearchParams(document.location.search);
      STATE.params = {
          patch: rawParams.get('patch') || './ginger2.pd',
          target: rawParams.get('target')  || 'javascript',
      };

      // We consider that all other unknown params are control values
      Array.from(rawParams).forEach(([key, rawValue]) => {
          if (!(key in STATE.params)) {
              const value = JSON.parse(rawValue);
              STATE.controlsValues._values[key] = value;
          }
      });
  };

  const STATE = {
      audioContext: new AudioContext(),
      webpdNode: null,
      pdJson: null,
      controls: null,
      controlsViews: null,
      controlsValues: {
          _values: {},
          _msgBuilders: {},
          set(nodeId, value) {
              this._values[nodeId] = value;

              const url = new URL(window.location);
              Object.entries(this._values).forEach(([nodeId, value]) => {
                  url.searchParams.set(nodeId, JSON.stringify(value));
              });
              window.history.replaceState({}, document.title, url);

              const msgBuilder = this._msgBuilders[nodeId];
              if (!msgBuilder) {
                  throw new Error(`no message builder for ${nodeId}`)
              }
              sendMsgToWebPd(STATE, nodeId, msgBuilder(value));
          },
          get(nodeId) {
              return this._values[nodeId]
          },
          register(nodeId, msgBuilder) {
              this._msgBuilders[nodeId] = msgBuilder;
          },
          initialize() {
              Object.entries(this._values).forEach(([nodeId, value]) => {
                  this.set(nodeId, value);
              });
          }
      },
  };

  const ELEMS = {
      controlsRoot: document.querySelector('#controls-root'),
      startButton: document.querySelector('#start'),
      creditsContainer: document.querySelector('#credits'),
      creditsButton: document.querySelector('#credits button'),
      loadingLabel: document.querySelector('#loading'),
      loadingContainer: document.querySelector('#splash-container')
  };

  ELEMS.creditsButton.onclick = () => {
      if (ELEMS.creditsContainer.classList.contains('expanded')) {
          ELEMS.creditsContainer.classList.remove('expanded');
      } else {
          ELEMS.creditsContainer.classList.add('expanded');
      }
  };

  ELEMS.startButton.style.display = 'none';
  ELEMS.startButton.onclick = () => {
      ELEMS.loadingContainer.style.display = 'none';
      startSound();
  };

  const startSound = () => {
      // https://github.com/WebAudio/web-audio-api/issues/345
      if (STATE.audioContext.state === 'suspended') {
          STATE.audioContext.resume();
      }
      STATE.controlsValues.initialize();
  };

  const initializeApp = async () => {
      loadStateFromUrl();

      ELEMS.loadingLabel.innerHTML = 'loading assemblyscript compiler ...';
      await waitAscCompiler();
      await registerWebPdWorkletNode(STATE.audioContext);

      ELEMS.loadingLabel.innerHTML = `downloading patch ${STATE.params.patch} ...`;
      STATE.pdJson = await loadPdJson(STATE.params.patch);

      ELEMS.loadingLabel.innerHTML = 'generating GUI ...';
      await nextTick();

      STATE.controls = createModels(STATE);
      STATE.controlsViews = createViews(STATE);
      STATE.colorScheme = generateColorScheme(STATE);
      render(STATE, ELEMS.controlsRoot);

      ELEMS.loadingLabel.innerHTML = `compiling${STATE.params.target === 'assemblyscript' ? ' Web Assembly ': ' '}engine ...`;
      await nextTick();

      STATE.webpdNode = await createEngine(STATE);
  };

  initializeApp()
      .then(() => {
          ELEMS.loadingLabel.style.display = 'none';
          ELEMS.startButton.style.display = 'block';
          console.log('APP READY');
      })
      .catch((err) => {
          ELEMS.loadingLabel.innerHTML = 'ERROR :( <br/>' + err.message;
          console.error(err);
      });

})();
//# sourceMappingURL=bundle.js.map
