console.log('IMPORTING WebPdWasmBindings')

globalThis.WebPdWasmBindings = (function (exports) {
    'use strict';

    const MESSAGE_DATUM_TYPE_STRING = Symbol.for('MESSAGE_DATUM_TYPE_STRING');
    const MESSAGE_DATUM_TYPE_FLOAT = Symbol.for('MESSAGE_DATUM_TYPE_FLOAT');

    const MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT = {
        [MESSAGE_DATUM_TYPE_FLOAT]: 0,
        [MESSAGE_DATUM_TYPE_STRING]: 1,
    };
    const INT_ARRAY_BYTES_PER_ELEMENT = Int32Array.BYTES_PER_ELEMENT;
    const setArray = (engine, arrayName, data) => {
        const stringPointer = lowerString(engine, arrayName);
        const bufferPointer = lowerArrayBufferOfFloats(engine, data, engine.getBitDepth());
        engine.setArray(stringPointer, bufferPointer);
    };
    const bindPorts = (engine, portSpecs) => {
        const ports = {};
        Object.entries(portSpecs).forEach(([variableName, spec]) => {
            if (spec.access.includes('w')) {
                if (spec.type === 'messages') {
                    ports[`write_${variableName}`] = (messages) => {
                        const messageArrayPointer = lowerMessageArray(engine, messages);
                        engine[`write_${variableName}`](messageArrayPointer);
                    };
                }
                else {
                    ports[`write_${variableName}`] = engine[`write_${variableName}`];
                }
            }
            if (spec.access.includes('r')) {
                if (spec.type === 'messages') {
                    ports[`read_${variableName}`] = () => {
                        const messagesCount = engine[`read_${variableName}_length`]();
                        const messages = [];
                        for (let i = 0; i < messagesCount; i++) {
                            const messagePointer = engine[`read_${variableName}_elem`](i);
                            messages.push(liftMessage(engine, messagePointer));
                        }
                        return messages;
                    };
                }
                else {
                    ports[`read_${variableName}`] = engine[`read_${variableName}`];
                }
            }
        });
        return ports;
    };
    const lowerMessage = (engine, message) => {
        const messageTemplate = message.reduce((template, value) => {
            if (typeof value === 'number') {
                template.push(engine.MESSAGE_DATUM_TYPE_FLOAT.valueOf());
            }
            else if (typeof value === 'string') {
                template.push(engine.MESSAGE_DATUM_TYPE_STRING.valueOf());
                template.push(value.length);
            }
            else {
                throw new Error(`invalid message value ${value}`);
            }
            return template;
        }, []);
        const messagePointer = engine.createMessage(lowerArrayBufferOfIntegers(engine, messageTemplate));
        message.forEach((value, index) => {
            if (typeof value === 'number') {
                engine.writeFloatDatum(messagePointer, index, value);
            }
            else if (typeof value === 'string') {
                const stringPointer = lowerString(engine, value);
                engine.writeStringDatum(messagePointer, index, stringPointer);
            }
        });
        return messagePointer;
    };
    const liftMessage = (engine, messagePointer) => {
        const messageDatumTypesPointer = engine.getMessageDatumTypes(messagePointer);
        const messageDatumTypes = liftTypedArray(engine, Int32Array, messageDatumTypesPointer);
        const message = [];
        messageDatumTypes.forEach((datumType, datumIndex) => {
            if (datumType === engine.MESSAGE_DATUM_TYPE_FLOAT.valueOf()) {
                message.push(engine.readFloatDatum(messagePointer, datumIndex));
            }
            else if (datumType === engine.MESSAGE_DATUM_TYPE_STRING.valueOf()) {
                const stringPointer = engine.readStringDatum(messagePointer, datumIndex);
                message.push(liftString(engine, stringPointer));
            }
        });
        return message;
    };
    const lowerMessageArray = (engine, messages) => {
        const messageArrayPointer = engine.createMessageArray();
        messages.forEach((message) => {
            engine.pushMessageToArray(messageArrayPointer, lowerMessage(engine, message));
        });
        return messageArrayPointer;
    };
    const lowerArrayBufferOfIntegers = (engine, integers) => {
        const buffer = new ArrayBuffer(INT_ARRAY_BYTES_PER_ELEMENT * integers.length);
        const dataView = new DataView(buffer);
        for (let i = 0; i < integers.length; i++) {
            dataView.setInt32(INT_ARRAY_BYTES_PER_ELEMENT * i, integers[i]);
        }
        return lowerBuffer(engine, buffer);
    };
    const lowerArrayBufferOfFloats = (engine, floats, bitDepth) => {
        const bytesPerElement = bitDepth / 8;
        const buffer = new ArrayBuffer(bytesPerElement * floats.length);
        const dataView = new DataView(buffer);
        const setFloatName = bitDepth === 32 ? 'setFloat32' : 'setFloat64';
        for (let i = 0; i < floats.length; i++) {
            dataView[setFloatName](bytesPerElement * i, floats[i]);
        }
        return lowerBuffer(engine, buffer);
    };
    const liftTypedArray = (engine, constructor, pointer) => {
        if (!pointer)
            return null;
        const memoryU32 = new Uint32Array(engine.memory.buffer);
        return new constructor(engine.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT).slice();
    };
    const liftString = (engine, pointer) => {
        if (!pointer)
            return null;
        pointer = pointer >>> 0;
        const end = (pointer +
            new Uint32Array(engine.memory.buffer)[(pointer - 4) >>> 2]) >>>
            1;
        const memoryU16 = new Uint16Array(engine.memory.buffer);
        let start = pointer >>> 1;
        let string = '';
        while (end - start > 1024) {
            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
        }
        return string + String.fromCharCode(...memoryU16.subarray(start, end));
    };
    const lowerString = (engine, value) => {
        if (value == null)
            return 0;
        const length = value.length, pointer = engine.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(engine.memory.buffer);
        for (let i = 0; i < length; ++i)
            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
        return pointer;
    };
    const lowerBuffer = (engine, value) => {
        if (value == null)
            return 0;
        const pointer = engine.__new(value.byteLength, 0) >>> 0;
        new Uint8Array(engine.memory.buffer).set(new Uint8Array(value), pointer);
        return pointer;
    };

    exports.INT_ARRAY_BYTES_PER_ELEMENT = INT_ARRAY_BYTES_PER_ELEMENT;
    exports.MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT = MESSAGE_DATUM_TYPES_ASSEMBLYSCRIPT;
    exports.bindPorts = bindPorts;
    exports.liftMessage = liftMessage;
    exports.liftString = liftString;
    exports.liftTypedArray = liftTypedArray;
    exports.lowerArrayBufferOfFloats = lowerArrayBufferOfFloats;
    exports.lowerArrayBufferOfIntegers = lowerArrayBufferOfIntegers;
    exports.lowerMessage = lowerMessage;
    exports.lowerMessageArray = lowerMessageArray;
    exports.lowerString = lowerString;
    exports.setArray = setArray;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=bindings.js.map
