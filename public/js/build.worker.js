const compileAssemblyscript = async (code, bitDepth) => {
    {
        throw new Error(`assemblyscript compiler was not set properly. Please use WebPd's setAsc function to initialize it.`);
    }
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// Regular expressions to detect escaped special chars.
const ESCAPED_DOLLAR_VAR_RE_GLOB = /\\(\$\d+)/g;
const ESCAPED_COMMA_VAR_RE_GLOB = /\\\\\\,/g;
const ESCAPED_SEMICOLON_VAR_RE_GLOB = /\\\\\\;/g;
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
    const parsed = parseInt(token, 10);
    if (isNaN(parsed)) {
        throw new ValueError(`Invalid int received`);
    }
    return parsed;
};
/** Parses a '0' or '1' from a .pd file. */
const parseBoolToken = (val) => {
    const parsed = parseFloatToken(val);
    if (parsed === 0 || parsed === 1) {
        return parsed;
    }
    throw new ValueError(`Should be 0 or 1`);
};
/** Unescape string args. */
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * @param coordsTokenizedLine Defined only if the patch declares a graph on its parent,
 * i.e. if the patch has a UI visible in its parent.
 */
const hydratePatch = (id, isRoot, canvasTokenizedLine, coordsTokenizedLine) => {
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
                viewportY: coordsTokens[10]
                    ? parseIntToken(coordsTokens[10])
                    : 0,
                viewportWidth: parseIntToken(coordsTokens[6]),
                viewportHeight: parseIntToken(coordsTokens[7]),
            };
        }
    }
    return {
        id,
        isRoot,
        layout,
        args: [],
        nodes: {},
        connections: [],
        inlets: [],
        outlets: [],
    };
};
const hydrateArray = (id, { tokens }) => {
    const arrayName = parseStringToken(tokens[2]);
    const arraySize = parseArg(tokens[3]);
    // Options flag :
    // first bit if for `saveContents` second for `drawAs`
    const optionsFlag = parseIntToken(tokens[5]);
    const saveContents = (optionsFlag % 2);
    const drawAs = ['polygon', 'points', 'bezier'][optionsFlag >>> 1];
    return {
        id,
        args: [arrayName, arraySize, saveContents],
        data: null,
        layout: {
            drawAs,
        },
    };
};
const hydrateNodePatch = (id, { tokens }) => {
    const canvasType = tokens[4];
    const args = [];
    if (canvasType !== 'pd' &&
        canvasType !== 'graph' &&
        canvasType !== 'table') {
        throw new Error(`unknown canvasType : ${canvasType}`);
    }
    // add subpatch name
    if (canvasType === 'pd' && tokens[5] !== undefined) {
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
    if (node.type === 'floatatom' ||
        node.type === 'symbolatom' ||
        node.type === 'listbox') {
        // <widthInChars> <lower_limit> <upper_limit> <label_pos> <label> <receive> <send>
        node.layout = {
            ...node.layout,
            widthInChars: parseFloatToken(args[0]),
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
            parseStringToken(args[5], 'empty'),
            parseStringToken(args[4], 'empty'),
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
            parseStringToken(args[3], 'empty'),
            parseStringToken(args[2], 'empty'),
        ];
    }
    else if (node.type === 'nbx') {
        // !!! doc is inexact here, logHeight is not at the specified position, and initial value of the nbx was missing.
        // <size> <height> <min> <max> <log> <init> <send> <receive> <label> <x_off> <y_off> <font> <fontsize> <bg_color> <fg_color> <label_color> <log_height>
        node.layout = {
            ...node.layout,
            widthInChars: parseFloatToken(args[0]),
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
            parseStringToken(args[7], 'empty'),
            parseStringToken(args[6], 'empty'),
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
            parseStringToken(args[7], 'empty'),
            parseStringToken(args[6], 'empty'),
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
            parseBoolToken(args[2]),
            parseFloatToken(args[14]),
            parseStringToken(args[5], 'empty'),
            parseStringToken(args[4], 'empty'),
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
        node.args = [
            parseStringToken(args[2], 'empty'),
            parseStringToken(args[11]),
        ];
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
        node.args = [
            parseStringToken(args[4], 'empty'),
            parseStringToken(args[3], 'empty'),
            parseStringToken(args[12]),
        ];
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// Regular expression to split tokens in a message.
// For groups 1 (captures semicolon) and group 5 (captures comma), we capture as a separator 
// only unescaped characters.
// A separator can be e.g. : " ,  " or "; "
// NOTE: Normally we'd use named regexp capturing groups, but that causes problems with 
// create-react-app which uses a babel plugin to remove them.
const TOKENS_RE = /(?<comma>((?<!\\)\s*)((?<!\\\\)\\,)((?<!\\)\s*))|(?<semi>((?<!\\)\s*)((?<!\\\\)\\;)((?<!\\)\s*))|((?<!\\)\s)+|\r\n?|\n/;
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
            lineIndex,
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
        else if (match[5]) {
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const CONTROL_TYPE = {
    floatatom: 'floatatom',
    symbolatom: 'symbolatom',
    listbox: 'listbox',
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const DEFAULT_ARRAY_SIZE = 100;
const NODES = ['obj', 'floatatom', 'symbolatom', 'listbox', 'msg', 'text'];
const nextPatchId = () => `${++nextPatchId.counter}`;
nextPatchId.counter = -1;
const nextArrayId = () => `${++nextArrayId.counter}`;
nextArrayId.counter = -1;
const _tokensMatch = (tokens, ...values) => values.every((value, i) => value === tokens[i]);
/** Parses a Pd file, returns a simplified JSON version */
var parse = (pdString) => {
    let tokenizedLines = tokenize(pdString);
    let patchTokenizedLinesMap = {};
    const c = {
        pd: {
            rootPatchId: '0',
            patches: {},
            arrays: {},
        },
        errors: [],
        warnings: [],
        tokenizedLines,
        patchTokenizedLinesMap,
    };
    _parsePatches(c, true);
    Object.keys(c.pd.patches).forEach((patchId) => {
        _parseArrays(c, patchId);
        _parseNodesAndConnections(c, patchId);
        _computePatchPortlets(c, patchId);
        if (c.patchTokenizedLinesMap[patchId].length) {
            c.patchTokenizedLinesMap[patchId].forEach(({ tokens, lineIndex }) => {
                c.errors.push({ message: `"${tokens[0]} ${tokens[1]}" unexpected chunk`, lineIndex });
            });
        }
    });
    if (c.errors.length) {
        return {
            status: 1,
            warnings: c.warnings,
            errors: c.errors,
        };
    }
    else {
        return {
            status: 0,
            warnings: c.warnings,
            pd: c.pd,
        };
    }
};
const _parsePatches = (c, isPatchRoot) => {
    const patchId = nextPatchId();
    const patchTokenizedLines = [];
    let patchCanvasTokens = null;
    let patchCoordsTokens = null;
    let iterCounter = -1;
    let continueIteration = true;
    let firstLineIndex = c.tokenizedLines[0] ? c.tokenizedLines[0].lineIndex : -1;
    while (c.tokenizedLines.length && continueIteration) {
        const { tokens, lineIndex } = c.tokenizedLines[0];
        if (_tokensMatch(tokens, '#N', 'struct')
            || _tokensMatch(tokens, '#X', 'declare')
            || _tokensMatch(tokens, '#X', 'scalar')
            || _tokensMatch(tokens, '#X', 'f')) {
            c.warnings.push({ message: `"${tokens[0]} ${tokens[1]}" chunk is not supported`, lineIndex });
            c.tokenizedLines.shift();
            continue;
        }
        iterCounter++;
        _catchParsingErrors(c, lineIndex, () => {
            // First line of the patch / subpatch, initializes the patch
            if (_tokensMatch(tokens, '#N', 'canvas') && iterCounter === 0) {
                patchCanvasTokens = c.tokenizedLines.shift();
                // If not first line, starts a subpatch
            }
            else if (_tokensMatch(tokens, '#N', 'canvas')) {
                _parsePatches(c, false);
                // Table : a table subpatch
                // It seems that a table object is just a subpatch containing an array.
                // Therefore we add some synthetic lines to the tokenized file to simulate
                // this subpatch.
            }
            else if (
            // prettier-ignore
            _tokensMatch(tokens, '#X', 'obj', tokens[2], tokens[3], 'table')) {
                const tableTokens = c.tokenizedLines.shift().tokens;
                c.tokenizedLines = [
                    {
                        // prettier-ignore
                        tokens: ['#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'],
                        lineIndex,
                    },
                    {
                        // prettier-ignore
                        tokens: ['#N', 'canvas', '0', '0', '100', '100', '(subpatch)', '0'],
                        lineIndex,
                    },
                    {
                        // prettier-ignore
                        tokens: ['#X', 'array', parseStringToken(tableTokens[5]), tableTokens[6] || DEFAULT_ARRAY_SIZE.toString(), 'float', '0'],
                        lineIndex,
                    },
                    // prettier-ignore
                    { tokens: ['#X', 'restore', '0', '0', 'graph'], lineIndex },
                    {
                        // prettier-ignore
                        tokens: ['#X', 'restore', tableTokens[2], tableTokens[3], 'table'],
                        lineIndex,
                    },
                    ...c.tokenizedLines,
                ];
                _parsePatches(c, false);
                // coords : visual range of framesets
            }
            else if (_tokensMatch(tokens, '#X', 'coords')) {
                patchCoordsTokens = c.tokenizedLines.shift();
                // Restore : ends a canvas definition
            }
            else if (_tokensMatch(tokens, '#X', 'restore')) {
                // Creates a synthetic node that our parser will hydrate at a later stage
                c.tokenizedLines[0].tokens = [
                    'PATCH',
                    patchId,
                    ...c.tokenizedLines[0].tokens.slice(2),
                ];
                continueIteration = false;
                // A normal chunk to add to the current patch
            }
            else {
                patchTokenizedLines.push(c.tokenizedLines.shift());
            }
        });
    }
    if (patchCanvasTokens === null) {
        c.errors.push({ message: `Parsing failed #canvas missing`, lineIndex: firstLineIndex });
        return;
    }
    if (isPatchRoot) {
        c.pd.rootPatchId = patchId;
    }
    c.pd.patches[patchId] = hydratePatch(patchId, isPatchRoot, patchCanvasTokens, patchCoordsTokens);
    c.patchTokenizedLinesMap[patchId] = patchTokenizedLines;
};
/**
 * Use the layout of [inlet] / [outlet] objects to compute the order
 * of portlets of a subpatch.
 */
const _computePatchPortlets = (c, patchId) => {
    const patch = c.pd.patches[patchId];
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
    c.pd.patches[patchId] = {
        ...patch,
        inlets: inletNodes.map((node) => node.id),
        outlets: outletNodes.map((node) => node.id),
    };
};
const _parseArrays = (c, patchId) => {
    const patchTokenizedLines = c.patchTokenizedLinesMap[patchId];
    const remainingTokenizedLines = [];
    // keep the last array for handling correctly
    // the array related instructions which might follow.
    let currentArray = null;
    while (patchTokenizedLines.length) {
        const { tokens, lineIndex } = patchTokenizedLines[0];
        _catchParsingErrors(c, lineIndex, () => {
            // start of an array definition
            if (_tokensMatch(tokens, '#X', 'array')) {
                currentArray = hydrateArray(nextArrayId(), patchTokenizedLines.shift());
                c.pd.arrays[currentArray.id] = currentArray;
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
                    throw new Error(`line ${lineIndex}: Unsupported data chunk #A.`);
                }
                if (currentArray.args[2] === 0) {
                    throw new Error("got array data for an array that doesn't save contents.");
                }
                const currentData = currentArray.data || [];
                currentArray.data = currentData;
                // reads in part of an array of data, starting at the index specified in this line
                // name of the array comes from the the '#X array' and '#X restore' matches above
                const indexOffset = parseFloatToken(tokens[1]);
                tokens.slice(2).forEach((rawVal, i) => {
                    const val = parseFloatToken(rawVal);
                    if (Number.isFinite(val)) {
                        currentData[indexOffset + i] = val;
                    }
                });
                patchTokenizedLines.shift();
                // A normal chunk to add to the current patch
            }
            else {
                remainingTokenizedLines.push(patchTokenizedLines.shift());
            }
        });
    }
    c.patchTokenizedLinesMap[patchId] = remainingTokenizedLines;
};
const _parseNodesAndConnections = (c, patchId) => {
    const patch = c.pd.patches[patchId];
    const patchTokenizedLines = c.patchTokenizedLinesMap[patchId];
    const remainingTokenizedLines = [];
    // In Pd files it seems like node ids are assigned in order in which nodes are declared.
    // Then connection declarations use these same ids to identify nodes.
    let idCounter = -1;
    const nextId = () => `${++idCounter}`;
    while (patchTokenizedLines.length) {
        const { tokens, lineIndex } = patchTokenizedLines[0];
        _catchParsingErrors(c, lineIndex, () => {
            let node = null;
            if (_tokensMatch(tokens, 'PATCH')) {
                node = hydrateNodePatch(nextId(), patchTokenizedLines.shift());
            }
            else if (_tokensMatch(tokens, 'ARRAY')) {
                node = hydrateNodeArray(nextId(), patchTokenizedLines.shift());
            }
            else if (NODES.some((nodeType) => _tokensMatch(tokens, '#X', nodeType))) {
                const tokenizedLine = patchTokenizedLines.shift();
                const nodeBase = hydrateNodeBase(nextId(), tokenizedLine.tokens);
                if (Object.keys(CONTROL_TYPE).includes(nodeBase.type)) {
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
                patch.connections.push(hydrateConnection(patchTokenizedLines.shift()));
            }
            else {
                remainingTokenizedLines.push(patchTokenizedLines.shift());
            }
        });
    }
    c.patchTokenizedLinesMap[patchId] = remainingTokenizedLines;
};
const _catchParsingErrors = (c, lineIndex, func) => {
    try {
        func();
    }
    catch (err) {
        if (err instanceof ValueError) {
            c.errors.push({ message: err.message, lineIndex });
        }
        else {
            throw err;
        }
    }
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * A helper to build an abstraction loader.
 * @param pdFileLoader takes a node type and returns the corresponding pd file.
 * If the pd file could not be found, the function must throw an UnknownNodeTypeError.
 */
const makeAbstractionLoader = (pdFileLoader) => async (nodeType) => {
    let pd = null;
    try {
        pd = await pdFileLoader(nodeType);
    }
    catch (err) {
        if (err instanceof UnknownNodeTypeError) {
            return {
                status: 1,
                unknownNodeType: nodeType,
            };
        }
        else {
            throw err;
        }
    }
    const parseResult = parse(pd);
    if (parseResult.status === 0) {
        return {
            status: 0,
            pd: parseResult.pd,
            parsingWarnings: parseResult.warnings,
        };
    }
    else {
        return {
            status: 1,
            parsingErrors: parseResult.errors,
            parsingWarnings: parseResult.warnings,
        };
    }
};
class UnknownNodeTypeError extends Error {
}
const getArtefact = (artefacts, outFormat) => {
    const artefact = artefacts[outFormat];
    if (!artefact) {
        throw new Error(`no artefact was generated for ${outFormat}`);
    }
    return artefact;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/** Generate an integer series from 0 to `count` (non-inclusive). */
const countTo$1 = (count) => {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(i);
    }
    return results;
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
    const matchedRoute = routes.find(([test]) => test);
    if (!matchedRoute) {
        throw new Error(`no route found`);
    }
    return matchedRoute[1];
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
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
    throw new Error(`Inlet "${inletId}" not found in node ${node.id} of type ${node.type}`);
};
const getOutlet = (node, outletId) => {
    const outlet = node.outlets[outletId];
    if (outlet) {
        return outlet;
    }
    throw new Error(`Outlet "${outletId}" not found in node ${node.id} of type ${node.type}`);
};
/** Returns the list of sinks for the outlet or an empty list. */
const getSinks = (node, outletId) => node.sinks[outletId] || [];
/** Returns the list of sources for the inlet or an empty list. */
const getSources = (node, inletId) => node.sources[inletId] || [];

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * Simple helper to get a list of nodes from a traversal (which is simply node ids).
 */
const toNodes = (graph, traversal) => traversal.map((nodeId) => getNode(graph, nodeId));
/**
 * Breadth first traversal for signal in the graph.
 * Traversal path is calculated by pulling incoming connections from
 * {@link nodesPullingSignal}.
 */
const signalNodes = (graph, nodesPullingSignal, shouldContinue) => {
    const traversal = [];
    nodesPullingSignal.forEach((node) => _signalNodesBreadthFirstRecursive(traversal, [], graph, node, shouldContinue));
    return traversal;
};
const _signalNodesBreadthFirstRecursive = (traversal, currentPath, graph, node, shouldContinue) => {
    if (shouldContinue && !shouldContinue(node)) {
        return;
    }
    const nextPath = [...currentPath, node.id];
    Object.entries(node.sources)
        .filter(([inletId]) => getInlet(node, inletId).type === 'signal')
        .forEach(([_, sources]) => {
        sources.forEach((source) => {
            const sourceNode = getNode(graph, source.nodeId);
            if (currentPath.indexOf(sourceNode.id) !== -1) {
                return;
            }
            _signalNodesBreadthFirstRecursive(traversal, nextPath, graph, sourceNode, shouldContinue);
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
 * @param graphTraversal contains all nodes that are connected to
 * an input or output of the graph.
 */
const trimGraph = (graph, graphTraversal) => mapArray(Object.values(graph).filter((node) => graphTraversal.includes(node.id)), (node) => [
    node.id,
    {
        ...node,
        sources: removeDeadSources(node.sources, graphTraversal),
        sinks: removeDeadSinks(node.sinks, graphTraversal),
    },
]);
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

var name = "@webpd/compiler";
var version = "0.1.0";
var description = "WebPd compiler package";
var main = "./dist/src/index.js";
var types = "./dist/src/index.d.ts";
var type = "module";
var license = "LGPL-3.0";
var author = "Sébastien Piquemal";
var scripts = {
	test: "NODE_OPTIONS='--experimental-vm-modules --no-warnings' npx jest --runInBand --config node_modules/@webpd/dev/configs/jest.js",
	"build:dist": "npx rollup --config node_modules/@webpd/dev/configs/dist.rollup.mjs",
	"build:bindings": "npx rollup --config configs/bindings.rollup.mjs",
	"build:all": "npm run clean; npm run build:dist; npm run build:bindings",
	clean: "rm -rf dist",
	prettier: "npm explore @webpd/dev -- npm run prettier $(pwd)/src",
	eslint: "npm explore @webpd/dev -- npm run eslint $(pwd)/src"
};
var repository = {
	type: "git",
	url: "git+https://github.com/sebpiq/WebPd_compiler.git"
};
var bugs = {
	url: "https://github.com/sebpiq/WebPd_compiler/issues"
};
var homepage = "https://github.com/sebpiq/WebPd_compiler#readme";
var devDependencies = {
	"@rollup/plugin-commonjs": "^23.0.4",
	"@rollup/plugin-node-resolve": "^15.0.1",
	"@rollup/plugin-typescript": "^10.0.1",
	"@types/jest": "^29.4.0",
	"@types/node": "^14.14.7",
	"@webpd/dev": "file:../WebPd_dev",
	assemblyscript: "^0.25.1",
	jest: "^29.4.3",
	rollup: "^3.7.0",
	"ts-jest": "^29.0.5",
	"ts-node": "^10.9.1",
	tslib: "^2.4.1",
	typedoc: "^0.22.17",
	typescript: "^4.7.2"
};
var packageInfo = {
	name: name,
	version: version,
	description: description,
	main: main,
	types: types,
	type: type,
	license: license,
	author: author,
	scripts: scripts,
	repository: repository,
	bugs: bugs,
	homepage: homepage,
	devDependencies: devDependencies
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const Var$3 = (declaration, renderedValue) => `let ${declaration.name}${renderedValue ? ` = ${renderedValue}` : ''}`;
const ConstVar$3 = (declaration, renderedValue) => `const ${declaration.name} = ${renderedValue}`;
const Func$3 = (declaration, renderedArgsValues, renderedBody) => `function ${declaration.name !== null ? declaration.name : ''}(${declaration.args.map((arg, i) => renderedArgsValues[i] ? `${arg.name}=${renderedArgsValues[i]}` : arg.name).join(', ')}) {${renderedBody}}`;
const Class$3 = () => ``;
const macros$1 = {
    Var: Var$3,
    ConstVar: ConstVar$3,
    Func: Func$3,
    Class: Class$3,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const Var$2 = (declaration, renderedValue) => `let ${declaration.name}: ${declaration.type}${renderedValue ? ` = ${renderedValue}` : ''}`;
const ConstVar$2 = (declaration, renderedValue) => `const ${declaration.name}: ${declaration.type} = ${renderedValue}`;
const Func$2 = (declaration, renderedArgsValues, renderedBody) => `function ${declaration.name !== null ? declaration.name : ''}(${declaration.args.map((arg, i) => `${arg.name}: ${arg.type}${renderedArgsValues[i] ? `=${renderedArgsValues[i]}` : ''}`).join(', ')}): ${declaration.returnType} {${renderedBody}}`;
const Class$2 = (declaration) => `class ${declaration.name} {
${declaration.members.map(varDeclaration => `${varDeclaration.name}: ${varDeclaration.type}`).join('\n')}
}`;
const macros = {
    Var: Var$2,
    ConstVar: ConstVar$2,
    Func: Func$2,
    Class: Class$2,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/** Helper to get code macros from compile target. */
const getMacros = (target) => ({ javascript: macros$1, assemblyscript: macros }[target]);
/** Helper to get node implementation or throw an error if not implemented. */
const getNodeImplementation = (nodeImplementations, nodeType) => {
    const nodeImplementation = nodeImplementations[nodeType];
    if (!nodeImplementation) {
        throw new Error(`node [${nodeType}] is not implemented`);
    }
    return {
        dependencies: [],
        ...nodeImplementation,
    };
};
/** Helper to build engine metadata from compilation object */
const buildMetadata = (compilation) => {
    const { settings: { audio: audioSettings, io, }, variableNamesIndex, } = compilation;
    return {
        libVersion: packageInfo.version,
        audioSettings: {
            ...audioSettings,
            // Determined at configure
            sampleRate: 0,
            blockSize: 0,
        },
        compilation: {
            io,
            variableNamesIndex: {
                io: variableNamesIndex.io,
            },
        },
    };
};
/**
 * Build graph traversal for all nodes.
 * This should be exhaustive so that all nodes that are connected
 * to an input or output of the graph are declared correctly.
 * Order of nodes doesn't matter.
 * @TODO : messageSenders should also be included ?
 */
const buildGraphTraversalAll = (graph, io) => {
    const nodesPullingSignal = Object.values(graph).filter((node) => !!node.isPullingSignal);
    const nodesPushingMessages = Object.values(graph).filter((node) => !!node.isPushingMessages);
    Object.keys(io.messageReceivers || {}).forEach((nodeId) => {
        if (nodesPushingMessages.find((node) => node.id === nodeId)) {
            return;
        }
        nodesPushingMessages.push(getNode(graph, nodeId));
    });
    return Array.from(new Set([
        ...messageNodes(graph, nodesPushingMessages),
        ...signalNodes(graph, nodesPullingSignal),
    ]));
};
/**
 * Build graph traversal for generating the loop.
 */
const buildGraphTraversalSignal = (graph) => {
    const nodesPullingSignal = Object.values(graph).filter((node) => !!node.isPullingSignal);
    return signalNodes(graph, nodesPullingSignal);
};
const isGlobalDefinitionWithSettings = (globalCodeDefinition) => !(typeof globalCodeDefinition === 'function');

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const Var$1 = (typeName, name, value) => _preventToString$1({
    astType: 'Var',
    name,
    type: typeName,
    value: value !== undefined ? _prepareVarValue$1(value) : undefined,
});
const ConstVar$1 = (typeName, name, value) => _preventToString$1({
    astType: 'ConstVar',
    name,
    type: typeName,
    value: _prepareVarValue$1(value),
});
const Func$1 = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({
    astType: 'Func',
    name,
    args,
    returnType,
    body: ast$1(strings, ...content),
});
const AnonFunc$1 = (args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({
    astType: 'Func',
    name: null,
    args,
    returnType,
    body: ast$1(strings, ...content),
});
const Class$1 = (name, members) => _preventToString$1({
    astType: 'Class',
    name,
    members,
});
const Sequence$1 = (content) => ({
    astType: 'Sequence',
    content: _processRawContent$1(_intersperse$1(content, countTo$1(content.length - 1).map(() => '\n'))),
});
const ast$1 = (strings, ...content) => _preventToString$1({
    astType: 'Sequence',
    content: _processRawContent$1(_intersperse$1(strings, content)),
});
const _processRawContent$1 = (content) => {
    // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings
    // Basically converts input to an Array<AstContent>.
    const flattenedAndFiltered = content.flatMap((element) => {
        if (typeof element === 'string') {
            return [element];
        }
        else if (typeof element === 'number') {
            return [element.toString()];
        }
        else {
            if (element === null) {
                return [];
            }
            else if (Array.isArray(element)) {
                return _processRawContent$1(_intersperse$1(element, countTo$1(element.length - 1).map(() => '\n')));
            }
            else if (typeof element === 'object' &&
                element.astType === 'Sequence') {
                return element.content;
            }
            else {
                return [element];
            }
        }
    });
    // 2. Combine adjacent strings
    const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {
        if (typeof element === 'string') {
            return [combinedContent, currentString + element];
        }
        else {
            if (currentString.length) {
                return [[...combinedContent, currentString, element], ''];
            }
            else {
                return [[...combinedContent, element], ''];
            }
        }
    }, [[], '']);
    if (remainingString.length) {
        combinedContent.push(remainingString);
    }
    return combinedContent;
};
/**
 * Intersperse content from array1 with content from array2.
 * `array1.length` must be equal to `array2.length + 1`.
 */
const _intersperse$1 = (array1, array2) => {
    if (array1.length === 0) {
        return [];
    }
    return array1
        .slice(1)
        .reduce((combinedContent, element, i) => combinedContent.concat([array2[i], element]), [array1[0]]);
};
/**
 * Prevents AST elements from being rendered as a string, as this is
 * most likely an error due to unproper use of `ast`.
 * Deacivated. Activate for debugging by uncommenting the line below.
 */
const _preventToString$1 = (element) => ({
    ...element,
    // Uncomment this to activate
    // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }
});
const _prepareVarValue$1 = (value) => {
    if (typeof value === 'number') {
        return Sequence$1([value.toString()]);
    }
    else if (typeof value === 'string') {
        return Sequence$1([value]);
    }
    else {
        return value;
    }
};

const generateGlobs = ({ variableNamesIndex: { globs }, }) => 
// prettier-ignore
Sequence$1([
    Var$1('Int', globs.iterFrame, '0'),
    Var$1('Int', globs.frame, '0'),
    Var$1('Int', globs.blockSize, '0'),
    Var$1('Float', globs.sampleRate, '0'),
    Var$1('Float', globs.nullSignal, '0'),
    Func$1(globs.nullMessageReceiver, [
        Var$1('Message', 'm')
    ], 'void') ``
]);
/**
 * Embed arrays passed to the compiler in the compiled module.
 */
const generateEmbeddedArrays = ({ settings: { arrays } }) => Sequence$1(Object.entries(arrays).map(([arrayName, array]) => Sequence$1([
    `commons_setArray("${arrayName}", createFloatArray(${array.length}))`,
    `commons_getArray("${arrayName}").set(${JSON.stringify(Array.from(array))})`,
])));
const generateNodeInitializations = ({ precompilation, }) => Sequence$1([
    precompilation.traversals.all.map((nodeId) => precompilation.nodes[nodeId].initialization),
]);
const generateIoMessageReceivers = ({ settings: { io }, variableNamesIndex, }) => 
// Here not possible to assign directly the receiver because otherwise assemblyscript
// doesn't export a function but a global instead.
Sequence$1(Object.entries(io.messageReceivers).map(([nodeId, spec]) => spec.portletIds.map((inletId) => Func$1(variableNamesIndex.io.messageReceivers[nodeId][inletId], [Var$1('Message', 'm')], 'void') `${variableNamesIndex.nodes[nodeId].messageReceivers[inletId]}(m)`)));
const generateIoMessageSenders = ({ settings: { io }, variableNamesIndex }, generateIoMessageSender) => Sequence$1(Object.entries(io.messageSenders).map(([nodeId, spec]) => spec.portletIds.map((outletId) => {
    const listenerVariableName = variableNamesIndex.io.messageSenders[nodeId][outletId];
    return generateIoMessageSender(listenerVariableName, nodeId, outletId);
})));
const generatePortletsDeclarations = (compilation) => {
    const { graph, precompilation, settings: { debug }, } = compilation;
    const graphTraversalNodes = toNodes(graph, precompilation.traversals.all);
    return Sequence$1([
        graphTraversalNodes.map((node) => {
            const precompiledNode = precompilation.nodes[node.id];
            return [
                // 1. Declares signal outlets
                Object.values(precompiledNode.signalOuts).map((outName) => Var$1('Float', outName, '0')),
                // 2. Declares message receivers for all message inlets.
                Object.entries(precompiledNode.messageReceivers).map(([inletId, astFunc]) => {
                    // prettier-ignore
                    return Func$1(astFunc.name, astFunc.args, astFunc.returnType) `
                                ${astFunc.body}
                                throw new Error('[${node.type}], id "${node.id}", inlet "${inletId}", unsupported message : ' + msg_display(${astFunc.args[0].name})${debug
                        ? " + '\\nDEBUG : remember, you must return from message receiver'"
                        : ''})
                            `;
                }),
            ];
        }),
        // 3. Declares message senders for all message outlets.
        // This needs to come after all message receivers are declared since we reference them here.
        graphTraversalNodes.map((node) => Object.values(precompilation.nodes[node.id].messageSenders).map(({ messageSenderName: sndName, messageReceiverNames: rcvNames, }) => 
        // prettier-ignore
        Func$1(sndName, [
            Var$1('Message', 'm')
        ], 'void') `
                    ${rcvNames.map(rcvName => `${rcvName}(m)`)}
                `)),
    ]);
};
const generateLoop = (compilation) => {
    const { variableNamesIndex, precompilation } = compilation;
    const { traversals } = precompilation;
    const { globs } = variableNamesIndex;
    // prettier-ignore
    return ast$1 `
        for (${globs.iterFrame} = 0; ${globs.iterFrame} < ${globs.blockSize}; ${globs.iterFrame}++) {
            _commons_emitFrame(${globs.frame})
            ${traversals.loop.map((nodeId) => precompilation.nodes[nodeId].loop)}
            ${globs.frame}++
        }
    `;
};
const generateImportsExports = ({ precompilation }, generateImport, generateExport) => Sequence$1([
    precompilation.dependencies.imports.map(generateImport),
    precompilation.dependencies.exports.map(generateExport),
]);

/**
 * Renders templated strings which contain nested arrays of strings.
 * This helper allows to use functions such as `.map` to generate several lines
 * of code, without having to use `.join('\n')`.
 * If a code line inserted in the template is falsy (null / undefined), it is ignored.
 * @todo : should not have to check for falsy codeLine has it should be typechecked.
 */
const render = (macros, element) => {
    if (typeof element === 'string') {
        return element;
    }
    else if (element.astType === 'Var') {
        return macros.Var(element, element.value ? render(macros, element.value) : undefined);
    }
    else if (element.astType === 'ConstVar') {
        return macros.ConstVar(element, element.value ? render(macros, element.value) : undefined);
    }
    else if (element.astType === 'Func') {
        return macros.Func(element, element.args.map(arg => arg.value ? render(macros, arg.value) : null), render(macros, element.body));
    }
    else if (element.astType === 'Class') {
        return macros.Class(element);
    }
    else if (element.astType === 'Sequence') {
        return element.content.map((child) => render(macros, child)).join('');
    }
    else {
        throw new Error(`Unexpected element in AST ${element}`);
    }
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var compileToJavascript = (compilation) => {
    const { variableNamesIndex, settings: { io }, precompilation, } = compilation;
    const globs = compilation.variableNamesIndex.globs;
    const metadata = buildMetadata(compilation);
    // prettier-ignore
    return render(macros$1, ast$1 `
        ${generateGlobs(compilation)}
        ${precompilation.dependencies.ast}
        ${generatePortletsDeclarations(compilation)}

        ${generateEmbeddedArrays(compilation)}

        ${generateIoMessageReceivers(compilation)}
        ${generateIoMessageSenders(compilation, (variableName, nodeId, outletId) => ast$1 `const ${variableName} = (m) => {exports.io.messageSenders['${nodeId}']['${outletId}'].onMessage(m)}`)}

        ${generateNodeInitializations(compilation)}

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
                ${generateLoop(compilation)}
            },
            io: {
                messageReceivers: {
                    ${Object.entries(io.messageReceivers).map(([nodeId, spec]) => ast$1 `${nodeId}: {
                            ${spec.portletIds.map(inletId => `"${inletId}": ${variableNamesIndex.io.messageReceivers[nodeId][inletId]},`)}
                        },`)}
                },
                messageSenders: {
                    ${Object.entries(io.messageSenders).map(([nodeId, spec]) => ast$1 `${nodeId}: {
                            ${spec.portletIds.map(outletId => `"${outletId}": {onMessage: () => undefined},`)}
                        },`)}
                },
            }
        }

        ${generateImportsExports(compilation, ({ name }) => ast$1 `
                exports.${name} = () => { throw new Error('import for ${name} not provided') }
                const ${name} = (...args) => exports.${name}(...args)
            `, ({ name }) => ast$1 `exports.${name} = ${name}`)}
    `);
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var compileToAssemblyscript = (compilation) => {
    const { settings: { audio: audioSettings, io }, variableNamesIndex, precompilation, } = compilation;
    const { channelCount } = audioSettings;
    const globs = compilation.variableNamesIndex.globs;
    const metadata = buildMetadata(compilation);
    // prettier-ignore
    return render(macros, ast$1 `
        ${generateGlobs(compilation)}
        ${precompilation.dependencies.ast}
        ${generatePortletsDeclarations(compilation)}

        ${generateEmbeddedArrays(compilation)}

        ${generateIoMessageReceivers(compilation)}
        ${generateIoMessageSenders(compilation, (variableName) => ast$1 `export declare function ${variableName}(m: Message): void`)}

        const metadata: string = '${JSON.stringify(metadata)}'
        let ${globs.input}: FloatArray = createFloatArray(0)
        let ${globs.output}: FloatArray = createFloatArray(0)

        ${generateNodeInitializations(compilation)}

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
            ${generateLoop(compilation)}
        }

        export {
            metadata,
            ${Object.entries(io.messageReceivers).map(([nodeId, spec]) => spec.portletIds.map(inletId => variableNamesIndex.io.messageReceivers[nodeId][inletId] + ','))}
        }

        ${generateImportsExports(compilation, ({ name, args, returnType }) => ast$1 `export declare function ${name} (${args.map((a) => `${a.name}: ${a.type}`).join(',')}): ${returnType}`, ({ name }) => ast$1 `export { ${name} }`)}
    `);
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * Helper to declare namespace objects enforcing stricter access rules. Specifically, it forbids :
 * - reading an unknown property.
 * - trying to overwrite an existing property.
 *
 * Also allows to access properties starting with a number by prepending a `$`.
 * This is convenient to access portlets by their id without using indexing syntax, for example :
 * `namespace.$0` instead of `namespace['0']`.
 */
const createNamespace = (label, namespace) => {
    return new Proxy(namespace, {
        get: (target, k) => {
            const key = _trimDollarKey(String(k));
            if (!target.hasOwnProperty(key)) {
                // Whitelist some fields that are undefined but accessed at
                // some point or another by our code.
                // TODO : find a better way to do this.
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
        set: (target, k, newValue) => {
            const key = _trimDollarKey(String(k));
            if (target.hasOwnProperty(key)) {
                throw new Error(`Key "${String(key)}" is protected and cannot be overwritten.`);
            }
            else {
                target[key] = newValue;
            }
            return newValue;
        },
    });
};
const nodeNamespaceLabel = (node, namespaceName) => `${node.type}:${node.id}${namespaceName ? `:${namespaceName}` : ''}`;
const _trimDollarKey = (key) => {
    const match = /\$(.*)/.exec(key);
    if (!match) {
        return key;
    }
    else {
        return match[1];
    }
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * Generates the whole set of variable names for a compilation for a given graph.
 *
 * @param nodeImplementations
 * @param graph
 * @returns
 */
const generateVariableNamesIndex = (graph, debug) => createNamespace('variableNamesIndex', {
    nodes: createNamespace('nodes', mapObject(graph, (node) => createNamespace(nodeNamespaceLabel(node), {
        // No need for `ins` here, as signal inlets will always directly be assigned
        // the outlet from their source node.
        messageReceivers: createNamespace(nodeNamespaceLabel(node, 'messageReceivers'), {}),
        messageSenders: createNamespace(nodeNamespaceLabel(node, 'messageSenders'), {}),
        signalOuts: createNamespace(nodeNamespaceLabel(node, 'signalOuts'), {}),
        state: `${_namePrefix(debug, node)}_STATE`,
    }))),
    globs: generateVariableNamesGlobs(),
    io: {
        messageReceivers: createNamespace('io:messageReceivers', {}),
        messageSenders: createNamespace('io:messageSenders', {}),
    },
});
const generateVariableNamesGlobs = () => createNamespace('globs', {
    iterFrame: 'F',
    frame: 'FRAME',
    blockSize: 'BLOCK_SIZE',
    sampleRate: 'SAMPLE_RATE',
    output: 'OUTPUT',
    input: 'INPUT',
    nullMessageReceiver: 'SND_TO_NULL',
    nullSignal: 'NULL_SIGNAL',
});
const attachNodePortlet = (compilation, nsKey, nodeId, portletId) => {
    const { graph, variableNamesIndex, settings: { debug }, } = compilation;
    const nodeVariableNames = variableNamesIndex.nodes[nodeId];
    const sinkNode = getNode(graph, nodeId);
    const prefix = _namePrefix(debug, sinkNode);
    // Shouldnt throw an error if the variable already exists, as precompile might try to
    // declare it several times.
    if (!(portletId in nodeVariableNames[nsKey])) {
        nodeVariableNames[nsKey][portletId] = {
            signalOuts: `${prefix}_OUTS_${_v(portletId)}`,
            messageSenders: `${prefix}_SNDS_${_v(portletId)}`,
            messageReceivers: `${prefix}_RCVS_${_v(portletId)}`,
        }[nsKey];
    }
    return nodeVariableNames[nsKey][portletId];
};
/**
 * Helper that attaches to the generated `variableNamesIndex` the names of specified outlet listeners
 * and inlet callers.
 */
const attachIoMessages = ({ graph, variableNamesIndex, settings: { io }, }) => ['messageReceivers', 'messageSenders'].forEach((nsKey) => {
    const specs = (nsKey === 'messageReceivers'
        ? io.messageReceivers
        : io.messageSenders) || {};
    Object.entries(specs).forEach(([nodeId, spec]) => {
        const node = getNode(graph, nodeId);
        variableNamesIndex.io[nsKey][nodeId] = createNamespace(nodeNamespaceLabel(node, nsKey), {});
        spec.portletIds.forEach((outletId) => {
            variableNamesIndex.io[nsKey][nodeId][outletId] = `io${nsKey === 'messageReceivers' ? 'Rcv' : 'Snd'}_${nodeId}_${outletId}`;
        });
    });
});
const assertValidNamePart = (namePart) => {
    const isInvalid = !VALID_NAME_PART_REGEXP.exec(namePart);
    if (isInvalid) {
        throw new Error(`Invalid variable name for code generation "${namePart}"`);
    }
    return namePart;
};
const _v = assertValidNamePart;
const _nodeType = (nodeType) => nodeType.replace(/[^a-zA-Z0-9_]/g, '');
const _namePrefix = (debug, node) => debug ? _v(`${_nodeType(node.type)}_${node.id}`) : _v(node.id);
const VALID_NAME_PART_REGEXP = /^[a-zA-Z0-9_]+$/;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const sked = ({ target }) => {
    const content = [];
    if (target === 'assemblyscript') {
        content.push(`
            type SkedCallback = (event: SkedEvent) => void
            type SkedId = Int
            type SkedMode = Int
            type SkedEvent = string
        `);
    }
    return Sequence$1([
        ...content,
        /**
         * Skeduler id that will never be used.
         * Can be used as a "no id", or "null" value.
         */
        ConstVar$1('SkedId', 'SKED_ID_NULL', '-1'),
        ConstVar$1('SkedId', 'SKED_ID_COUNTER_INIT', '1'),
        ConstVar$1('Int', '_SKED_WAIT_IN_PROGRESS', '0'),
        ConstVar$1('Int', '_SKED_WAIT_OVER', '1'),
        ConstVar$1('Int', '_SKED_MODE_WAIT', '0'),
        ConstVar$1('Int', '_SKED_MODE_SUBSCRIBE', '1'),
        // =========================== SKED API
        Class$1('SkedRequest', [
            Var$1('SkedId', 'id'),
            Var$1('SkedMode', 'mode'),
            Var$1('SkedCallback', 'callback'),
        ]),
        Class$1('Skeduler', [
            Var$1('Map<SkedEvent, Array<SkedId>>', 'events'),
            Var$1('Map<SkedId, SkedRequest>', 'requests'),
            Var$1('boolean', 'isLoggingEvents'),
            Var$1('Set<SkedEvent>', 'eventLog'),
            Var$1('SkedId', 'idCounter'),
        ]),
        /** Creates a new Skeduler. */
        Func$1('sked_create', [
            Var$1('boolean', 'isLoggingEvents')
        ], 'Skeduler') `
            return {
                eventLog: new Set(),
                events: new Map(),
                requests: new Map(),
                idCounter: SKED_ID_COUNTER_INIT,
                isLoggingEvents,
            }
        `,
        /**
         * Asks the skeduler to wait for an event to occur and trigger a callback.
         * If the event has already occurred, the callback is triggered instantly
         * when calling the function.
         * Once triggered, the callback is forgotten.
         * @returns an id allowing to cancel the callback with {@link sked_cancel}
         */
        Func$1('sked_wait', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedEvent', 'event'),
            Var$1('SkedCallback', 'callback'),
        ], 'SkedId') `
            if (skeduler.isLoggingEvents === false) {
                throw new Error("Please activate skeduler's isLoggingEvents")
            }

            if (skeduler.eventLog.has(event)) {
                callback(event)
                return SKED_ID_NULL
            } else {
                return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
            }
        `,
        /**
         * Asks the skeduler to wait for an event to occur and trigger a callback.
         * If the event has already occurred, the callback is NOT triggered immediatelly.
         * Once triggered, the callback is forgotten.
         * @returns an id allowing to cancel the callback with {@link sked_cancel}
         */
        Func$1('sked_wait_future', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedEvent', 'event'),
            Var$1('SkedCallback', 'callback'),
        ], 'SkedId') `
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
        `,
        /**
         * Asks the skeduler to trigger a callback everytime an event occurs
         * @returns an id allowing to cancel the callback with {@link sked_cancel}
         */
        Func$1('sked_subscribe', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedEvent', 'event'),
            Var$1('SkedCallback', 'callback'),
        ], 'SkedId') `
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE)
        `,
        /** Notifies the skeduler that an event has just occurred. */
        Func$1('sked_emit', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedEvent', 'event')
        ], 'void') `
            if (skeduler.isLoggingEvents === true) {
                skeduler.eventLog.add(event)
            }
            if (skeduler.events.has(event)) {
                ${ConstVar$1('Array<SkedId>', 'skedIds', 'skeduler.events.get(event)')}
                ${ConstVar$1('Array<SkedId>', 'skedIdsStaying', '[]')}
                for (${Var$1('Int', 'i', '0')}; i < skedIds.length; i++) {
                    if (skeduler.requests.has(skedIds[i])) {
                        ${ConstVar$1('SkedRequest', 'request', 'skeduler.requests.get(skedIds[i])')}
                        request.callback(event)
                        if (request.mode === _SKED_MODE_WAIT) {
                            skeduler.requests.delete(request.id)
                        } else {
                            skedIdsStaying.push(request.id)
                        }
                    }
                }
                skeduler.events.set(event, skedIdsStaying)
            }
        `,
        /** Cancels a callback */
        Func$1('sked_cancel', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedId', 'id'),
        ], 'void') `
            skeduler.requests.delete(id)
        `,
        // =========================== PRIVATE
        Func$1('_sked_createRequest', [
            Var$1('Skeduler', 'skeduler'),
            Var$1('SkedEvent', 'event'),
            Var$1('SkedCallback', 'callback'),
            Var$1('SkedMode', 'mode'),
        ], 'SkedId') `
            ${ConstVar$1('SkedId', 'id', '_sked_nextId(skeduler)')}
            ${ConstVar$1('SkedRequest', 'request', `{
                id, 
                mode, 
                callback,
            }`)}
            skeduler.requests.set(id, request)
            if (!skeduler.events.has(event)) {
                skeduler.events.set(event, [id])    
            } else {
                skeduler.events.get(event).push(id)
            }
            return id
        `,
        Func$1('_sked_nextId', [
            Var$1('Skeduler', 'skeduler')
        ], 'SkedId') `
            return skeduler.idCounter++
        `,
    ]);
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const commonsCore = {
    codeGenerator: () => Sequence$1([
        ConstVar$1('Skeduler', '_commons_ENGINE_LOGGED_SKEDULER', 'sked_create(true)'),
        ConstVar$1('Skeduler', '_commons_FRAME_SKEDULER', 'sked_create(false)'),
        Func$1('_commons_emitEngineConfigure') `
            sked_emit(_commons_ENGINE_LOGGED_SKEDULER, 'configure')
        `,
        Func$1('_commons_emitFrame', [
            Var$1('Int', 'frame')
        ], 'void') `
            sked_emit(_commons_FRAME_SKEDULER, frame.toString())
        `
    ]),
    dependencies: [sked],
};
const commonsArrays = {
    codeGenerator: () => Sequence$1([
        ConstVar$1('Map<string, FloatArray>', '_commons_ARRAYS', 'new Map()'),
        ConstVar$1('Skeduler', '_commons_ARRAYS_SKEDULER', 'sked_create(false)'),
        /** Gets an named array, throwing an error if the array doesn't exist. */
        Func$1('commons_getArray', [
            Var$1('string', 'arrayName')
        ], 'FloatArray') `
            if (!_commons_ARRAYS.has(arrayName)) {
                throw new Error('Unknown array ' + arrayName)
            }
            return _commons_ARRAYS.get(arrayName)
        `,
        Func$1('commons_hasArray', [
            Var$1('string', 'arrayName')
        ], 'boolean') `
            return _commons_ARRAYS.has(arrayName)
        `,
        Func$1('commons_setArray', [
            Var$1('string', 'arrayName'),
            Var$1('FloatArray', 'array'),
        ], 'void') `
            _commons_ARRAYS.set(arrayName, array)
            sked_emit(_commons_ARRAYS_SKEDULER, arrayName)
        `,
        /**
         * @param callback Called immediately if the array exists, and subsequently, everytime
         * the array is set again.
         * @returns An id that can be used to cancel the subscription.
         */
        Func$1('commons_subscribeArrayChanges', [
            Var$1('string', 'arrayName'),
            Var$1('SkedCallback', 'callback'),
        ], 'SkedId') `
            const id = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback)
            if (_commons_ARRAYS.has(arrayName)) {
                callback(arrayName)
            }
            return id
        `,
        /**
         * @param id The id received when subscribing.
         */
        Func$1('commons_cancelArrayChangesSubscription', [
            Var$1('SkedId', 'id')
        ], 'void') `
            sked_cancel(_commons_ARRAYS_SKEDULER, id)
        `,
    ]),
    exports: [{ name: 'commons_getArray' }, { name: 'commons_setArray' }],
};
const commonsWaitEngineConfigure = {
    codeGenerator: () => Sequence$1([
        /**
         * @param callback Called when the engine is configured, or immediately if the engine
         * was already configured.
         */
        Func$1('commons_waitEngineConfigure', [
            Var$1('SkedCallback', 'callback'),
        ], 'void') `
            sked_wait(_commons_ENGINE_LOGGED_SKEDULER, 'configure', callback)
        `
    ]),
    dependencies: [commonsCore],
};
const commonsWaitFrame = {
    codeGenerator: () => Sequence$1([
        /**
         * Schedules a callback to be called at the given frame.
         * If the frame already occurred, or is the current frame, the callback won't be executed.
         */
        Func$1('commons_waitFrame', [
            Var$1('Int', 'frame'),
            Var$1('SkedCallback', 'callback'),
        ], 'SkedId') `
            return sked_wait_future(_commons_FRAME_SKEDULER, frame.toString(), callback)
        `,
        /**
         * Cancels waiting for a frame to occur.
         */
        Func$1('commons_cancelWaitFrame', [
            Var$1('SkedId', 'id')
        ], 'void') `
            sked_cancel(_commons_FRAME_SKEDULER, id)
        `,
    ]),
    dependencies: [commonsCore],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const core = {
    codeGenerator: ({ target, audioSettings: { bitDepth } }) => {
        const Int = 'i32';
        const Float = bitDepth === 32 ? 'f32' : 'f64';
        const FloatArray = bitDepth === 32 ? 'Float32Array' : 'Float64Array';
        const getFloat = bitDepth === 32 ? 'getFloat32' : 'getFloat64';
        const setFloat = bitDepth === 32 ? 'setFloat32' : 'setFloat64';
        const declareFuncs = {
            toInt: Func$1('toInt', [Var$1('Float', 'v')], 'Int'),
            toFloat: Func$1('toFloat', [Var$1('Int', 'v')], 'Float'),
            createFloatArray: Func$1('createFloatArray', [Var$1('Int', 'length')], 'FloatArray'),
            setFloatDataView: Func$1('setFloatDataView', [
                Var$1('DataView', 'dataView'),
                Var$1('Int', 'position'),
                Var$1('Float', 'value'),
            ], 'void'),
            getFloatDataView: Func$1('getFloatDataView', [
                Var$1('DataView', 'dataView'),
                Var$1('Int', 'position'),
            ], 'Float')
        };
        if (target === 'assemblyscript') {
            return Sequence$1([
                `
                type FloatArray = ${FloatArray}
                type Float = ${Float}
                type Int = ${Int}
                `,
                declareFuncs.toInt `
                    return ${Int}(v)
                `,
                declareFuncs.toFloat `
                    return ${Float}(v)
                `,
                declareFuncs.createFloatArray `
                    return new ${FloatArray}(length)
                `,
                declareFuncs.setFloatDataView `
                    dataView.${setFloat}(position, value)
                `,
                declareFuncs.getFloatDataView `
                    return dataView.${getFloat}(position)
                `,
                // =========================== EXPORTED API
                Func$1('x_core_createListOfArrays', [], 'FloatArray[]') `
                    const arrays: FloatArray[] = []
                    return arrays
                `,
                Func$1('x_core_pushToListOfArrays', [
                    Var$1('FloatArray[]', 'arrays'),
                    Var$1('FloatArray', 'array')
                ], 'void') `
                    arrays.push(array)
                `,
                Func$1('x_core_getListOfArraysLength', [
                    Var$1('FloatArray[]', 'arrays')
                ], 'Int') `
                    return arrays.length
                `,
                Func$1('x_core_getListOfArraysElem', [
                    Var$1('FloatArray[]', 'arrays'),
                    Var$1('Int', 'index')
                ], 'FloatArray') `
                    return arrays[index]
                `
            ]);
        }
        else if (target === 'javascript') {
            return Sequence$1([
                `
                const i32 = (v) => v
                const f32 = i32
                const f64 = i32
                `,
                declareFuncs.toInt `
                    return v
                `,
                declareFuncs.toFloat `
                    return v
                `,
                declareFuncs.createFloatArray `
                    return new ${FloatArray}(length)
                `,
                declareFuncs.setFloatDataView `
                    dataView.${setFloat}(position, value)
                `,
                declareFuncs.getFloatDataView `
                    return dataView.${getFloat}(position)
                `,
            ]);
        }
        else {
            throw new Error(`Unexpected target: ${target}`);
        }
    },
    exports: [
        { name: 'x_core_createListOfArrays', targets: ['assemblyscript'] },
        { name: 'x_core_pushToListOfArrays', targets: ['assemblyscript'] },
        { name: 'x_core_getListOfArraysLength', targets: ['assemblyscript'] },
        { name: 'x_core_getListOfArraysElem', targets: ['assemblyscript'] },
        { name: 'createFloatArray', targets: ['assemblyscript'] },
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const bufCore$1 = () => Sequence$1([
    /**
     * Ring buffer
     */
    Class$1('buf_SoundBuffer', [
        Var$1('FloatArray', 'data'),
        Var$1('Int', 'length'),
        Var$1('Int', 'writeCursor'),
        Var$1('Int', 'pullAvailableLength'),
    ]),
    /** Erases all the content from the buffer */
    Func$1('buf_clear', [
        Var$1('buf_SoundBuffer', 'buffer')
    ], 'void') `
        buffer.data.fill(0)
    `,
    /** Erases all the content from the buffer */
    Func$1('buf_create', [
        Var$1('Int', 'length')
    ], 'buf_SoundBuffer') `
        return {
            data: createFloatArray(length),
            length: length,
            writeCursor: 0,
            pullAvailableLength: 0,
        }
    `
]);
const bufPushPull$1 = {
    codeGenerator: () => Sequence$1([
        /**
         * Pushes a block to the buffer, throwing an error if the buffer is full.
         * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}
         * is moved corresponding with the length of data written.
         *
         * @todo : Optimize by allowing to read/write directly from host
         */
        Func$1('buf_pushBlock', [
            Var$1('buf_SoundBuffer', 'buffer'),
            Var$1('FloatArray', 'block')
        ], 'Int') `
            if (buffer.pullAvailableLength + block.length > buffer.length) {
                throw new Error('buffer full')
            }

            ${Var$1('Int', 'left', 'block.length')}
            while (left > 0) {
                ${ConstVar$1('Int', 'lengthToWrite', `toInt(Math.min(
                    toFloat(buffer.length - buffer.writeCursor), 
                    toFloat(left),
                ))`)}
                buffer.data.set(
                    block.subarray(
                        block.length - left, 
                        block.length - left + lengthToWrite
                    ), 
                    buffer.writeCursor
                )
                left -= lengthToWrite
                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length
                buffer.pullAvailableLength += lengthToWrite
            }
            return buffer.pullAvailableLength
        `,
        /**
         * Pulls a single sample from the buffer.
         * This is a destructive operation, and the sample will be
         * unavailable for subsequent readers with the same operation.
         */
        Func$1('buf_pullSample', [
            Var$1('buf_SoundBuffer', 'buffer')
        ], 'Float') `
            if (buffer.pullAvailableLength <= 0) {
                return 0
            }
            ${ConstVar$1('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}
            buffer.pullAvailableLength -= 1
            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]
        `
    ]),
    dependencies: [bufCore$1],
};
const bufWriteRead = {
    codeGenerator: () => Sequence$1([
        /**
         * Writes a sample at \`@link writeCursor\` and increments \`writeCursor\` by one.
         */
        Func$1('buf_writeSample', [
            Var$1('buf_SoundBuffer', 'buffer'),
            Var$1('Float', 'value')
        ], 'void') `
            buffer.data[buffer.writeCursor] = value
            buffer.writeCursor = (buffer.writeCursor + 1) % buffer.length
        `,
        /**
         * Reads the sample at position \`writeCursor - offset\`.
         * @param offset Must be between 0 (for reading the last written sample)
         *  and {@link buf_SoundBuffer#length} - 1. A value outside these bounds will not cause
         *  an error, but might cause unexpected results.
         */
        Func$1('buf_readSample', [
            Var$1('buf_SoundBuffer', 'buffer'),
            Var$1('Int', 'offset')
        ], 'Float') `
            // R = (buffer.writeCursor - 1 - offset) -> ideal read position
            // W = R % buffer.length -> wrap it so that its within buffer length bounds (but could be negative)
            // (W + buffer.length) % buffer.length -> if W negative, (W + buffer.length) shifts it back to positive.
            return buffer.data[(buffer.length + ((buffer.writeCursor - 1 - offset) % buffer.length)) % buffer.length]
        `
    ]),
    dependencies: [bufCore$1],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const msg$1 = {
    codeGenerator: ({ target }) => {
        const declareFuncs = {
            msg_create: Func$1('msg_create', [Var$1('MessageTemplate', 'template')], 'Message'),
            msg_writeStringToken: Func$1('msg_writeStringToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
                Var$1('string', 'value'),
            ], 'void'),
            msg_writeFloatToken: Func$1('msg_writeFloatToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
                Var$1('MessageFloatToken', 'value'),
            ], 'void'),
            msg_readStringToken: Func$1('msg_readStringToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
            ], 'string'),
            msg_readFloatToken: Func$1('msg_readFloatToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
            ], 'MessageFloatToken'),
            msg_getLength: Func$1('msg_getLength', [
                Var$1('Message', 'message')
            ], 'Int'),
            msg_getTokenType: Func$1('msg_getTokenType', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
            ], 'Int'),
            msg_isStringToken: Func$1('msg_isStringToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
            ], 'boolean'),
            msg_isFloatToken: Func$1('msg_isFloatToken', [
                Var$1('Message', 'message'),
                Var$1('Int', 'tokenIndex'),
            ], 'boolean'),
            msg_isMatching: Func$1('msg_isMatching', [
                Var$1('Message', 'message'),
                Var$1('Array<MessageHeaderEntry>', 'tokenTypes'),
            ], 'boolean'),
            msg_floats: Func$1('msg_floats', [
                Var$1('Array<Float>', 'values'),
            ], 'Message'),
            msg_strings: Func$1('msg_strings', [
                Var$1('Array<string>', 'values'),
            ], 'Message'),
            msg_display: Func$1('msg_display', [
                Var$1('Message', 'message'),
            ], 'string')
        };
        if (target === 'assemblyscript') {
            return Sequence$1([
                `
                type MessageFloatToken = Float
                type MessageCharToken = Int

                type MessageTemplate = Array<Int>
                type MessageHeaderEntry = Int
                type MessageHeader = Int32Array
                `,
                ConstVar$1('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),
                ConstVar$1('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),
                // =========================== EXPORTED API
                Func$1('x_msg_create', [
                    Var$1('Int32Array', 'templateTypedArray')
                ], 'Message') `
                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return msg_create(template)
                `,
                Func$1('x_msg_getTokenTypes', [
                    Var$1('Message', 'message')
                ], 'MessageHeader') `
                    return message.tokenTypes
                `,
                Func$1('x_msg_createTemplate', [
                    Var$1('i32', 'length')
                ], 'Int32Array') `
                    return new Int32Array(length)
                `,
                // =========================== MSG API
                declareFuncs.msg_create `
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<MessageHeaderEntry> = []
                    let tokenPositions: Array<MessageHeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case MSG_FLOAT_TOKEN:
                                byteCount += sizeof<MessageFloatToken>()
                                tokenTypes.push(MSG_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case MSG_STRING_TOKEN:
                                byteCount += sizeof<MessageCharToken>() * template[i + 1]
                                tokenTypes.push(MSG_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<MessageHeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<MessageHeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    const header = _msg_unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: _msg_unpackTokenTypes(header),
                        tokenPositions: _msg_unpackTokenPositions(header),
                    }
                `,
                declareFuncs.msg_writeStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<MessageCharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                `,
                declareFuncs.msg_writeFloatToken `
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                `,
                declareFuncs.msg_readStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                    }
                    return value
                `,
                declareFuncs.msg_readFloatToken `
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                `,
                declareFuncs.msg_getLength `
                    return message.tokenTypes.length
                `,
                declareFuncs.msg_getTokenType `
                    return message.tokenTypes[tokenIndex]
                `,
                declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                `,
                declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                `,
                declareFuncs.msg_isMatching `
                    if (message.tokenTypes.length !== tokenTypes.length) {
                        return false
                    }
                    for (let i: Int = 0; i < tokenTypes.length; i++) {
                        if (message.tokenTypes[i] !== tokenTypes[i]) {
                            return false
                        }
                    }
                    return true
                `,
                declareFuncs.msg_floats `
                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                `,
                declareFuncs.msg_strings `
                    const template: MessageTemplate = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(MSG_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: Message = msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeStringToken(message, i, values[i])
                    }
                    return message
                `,
                declareFuncs.msg_display `
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < msg_getLength(message); i++) {
                        if (msg_isFloatToken(message, i)) {
                            displayArray.push(msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                `,
                // =========================== PRIVATE
                // Message header : [
                //      <Token count>, 
                //      <Token 1 type>,  ..., <Token N type>, 
                //      <Token 1 start>, ..., <Token N start>, <Token N end>
                //      ... DATA ...
                // ]
                Class$1('Message', [
                    Var$1('DataView', 'dataView'),
                    Var$1('MessageHeader', 'header'),
                    Var$1('MessageHeaderEntry', 'tokenCount'),
                    Var$1('MessageHeader', 'tokenTypes'),
                    Var$1('MessageHeader', 'tokenPositions'),
                ]),
                Func$1('_msg_computeHeaderLength', [
                    Var$1('Int', 'tokenCount')
                ], 'Int') `
                    return 1 + tokenCount * 2 + 1
                `,
                Func$1('_msg_unpackTokenCount', [
                    Var$1('DataView', 'messageDataView')
                ], 'MessageHeaderEntry') `
                    return messageDataView.getInt32(0)
                `,
                Func$1('_msg_unpackHeader', [
                    Var$1('DataView', 'messageDataView'),
                    Var$1('MessageHeaderEntry', 'tokenCount'),
                ], 'MessageHeader') `
                    const headerLength = _msg_computeHeaderLength(tokenCount)
                    // TODO : why is this \`wrap\` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                    }
                    return messageHeader
                `,
                Func$1('_msg_unpackTokenTypes', [
                    Var$1('MessageHeader', 'header'),
                ], 'MessageHeader') `
                    return header.slice(1, 1 + header[0])
                `,
                Func$1('_msg_unpackTokenPositions', [
                    Var$1('MessageHeader', 'header'),
                ], 'MessageHeader') `
                    return header.slice(1 + header[0])
                `,
            ]);
        }
        else if (target === 'javascript') {
            return Sequence$1([
                ConstVar$1('string', 'MSG_FLOAT_TOKEN', '"number"'),
                ConstVar$1('string', 'MSG_STRING_TOKEN', '"string"'),
                declareFuncs.msg_create `
                    const m = []
                    let i = 0
                    while (i < template.length) {
                        if (template[i] === MSG_STRING_TOKEN) {
                            m.push('')
                            i += 2
                        } else if (template[i] === MSG_FLOAT_TOKEN) {
                            m.push(0)
                            i += 1
                        }
                    }
                    return m
                `,
                declareFuncs.msg_getLength `
                    return message.length
                `,
                declareFuncs.msg_getTokenType `
                    return typeof message[tokenIndex]
                `,
                declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === 'string'
                `,
                declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === 'number'
                `,
                declareFuncs.msg_isMatching `
                    return (message.length === tokenTypes.length) 
                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])
                `,
                declareFuncs.msg_writeFloatToken `
                    message[tokenIndex] = value
                `,
                declareFuncs.msg_writeStringToken `
                    message[tokenIndex] = value
                `,
                declareFuncs.msg_readFloatToken `
                    return message[tokenIndex]
                `,
                declareFuncs.msg_readStringToken `
                    return message[tokenIndex]
                `,
                declareFuncs.msg_floats `
                    return values
                `,
                declareFuncs.msg_strings `
                    return values
                `,
                declareFuncs.msg_display `
                    return '[' + message
                        .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
                        .join(', ') + ']'
                `,
            ]);
        }
        else {
            throw new Error(`Unexpected target: ${target}`);
        }
    },
    exports: [
        { name: 'x_msg_create', targets: ['assemblyscript'] },
        { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },
        { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },
        { name: 'msg_writeStringToken', targets: ['assemblyscript'] },
        { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },
        { name: 'msg_readStringToken', targets: ['assemblyscript'] },
        { name: 'msg_readFloatToken', targets: ['assemblyscript'] },
        { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },
        { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const FS_OPERATION_SUCCESS$1 = 0;
const FS_OPERATION_FAILURE$1 = 1;
const fsCore$1 = {
    codeGenerator: ({ target }) => {
        const content = [];
        if (target === 'assemblyscript') {
            content.push(`
                type fs_OperationId = Int
                type fs_OperationStatus = Int
                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void
                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void
                type fs_Url = string
            `);
        }
        return Sequence$1([
            ...content,
            ConstVar$1('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS$1.toString()),
            ConstVar$1('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE$1.toString()),
            ConstVar$1('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),
            ConstVar$1('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),
            ConstVar$1('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),
            // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to 
            // a function. Therefore we can get false negatives when a test happens to expect a 0.
            Var$1('Int', '_FS_OPERATION_COUNTER', '1'),
            Class$1('fs_SoundInfo', [
                Var$1('Int', 'channelCount'),
                Var$1('Int', 'sampleRate'),
                Var$1('Int', 'bitDepth'),
                Var$1('string', 'encodingFormat'),
                Var$1('string', 'endianness'),
                Var$1('string', 'extraOptions'),
            ]),
            Func$1('fs_soundInfoToMessage', [
                Var$1('fs_SoundInfo', 'soundInfo')
            ], 'Message') `
                ${ConstVar$1('Message', 'info', `msg_create([
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_STRING_TOKEN,
                    soundInfo.encodingFormat.length,
                    MSG_STRING_TOKEN,
                    soundInfo.endianness.length,
                    MSG_STRING_TOKEN,
                    soundInfo.extraOptions.length
                ])`)}
                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))
                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))
                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))
                msg_writeStringToken(info, 3, soundInfo.encodingFormat)
                msg_writeStringToken(info, 4, soundInfo.endianness)
                msg_writeStringToken(info, 5, soundInfo.extraOptions)
                return info
            `,
            Func$1('_fs_assertOperationExists', [
                Var$1('fs_OperationId', 'id'),
                Var$1('string', 'operationName'),
            ], 'void') `
                if (!_FS_OPERATIONS_IDS.has(id)) {
                    throw new Error(operationName + ' operation unknown : ' + id.toString())
                }
            `,
            Func$1('_fs_createOperationId', [], 'fs_OperationId') `
                ${ConstVar$1('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}
                _FS_OPERATIONS_IDS.add(id)
                return id
            `
        ]);
    },
    dependencies: [msg$1],
};
const fsReadSoundFile = {
    codeGenerator: () => Sequence$1([
        Func$1('fs_readSoundFile', [
            Var$1('fs_Url', 'url'),
            Var$1('fs_SoundInfo', 'soundInfo'),
            Var$1('fs_OperationSoundCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)
            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func$1('x_fs_onReadSoundFileResponse', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_OperationStatus', 'status'),
            Var$1('FloatArray[]', 'sound'),
        ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)
            callback(id, status, sound)
            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onReadSoundFileResponse',
        },
    ],
    imports: [
        Func$1('i_fs_readSoundFile', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_Url', 'url'),
            Var$1('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsCore$1],
};
const fsWriteSoundFile = {
    codeGenerator: () => Sequence$1([
        Func$1('fs_writeSoundFile', [
            Var$1('FloatArray[]', 'sound'),
            Var$1('fs_Url', 'url'),
            Var$1('fs_SoundInfo', 'soundInfo'),
            Var$1('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func$1('x_fs_onWriteSoundFileResponse', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_OperationStatus', 'status'),
        ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            ${ConstVar$1('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}
            callback(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onWriteSoundFileResponse',
        },
    ],
    imports: [
        Func$1('i_fs_writeSoundFile', [
            Var$1('fs_OperationId', 'id'),
            Var$1('FloatArray[]', 'sound'),
            Var$1('fs_Url', 'url'),
            Var$1('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsCore$1],
};
const fsSoundStreamCore$1 = {
    codeGenerator: () => Sequence$1([
        ConstVar$1('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),
        ConstVar$1('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),
        Func$1('fs_closeSoundStream', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_OperationStatus', 'status'),
        ], 'void') `
            if (!_FS_OPERATIONS_IDS.has(id)) {
                return
            }
            _FS_OPERATIONS_IDS.delete(id)
            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
            // Delete this last, to give the callback 
            // a chance to save a reference to the buffer
            // If write stream, there won't be a buffer
            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {
                _FS_SOUND_STREAM_BUFFERS.delete(id)
            }
            i_fs_closeSoundStream(id, status)
        `,
        Func$1('x_fs_onCloseSoundStream', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_OperationStatus', 'status'),
        ], 'void') `
            fs_closeSoundStream(id, status)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onCloseSoundStream',
        },
    ],
    imports: [
        Func$1('i_fs_closeSoundStream', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_OperationStatus', 'status'),
        ], 'void') ``,
    ],
    dependencies: [bufCore$1, fsCore$1],
};
const fsReadSoundStream = {
    codeGenerator: () => Sequence$1([
        Func$1('fs_openSoundReadStream', [
            Var$1('fs_Url', 'url'),
            Var$1('fs_SoundInfo', 'soundInfo'),
            Var$1('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}
            ${ConstVar$1('Array<buf_SoundBuffer>', 'buffers', '[]')}
            for (${Var$1('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {
                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))
            }
            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func$1('x_fs_onSoundStreamData', [
            Var$1('fs_OperationId', 'id'),
            Var$1('FloatArray[]', 'block'),
        ], 'Int') `
            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')
            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)
            for (${Var$1('Int', 'i', '0')}; i < buffers.length; i++) {
                buf_pushBlock(buffers[i], block[i])
            }
            return buffers[0].pullAvailableLength
        `
    ]),
    exports: [
        {
            name: 'x_fs_onSoundStreamData',
        },
    ],
    imports: [
        Func$1('i_fs_openSoundReadStream', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_Url', 'url'),
            Var$1('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsSoundStreamCore$1, bufPushPull$1],
};
const fsWriteSoundStream = {
    codeGenerator: () => Sequence$1([
        Func$1('fs_openSoundWriteStream', [
            Var$1('fs_Url', 'url'),
            Var$1('fs_SoundInfo', 'soundInfo'),
            Var$1('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            const id = _fs_createOperationId()
            _FS_SOUND_STREAM_BUFFERS.set(id, [])
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func$1('fs_sendSoundStreamData', [
            Var$1('fs_OperationId', 'id'),
            Var$1('FloatArray[]', 'block')
        ], 'void') `
            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')
            i_fs_sendSoundStreamData(id, block)
        `
    ]),
    imports: [
        Func$1('i_fs_openSoundWriteStream', [
            Var$1('fs_OperationId', 'id'),
            Var$1('fs_Url', 'url'),
            Var$1('Message', 'info'),
        ], 'void') ``,
        Func$1('i_fs_sendSoundStreamData', [
            Var$1('fs_OperationId', 'id'),
            Var$1('FloatArray[]', 'block'),
        ], 'void') ``,
    ],
    dependencies: [fsSoundStreamCore$1],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var precompileDependencies = (compilation) => {
    const { graph, nodeImplementations, precompilation, target, } = compilation;
    const dependencies = flattenDependencies([
        ...engineMinimalDependencies(),
        ..._collectDependenciesFromTraversal(nodeImplementations, graph, precompilation.traversals.all),
    ]);
    // Flatten and de-duplicate all the module's dependencies
    precompilation.dependencies.ast = instantiateAndDedupeDependencies(compilation, dependencies);
    // Collect and attach imports / exports info
    precompilation.dependencies.exports = collectAndDedupeExports(target, dependencies);
    precompilation.dependencies.imports = collectAndDedupeImports(dependencies);
};
const instantiateAndDedupeDependencies = (compilation, dependencies) => {
    const context = _getGlobalCodeGeneratorContext(compilation);
    return Sequence$1(dependencies
        .map((codeDefinition) => isGlobalDefinitionWithSettings(codeDefinition)
        ? codeDefinition.codeGenerator(context)
        : codeDefinition(context))
        .reduce((astElements, astElement) => astElements.every((otherElement) => !_deepEqual(otherElement, astElement))
        ? [...astElements, astElement]
        : astElements, []));
};
const engineMinimalDependencies = () => [
    core,
    commonsCore,
    msg$1,
];
const collectAndDedupeExports = (target, dependencies) => dependencies
    .filter(isGlobalDefinitionWithSettings)
    .filter((codeDefinition) => codeDefinition.exports)
    .reduce((exports, codeDefinition) => [
    ...exports,
    ...codeDefinition.exports.filter((xprt) => (!xprt.targets || xprt.targets.includes(target)) &&
        exports.every((otherExport) => xprt.name !== otherExport.name)),
], []);
const collectAndDedupeImports = (dependencies) => dependencies
    .filter(isGlobalDefinitionWithSettings)
    .filter((codeDefinition) => codeDefinition.imports)
    .reduce((imports, codeDefinition) => [
    ...imports,
    ...codeDefinition.imports.filter((imprt) => imports.every((otherImport) => imprt.name !== otherImport.name)),
], []);
const flattenDependencies = (dependencies) => dependencies.flatMap((codeDefinition) => {
    if (isGlobalDefinitionWithSettings(codeDefinition) &&
        codeDefinition.dependencies) {
        return [
            ...flattenDependencies(codeDefinition.dependencies),
            codeDefinition,
        ];
    }
    else {
        return [codeDefinition];
    }
});
const _collectDependenciesFromTraversal = (nodeImplementations, graph, graphTraversalAll) => {
    return toNodes(graph, graphTraversalAll)
        .reduce((definitions, node) => [
        ...definitions,
        ...getNodeImplementation(nodeImplementations, node.type)
            .dependencies,
    ], []);
};
const _getGlobalCodeGeneratorContext = ({ settings, target, variableNamesIndex }) => ({
    target: target,
    audioSettings: settings.audio,
    globs: variableNamesIndex.globs,
});
const _deepEqual = (ast1, ast2) => 
// This works but this flawed cause {a: 1, b: 2} and {b: 2, a: 1}
// would compare to false.
JSON.stringify(ast1) === JSON.stringify(ast2);

/**
 * Helper to assert that two given AST functions have the same signature.
 */
const assertFuncSignatureEqual = (actual, expected) => {
    if (typeof actual !== 'object' || actual.astType !== 'Func') {
        throw new Error(`Expected an ast Func, got : ${actual}`);
    }
    else if (actual.args.length !== expected.args.length ||
        actual.args.some((arg, i) => arg.type !== expected.args[i].type) ||
        actual.returnType !== expected.returnType) {
        throw new Error(`Func should be have signature ${_printFuncSignature(expected)}` +
            ` got instead ${_printFuncSignature(actual)}`);
    }
    return actual;
};
const _printFuncSignature = (func) => `(${func.args.map((arg) => `${arg.name}: ${arg.type}`).join(', ')}) => ${func.returnType}`;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const MESSAGE_RECEIVER_SIGNATURE = AnonFunc$1([Var$1('Message', 'm')], 'void') ``;
const precompileSignalOutlet = (compilation, node, outletId) => {
    const { precompilation } = compilation;
    const outletSinks = getSinks(node, outletId);
    // Signal inlets can receive input from ONLY ONE signal.
    // Therefore, we substitute inlet variable directly with
    // previous node's outs. e.g. instead of :
    //
    //      NODE2_IN = NODE1_OUT
    //      NODE2_OUT = NODE2_IN * 2
    //
    // we will have :
    //
    //      NODE2_OUT = NODE1_OUT * 2
    //
    if (!isInlinableNode(compilation, node)) {
        const signalOutName = attachNodePortlet(compilation, 'signalOuts', node.id, outletId);
        precompilation.nodes[node.id].signalOuts[outletId] = signalOutName;
        precompilation.nodes[node.id].generationContext.signalOuts[outletId] =
            signalOutName;
        outletSinks.forEach(({ portletId: inletId, nodeId: sinkNodeId }) => {
            precompilation.nodes[sinkNodeId].generationContext.signalIns[inletId] = signalOutName;
        });
    }
};
const precompileSignalInlet = (compilation, sinkNode, inletId) => {
    const { precompilation, variableNamesIndex } = compilation;
    if (getSources(sinkNode, inletId).length === 0) {
        // If signal inlet has no source, we assign it a constant value of 0.
        precompilation.nodes[sinkNode.id].generationContext.signalIns[inletId] =
            variableNamesIndex.globs.nullSignal;
    }
};
const precompileMessageOutlet = (compilation, sourceNode, outletId) => {
    const outletSinks = getSinks(sourceNode, outletId);
    const { variableNamesIndex, precompilation, settings: { io }, } = compilation;
    const ioSendersPortletIds = _getPortletIdsFromMsgIo(io.messageSenders, sourceNode.id);
    const precompiledNode = precompilation.nodes[sourceNode.id];
    const totalSinkCount = _getMessageOutletTotalSinkCount(compilation, sourceNode, outletId);
    // If there are several sinks, we then need to generate
    // a function to send messages to all sinks, e.g. :
    //
    //      const NODE1_SND = (m) => {
    //          NODE3_RCV(m)
    //          NODE2_RCV(m)
    //      }
    //
    if (totalSinkCount > 1) {
        const hasIoSender = ioSendersPortletIds.includes(outletId);
        const messageSenderName = attachNodePortlet(compilation, 'messageSenders', sourceNode.id, outletId);
        precompiledNode.generationContext.messageSenders[outletId] =
            messageSenderName;
        precompiledNode.messageSenders[outletId] = {
            messageSenderName,
            messageReceiverNames: [
                ...outletSinks.map(({ nodeId: sinkNodeId, portletId: inletId }) => variableNamesIndex.nodes[sinkNodeId].messageReceivers[inletId]),
                ...(hasIoSender
                    ? [
                        variableNamesIndex.io.messageSenders[sourceNode.id][outletId],
                    ]
                    : []),
            ],
        };
    }
    // If no sink, no message receiver, we assign the node SND
    // a function that does nothing
    else if (totalSinkCount === 0) {
        precompiledNode.generationContext.messageSenders[outletId] =
            compilation.variableNamesIndex.globs.nullMessageReceiver;
    }
    // For a message outlet that sends to a single sink node
    // its out can be directly replaced by next node's in.
    // e.g. instead of (which is useful if several sinks) :
    //
    //      const NODE1_SND = (m) => {
    //          NODE2_RCV(m)
    //      }
    //      // ...
    //      NODE1_SND(m)
    //
    // we can directly substitute NODE1_SND by NODE2_RCV :
    //
    //      NODE2_RCV(m)
    //
    else if (outletSinks.length === 1 &&
        !ioSendersPortletIds.includes(outletId)) {
        precompiledNode.generationContext.messageSenders[outletId] =
            variableNamesIndex.nodes[outletSinks[0].nodeId].messageReceivers[outletSinks[0].portletId];
    }
    // Same thing if there's no sink, but one outlet listener
    else if (outletSinks.length === 0 &&
        ioSendersPortletIds.includes(outletId)) {
        precompiledNode.generationContext.messageSenders[outletId] =
            variableNamesIndex.io.messageSenders[sourceNode.id][outletId];
    }
};
const precompileMessageInlet = (compilation, node, inletId) => {
    const precompiledNode = compilation.precompilation.nodes[node.id];
    if (_getMessageInletTotalSourceCount(compilation, node, inletId) >= 1) {
        const messageReceiverName = attachNodePortlet(compilation, 'messageReceivers', node.id, inletId);
        precompiledNode.generationContext.messageReceivers[inletId] =
            messageReceiverName;
        // Add a placeholder message receiver that should be substituted when
        // compiling message receivers.
        precompiledNode.messageReceivers[inletId] = Func$1(messageReceiverName, [Var$1('Message', 'm')], 'void') `throw new Error("This placeholder should have been replaced during compilation")`;
    }
};
const precompileMessageReceivers = (compilation, node) => {
    const { precompilation, variableNamesIndex, nodeImplementations } = compilation;
    const precompiledNode = precompilation.nodes[node.id];
    const { globs } = variableNamesIndex;
    const { state, messageSenders: snds } = precompiledNode.generationContext;
    const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
    const messageReceivers = createNamespace(nodeNamespaceLabel(node, 'messageReceivers'), nodeImplementation.messageReceivers
        ? nodeImplementation.messageReceivers({
            globs,
            state,
            snds,
            node,
            compilation,
        })
        : {});
    Object.keys(precompiledNode.messageReceivers).forEach((inletId) => {
        const implementedFunc = messageReceivers[inletId];
        assertFuncSignatureEqual(implementedFunc, MESSAGE_RECEIVER_SIGNATURE);
        const targetFunc = precompiledNode.messageReceivers[inletId];
        // We can't override values in the namespace, so we need to copy
        // the function's properties one by one.
        targetFunc.name =
            variableNamesIndex.nodes[node.id].messageReceivers[inletId];
        targetFunc.args = implementedFunc.args;
        targetFunc.body = implementedFunc.body;
        targetFunc.returnType = implementedFunc.returnType;
    });
};
const precompileInitialization = (compilation, node) => {
    const { precompilation, nodeImplementations, variableNamesIndex } = compilation;
    const { globs } = variableNamesIndex;
    const precompiledNode = precompilation.nodes[node.id];
    const { state, messageSenders: snds } = precompiledNode.generationContext;
    const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
    precompiledNode.initialization = nodeImplementation.initialization
        ? nodeImplementation.initialization({
            globs,
            state,
            snds,
            node,
            compilation,
        })
        : ast$1 ``;
};
const precompileLoop = (compilation, node) => {
    const { precompilation, nodeImplementations, variableNamesIndex } = compilation;
    const precompiledNode = precompilation.nodes[node.id];
    const { globs } = variableNamesIndex;
    const { signalOuts: outs, signalIns: ins, messageSenders: snds, state, } = precompiledNode.generationContext;
    const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
    const baseContext = {
        globs,
        node,
        state,
        ins,
        compilation,
    };
    // Nodes that come here might have an inlinable loop, but still can't
    // be inlined because, for example, they have 2 sinks.
    if (nodeImplementation.inlineLoop) {
        const outletId = Object.keys(node.outlets)[0];
        precompiledNode.loop = ast$1 `${variableNamesIndex.nodes[node.id].signalOuts[outletId]} = ${nodeImplementation.inlineLoop(baseContext)}`;
    }
    else if (nodeImplementation.loop) {
        precompiledNode.loop = nodeImplementation.loop({
            ...baseContext,
            outs,
            snds,
        });
    }
    else {
        throw new Error(`No loop to generate for node ${node.type}:${node.id}`);
    }
};
/**
 * Inlines a subtree of inlinable nodes into a single string.
 * That string is then injected as signal input of the first non-inlinable sink.
 * e.g. :
 *
 * ```
 *          [  n1  ]      <-  inlinable subtree
 *               \          /
 *    [  n2  ]  [  n3  ]  <-
 *      \        /
 *       \      /
 *        \    /
 *       [  n4  ]  <- leaf node for the inlinable subtree
 *           |
 *       [  n5  ]  <- first non-inlinable sink
 *
 * ```
 */
const precompileInlineLoop = (compilation, leafNode) => {
    const { precompilation, variableNamesIndex, nodeImplementations, graph, target, } = compilation;
    const { globs } = variableNamesIndex;
    const inlineNodeTraversal = signalNodes(graph, [leafNode], (sourceNode) => isInlinableNode(compilation, sourceNode));
    const inlinedNodes = inlineNodeTraversal.reduce((inlinedNodes, nodeId) => {
        const { signalIns: ins, state } = precompilation.nodes[nodeId].generationContext;
        const node = getNode(graph, nodeId);
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        const inlinedInputs = mapArray(
        // Select signal inlets with sources
        Object.values(node.inlets)
            .map((inlet) => [inlet, getSources(node, inlet.id)])
            .filter(([inlet, sources]) => inlet.type === 'signal' &&
            sources.length > 0 &&
            // We filter out sources that are not inlinable.
            // These sources will just be represented by their outlet's
            // variable name.
            inlineNodeTraversal.includes(sources[0].nodeId)), 
        // Build map of inlined inputs
        ([inlet, sources]) => {
            // Because it's a signal connection, we have only one source per inlet
            const source = sources[0];
            if (!(source.nodeId in inlinedNodes)) {
                throw new Error(`Unexpected error : inlining failed, missing inlined source ${source.nodeId}`);
            }
            return [inlet.id, inlinedNodes[source.nodeId]];
        });
        // TODO assemblyscript-upgrade : we need this because of a assemblyscript bug that seems
        // to be fixed in latest version. Remove when upgrading.
        // Bugs when a single variable name is surrounded with brackets : e.g. `(node1_OUTS_0)`
        // causes compilation error.
        const inlined = nodeImplementation.inlineLoop({
            globs,
            state,
            ins: createNamespace(nodeNamespaceLabel(node, 'ins'), {
                ...ins,
                ...inlinedInputs,
            }),
            node,
            compilation,
        });
        const needsFix = inlined.content.length > 1 ||
            (typeof inlined.content[0] === 'string' &&
                inlined.content[0].includes(' '));
        if (needsFix) {
            inlined.content.unshift('(');
            inlined.content.push(')');
        }
        // END TODO
        return {
            ...inlinedNodes,
            [nodeId]: render(getMacros(target), inlined),
        };
    }, {});
    const sink = getInlinableNodeSinkList(leafNode)[0];
    precompilation.nodes[sink.nodeId].generationContext.signalIns[sink.portletId] = inlinedNodes[leafNode.id];
    return inlineNodeTraversal;
};
const isInlinableNode = (compilation, node) => {
    const { nodeImplementations } = compilation;
    const sinkList = getInlinableNodeSinkList(node);
    const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
    return !!nodeImplementation.inlineLoop && sinkList.length === 1;
};
/**
 * Inline node has only one outlet, but that outlet can be connected to
 * several sinks.
 */
const getInlinableNodeSinkList = (node) => Object.values(node.sinks)[0] || [];
const _getMessageInletTotalSourceCount = (compilation, node, inletId) => {
    const { settings: { io }, } = compilation;
    const ioReceiversPortletIds = _getPortletIdsFromMsgIo(io.messageReceivers, node.id);
    const inletSources = getSources(node, inletId);
    return inletSources.length + +ioReceiversPortletIds.includes(inletId);
};
const _getMessageOutletTotalSinkCount = (compilation, node, outletId) => {
    const { settings: { io }, } = compilation;
    const ioSendersPortletIds = _getPortletIdsFromMsgIo(io.messageSenders, node.id);
    const outletSinks = getSinks(node, outletId);
    return outletSinks.length + +ioSendersPortletIds.includes(outletId);
};
const _getPortletIdsFromMsgIo = (specs, nodeId) => (specs[nodeId] && specs[nodeId].portletIds) || [];

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var precompile = (compilation) => {
    const { graph, precompilation } = compilation;
    const nodes = toNodes(graph, precompilation.traversals.all);
    attachIoMessages(compilation);
    precompileDependencies(compilation);
    // Go through the graph and precompile inlets.
    nodes.forEach((node) => {
        Object.values(node.inlets).forEach((inlet) => {
            if (inlet.type === 'signal') {
                precompileSignalInlet(compilation, node, inlet.id);
            }
            else if (inlet.type === 'message') {
                precompileMessageInlet(compilation, node, inlet.id);
            }
        });
    });
    // Go through the graph and precompile outlets.
    //
    // For example if a node has only one sink there is no need
    // to copy values between outlet and sink's inlet. Instead we can
    // collapse these two variables into one.
    //
    // We need to compile outlets after inlets because they reference
    // message receivers.
    nodes.forEach((node) => {
        Object.values(node.outlets).forEach((outlet) => {
            if (outlet.type === 'signal') {
                precompileSignalOutlet(compilation, node, outlet.id);
            }
            else if (outlet.type === 'message') {
                precompileMessageOutlet(compilation, node, outlet.id);
            }
        });
    });
    // This must come after we have assigned all node variables,
    nodes.forEach((node) => {
        precompileInitialization(compilation, node);
        precompileMessageReceivers(compilation, node);
    });
    const graphTraversalSignal = buildGraphTraversalSignal(graph);
    // First inline nodes that can be inlined.
    // Once inlined, these nodes don't have to be part of the loop traversal.
    toNodes(graph, graphTraversalSignal)
        .filter((node) => _isInlinableLeafNode(compilation, node))
        .forEach((node) => {
        const inlineNodeTraversal = precompileInlineLoop(compilation, node);
        inlineNodeTraversal.forEach((nodeId) => {
            graphTraversalSignal.splice(graphTraversalSignal.indexOf(nodeId), 1);
        });
    });
    // Then deal with non-inlinable signal nodes.
    toNodes(graph, graphTraversalSignal).forEach((node) => {
        precompilation.traversals.loop.push(node.id);
        precompileLoop(compilation, node);
    });
};
const initializePrecompilation = (graph, graphTraversalAll, variableNamesIndex) => ({
    nodes: createNamespace('precompilation', mapObject(graph, (node) => ({
        generationContext: {
            messageReceivers: createNamespace(nodeNamespaceLabel(node, 'generationContext:messageReceivers'), {}),
            signalOuts: createNamespace(nodeNamespaceLabel(node, 'generationContext:signalOuts'), {}),
            messageSenders: createNamespace(nodeNamespaceLabel(node, 'generationContext:messageSenders'), {}),
            signalIns: createNamespace(nodeNamespaceLabel(node, 'generationContext:signalIns'), {}),
            state: variableNamesIndex.nodes[node.id].state,
        },
        messageReceivers: createNamespace(nodeNamespaceLabel(node, 'messageReceivers'), {}),
        messageSenders: createNamespace(nodeNamespaceLabel(node, 'messageSenders'), {}),
        signalOuts: createNamespace(nodeNamespaceLabel(node, 'signalOuts'), {}),
        initialization: ast$1 ``,
        loop: ast$1 ``,
    }))),
    dependencies: {
        imports: [],
        exports: [],
        ast: Sequence$1([]),
    },
    traversals: {
        all: graphTraversalAll,
        loop: [],
    },
});
const _isInlinableLeafNode = (compilation, node) => {
    const { graph } = compilation;
    const sink = getInlinableNodeSinkList(node)[0];
    if (!sink) {
        return false;
    }
    const sinkNode = getNode(graph, sink.nodeId);
    return (isInlinableNode(compilation, node) &&
        !isInlinableNode(compilation, sinkNode));
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
var index = (graph, nodeImplementations, target, compilationSettings) => {
    const settings = validateSettings(compilationSettings);
    const variableNamesIndex = generateVariableNamesIndex(graph, settings.debug);
    const graphTraversalAll = buildGraphTraversalAll(graph, settings.io);
    const trimmedGraph = trimGraph(graph, graphTraversalAll);
    const compilation = {
        graph: trimmedGraph,
        nodeImplementations,
        target,
        settings,
        variableNamesIndex,
        precompilation: initializePrecompilation(trimmedGraph, graphTraversalAll, variableNamesIndex),
    };
    precompile(compilation);
    let code;
    if (compilation.target === 'javascript') {
        code = compileToJavascript(compilation);
    }
    else if (compilation.target === 'assemblyscript') {
        code = compileToAssemblyscript(compilation);
    }
    else {
        throw new Error(`Invalid compilation.target ${compilation.target}`);
    }
    return {
        status: 0,
        code,
    };
};
/** Asserts user provided settings are valid (or throws error) and sets default values. */
const validateSettings = (compilationSettings) => {
    const arrays = compilationSettings.arrays || {};
    const io = {
        messageReceivers: (compilationSettings.io || {}).messageReceivers || {},
        messageSenders: (compilationSettings.io || {}).messageSenders || {},
    };
    const debug = compilationSettings.debug || false;
    const audio = compilationSettings.audio || {
        channelCount: { in: 2, out: 2 },
        bitDepth: 64,
    };
    if (![32, 64].includes(audio.bitDepth)) {
        throw new InvalidSettingsError(`"bitDepth" can be only 32 or 64`);
    }
    return {
        audio,
        arrays,
        io,
        debug,
    };
};
class InvalidSettingsError extends Error {
}

var WEBPD_RUNTIME_CODE = "var WebPdRuntime = (function (exports) {\n  'use strict';\n\n  var _WebPdWorkletProcessorCode = \"/*\\n * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\\n *\\n * This file is part of WebPd\\n * (see https://github.com/sebpiq/WebPd).\\n *\\n * This program is free software: you can redistribute it and/or modify\\n * it under the terms of the GNU Lesser General Public License as published by\\n * the Free Software Foundation, either version 3 of the License, or\\n * (at your option) any later version.\\n *\\n * This program is distributed in the hope that it will be useful,\\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\\n * GNU Lesser General Public License for more details.\\n *\\n * You should have received a copy of the GNU Lesser General Public License\\n * along with this program. If not, see <http://www.gnu.org/licenses/>.\\n */\\nconst FS_CALLBACK_NAMES = [\\n    'onReadSoundFile',\\n    'onOpenSoundReadStream',\\n    'onWriteSoundFile',\\n    'onOpenSoundWriteStream',\\n    'onSoundStreamData',\\n    'onCloseSoundStream',\\n];\\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\\n    constructor() {\\n        super();\\n        this.port.onmessage = this.onMessage.bind(this);\\n        this.settings = {\\n            blockSize: null,\\n            sampleRate,\\n        };\\n        this.dspConfigured = false;\\n        this.engine = null;\\n    }\\n    process(inputs, outputs) {\\n        const output = outputs[0];\\n        const input = inputs[0];\\n        if (!this.dspConfigured) {\\n            if (!this.engine) {\\n                return true;\\n            }\\n            this.settings.blockSize = output[0].length;\\n            this.engine.configure(this.settings.sampleRate, this.settings.blockSize);\\n            this.dspConfigured = true;\\n        }\\n        this.engine.loop(input, output);\\n        return true;\\n    }\\n    onMessage(messageEvent) {\\n        const message = messageEvent.data;\\n        switch (message.type) {\\n            case 'code:WASM':\\n                this.setWasm(message.payload.wasmBuffer);\\n                break;\\n            case 'code:JS':\\n                this.setJsCode(message.payload.jsCode);\\n                break;\\n            case 'io:messageReceiver':\\n                this.engine.io.messageReceivers[message.payload.nodeId][message.payload.portletId](message.payload.message);\\n                break;\\n            case 'fs':\\n                const returned = this.engine.fs[message.payload.functionName].apply(null, message.payload.arguments);\\n                this.port.postMessage({\\n                    type: 'fs',\\n                    payload: {\\n                        functionName: message.payload.functionName + '_return',\\n                        operationId: message.payload.arguments[0],\\n                        returned,\\n                    },\\n                });\\n                break;\\n            case 'destroy':\\n                this.destroy();\\n                break;\\n            default:\\n                new Error(`unknown message type ${message.type}`);\\n        }\\n    }\\n    // TODO : control for channelCount of wasmModule\\n    setWasm(wasmBuffer) {\\n        return AssemblyScriptWasmBindings.createEngine(wasmBuffer).then((engine) => this.setEngine(engine));\\n    }\\n    setJsCode(code) {\\n        const engine = JavaScriptBindings.createEngine(code);\\n        this.setEngine(engine);\\n    }\\n    setEngine(engine) {\\n        FS_CALLBACK_NAMES.forEach((functionName) => {\\n            ;\\n            engine.fs[functionName] = (...args) => {\\n                // We don't use transferables, because that would imply reallocating each time new array in the engine.\\n                this.port.postMessage({\\n                    type: 'fs',\\n                    payload: {\\n                        functionName,\\n                        arguments: args,\\n                    },\\n                });\\n            };\\n        });\\n        this.engine = engine;\\n        this.dspConfigured = false;\\n    }\\n    destroy() {\\n        this.process = () => false;\\n    }\\n}\\nregisterProcessor('webpd-node', WasmWorkletProcessor);\\n\";\n\n  var AssemblyScriptWasmBindingsCode = \"var AssemblyScriptWasmBindings = (function (exports) {\\n    'use strict';\\n\\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\\n    const createModule = (rawModule, bindings) => new Proxy({}, {\\n        get: (_, k) => {\\n            if (bindings.hasOwnProperty(k)) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                switch (bindingSpec.type) {\\n                    case 'raw':\\n                        if (k in rawModule) {\\n                            return rawModule[key];\\n                        }\\n                        else {\\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\\n                        }\\n                    case 'proxy':\\n                    case 'callback':\\n                        return bindingSpec.value;\\n                }\\n            }\\n            else {\\n                return undefined;\\n            }\\n        },\\n        set: (_, k, newValue) => {\\n            if (bindings.hasOwnProperty(String(k))) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                if (bindingSpec.type === 'callback') {\\n                    bindingSpec.value = newValue;\\n                }\\n                else {\\n                    throw new Error(`Binding key ${String(key)} is read-only`);\\n                }\\n            }\\n            else {\\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\\n            }\\n            return true;\\n        },\\n    });\\n\\n    const liftString = (wasmExports, pointer) => {\\n        if (!pointer)\\n            return null;\\n        pointer = pointer >>> 0;\\n        const end = (pointer +\\n            new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\\n            1;\\n        const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\\n        let start = pointer >>> 1;\\n        let string = '';\\n        while (end - start > 1024) {\\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\\n        }\\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\\n    };\\n    const lowerString = (wasmExports, value) => {\\n        if (value == null)\\n            return 0;\\n        const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);\\n        for (let i = 0; i < length; ++i)\\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\\n        return pointer;\\n    };\\n    const readTypedArray = (wasmExports, constructor, pointer) => {\\n        if (!pointer)\\n            return null;\\n        const memoryU32 = new Uint32Array(wasmExports.memory.buffer);\\n        return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\\n    };\\n    const lowerFloatArray = (wasmExports, bitDepth, data) => {\\n        const arrayType = getFloatArrayType(bitDepth);\\n        const arrayPointer = wasmExports.createFloatArray(data.length);\\n        const array = readTypedArray(wasmExports, arrayType, arrayPointer);\\n        array.set(data);\\n        return { array, arrayPointer };\\n    };\\n    const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {\\n        const arraysPointer = wasmExports.x_core_createListOfArrays();\\n        data.forEach((array) => {\\n            const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);\\n            wasmExports.x_core_pushToListOfArrays(arraysPointer, arrayPointer);\\n        });\\n        return arraysPointer;\\n    };\\n    const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {\\n        const listLength = wasmExports.x_core_getListOfArraysLength(listOfArraysPointer);\\n        const arrays = [];\\n        const arrayType = getFloatArrayType(bitDepth);\\n        for (let i = 0; i < listLength; i++) {\\n            const arrayPointer = wasmExports.x_core_getListOfArraysElem(listOfArraysPointer, i);\\n            arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));\\n        }\\n        return arrays;\\n    };\\n\\n    const liftMessage = (wasmExports, messagePointer) => {\\n        const messageTokenTypesPointer = wasmExports.x_msg_getTokenTypes(messagePointer);\\n        const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);\\n        const message = [];\\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\\n            if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {\\n                message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));\\n            }\\n            else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {\\n                const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);\\n                message.push(liftString(wasmExports, stringPointer));\\n            }\\n        });\\n        return message;\\n    };\\n    const lowerMessage = (wasmExports, message) => {\\n        const template = message.reduce((template, value) => {\\n            if (typeof value === 'number') {\\n                template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());\\n            }\\n            else if (typeof value === 'string') {\\n                template.push(wasmExports.MSG_STRING_TOKEN.valueOf());\\n                template.push(value.length);\\n            }\\n            else {\\n                throw new Error(`invalid message value ${value}`);\\n            }\\n            return template;\\n        }, []);\\n        const templateArrayPointer = wasmExports.x_msg_createTemplate(template.length);\\n        const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);\\n        loweredTemplateArray.set(template);\\n        const messagePointer = wasmExports.x_msg_create(templateArrayPointer);\\n        message.forEach((value, index) => {\\n            if (typeof value === 'number') {\\n                wasmExports.msg_writeFloatToken(messagePointer, index, value);\\n            }\\n            else if (typeof value === 'string') {\\n                const stringPointer = lowerString(wasmExports, value);\\n                wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);\\n            }\\n        });\\n        return messagePointer;\\n    };\\n\\n    const mapObject = (src, func) => {\\n        const dest = {};\\n        Object.entries(src).forEach(([key, srcValue], i) => {\\n            dest[key] = func(srcValue, key, i);\\n        });\\n        return dest;\\n    };\\n    const mapArray = (src, func) => {\\n        const dest = {};\\n        src.forEach((srcValue, i) => {\\n            const [key, destValue] = func(srcValue, i);\\n            dest[key] = destValue;\\n        });\\n        return dest;\\n    };\\n\\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\\n            env: {\\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\\n                    const message = liftString(wasmExports, messagePointer);\\n                    lineNumber = lineNumber;\\n                    columnNumber = columnNumber;\\n                    (() => {\\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\\n                    })();\\n                },\\n                seed: () => {\\n                    return (() => {\\n                        return Date.now() * Math.random();\\n                    })();\\n                },\\n                'console.log': (textPointer) => {\\n                    console.log(liftString(wasmExports, textPointer));\\n                },\\n            },\\n            ...wasmImports,\\n        });\\n        const wasmExports = instanceAndModule.instance\\n            .exports;\\n        return instanceAndModule.instance;\\n    };\\n\\n    const updateWasmInOuts = (rawModule, engineData) => {\\n        engineData.wasmOutput = readTypedArray(rawModule, engineData.arrayType, rawModule.getOutput());\\n        engineData.wasmInput = readTypedArray(rawModule, engineData.arrayType, rawModule.getInput());\\n    };\\n    const createEngineLifecycleBindings = (rawModule, engineData) => {\\n        return {\\n            configure: {\\n                type: 'proxy',\\n                value: (sampleRate, blockSize) => {\\n                    engineData.metadata.audioSettings.blockSize = blockSize;\\n                    engineData.metadata.audioSettings.sampleRate = sampleRate;\\n                    engineData.blockSize = blockSize;\\n                    rawModule.configure(sampleRate, blockSize);\\n                    updateWasmInOuts(rawModule, engineData);\\n                },\\n            },\\n            loop: {\\n                type: 'proxy',\\n                value: (input, output) => {\\n                    for (let channel = 0; channel < input.length; channel++) {\\n                        engineData.wasmInput.set(input[channel], channel * engineData.blockSize);\\n                    }\\n                    updateWasmInOuts(rawModule, engineData);\\n                    rawModule.loop();\\n                    updateWasmInOuts(rawModule, engineData);\\n                    for (let channel = 0; channel < output.length; channel++) {\\n                        output[channel].set(engineData.wasmOutput.subarray(engineData.blockSize * channel, engineData.blockSize * (channel + 1)));\\n                    }\\n                },\\n            },\\n        };\\n    };\\n    const createIoMessageReceiversBindings = (rawModule, engineData) => mapObject(engineData.metadata.compilation.io.messageReceivers, (spec, nodeId) => ({\\n        type: 'proxy',\\n        value: mapArray(spec.portletIds, (inletId) => [\\n            inletId,\\n            (message) => {\\n                const messagePointer = lowerMessage(rawModule, message);\\n                rawModule[engineData.metadata.compilation.variableNamesIndex.io\\n                    .messageReceivers[nodeId][inletId]](messagePointer);\\n            },\\n        ]),\\n    }));\\n    const createIoMessageSendersBindings = (_, engineData) => mapObject(engineData.metadata.compilation.io.messageSenders, (spec) => ({\\n        type: 'proxy',\\n        value: mapArray(spec.portletIds, (outletId) => [\\n            outletId,\\n            {\\n                onMessage: () => undefined,\\n            },\\n        ]),\\n    }));\\n    const ioMsgSendersImports = (forwardReferences, metadata) => {\\n        const wasmImports = {};\\n        const { variableNamesIndex } = metadata.compilation;\\n        Object.entries(metadata.compilation.io.messageSenders).forEach(([nodeId, spec]) => {\\n            spec.portletIds.forEach((outletId) => {\\n                const listenerName = variableNamesIndex.io.messageSenders[nodeId][outletId];\\n                wasmImports[listenerName] = (messagePointer) => {\\n                    const message = liftMessage(forwardReferences.rawModule, messagePointer);\\n                    forwardReferences.modules.io.messageSenders[nodeId][outletId].onMessage(message);\\n                };\\n            });\\n        });\\n        return wasmImports;\\n    };\\n    const readMetadata = async (wasmBuffer) => {\\n        const inputImports = {};\\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\\n        wasmModule\\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\\n            input: inputImports,\\n        });\\n        const wasmExports = wasmInstance.exports;\\n        const stringPointer = wasmExports.metadata.valueOf();\\n        const metadataJSON = liftString(wasmExports, stringPointer);\\n        return JSON.parse(metadataJSON);\\n    };\\n\\n    const createFsBindings = (rawModule, engineData) => ({\\n        sendReadSoundFileResponse: {\\n            type: 'proxy',\\n            value: (operationId, status, sound) => {\\n                let soundPointer = 0;\\n                if (sound) {\\n                    soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\\n                }\\n                rawModule.x_fs_onReadSoundFileResponse(operationId, status, soundPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n            },\\n        },\\n        sendWriteSoundFileResponse: {\\n            type: 'proxy',\\n            value: rawModule.x_fs_onWriteSoundFileResponse,\\n        },\\n        sendSoundStreamData: {\\n            type: 'proxy',\\n            value: (operationId, sound) => {\\n                const soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\\n                const writtenFrameCount = rawModule.x_fs_onSoundStreamData(operationId, soundPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n                return writtenFrameCount;\\n            },\\n        },\\n        closeSoundStream: {\\n            type: 'proxy',\\n            value: rawModule.x_fs_onCloseSoundStream,\\n        },\\n        onReadSoundFile: { type: 'callback', value: () => undefined },\\n        onWriteSoundFile: { type: 'callback', value: () => undefined },\\n        onOpenSoundReadStream: { type: 'callback', value: () => undefined },\\n        onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\\n        onSoundStreamData: { type: 'callback', value: () => undefined },\\n        onCloseSoundStream: { type: 'callback', value: () => undefined },\\n    });\\n    const createFsImports = (forwardReferences) => {\\n        let wasmImports = {\\n            i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onReadSoundFile(operationId, url, info);\\n            },\\n            i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {\\n                const sound = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, soundPointer);\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onWriteSoundFile(operationId, sound, url, info);\\n            },\\n            i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                updateWasmInOuts(forwardReferences.rawModule, forwardReferences.engineData);\\n                forwardReferences.modules.fs.onOpenSoundReadStream(operationId, url, info);\\n            },\\n            i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onOpenSoundWriteStream(operationId, url, info);\\n            },\\n            i_fs_sendSoundStreamData: (operationId, blockPointer) => {\\n                const block = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, blockPointer);\\n                forwardReferences.modules.fs.onSoundStreamData(operationId, block);\\n            },\\n            i_fs_closeSoundStream: (...args) => forwardReferences.modules.fs.onCloseSoundStream(...args),\\n        };\\n        return wasmImports;\\n    };\\n\\n    const createCommonsBindings = (rawModule, engineData) => ({\\n        getArray: {\\n            type: 'proxy',\\n            value: (arrayName) => {\\n                const arrayNamePointer = lowerString(rawModule, arrayName);\\n                const arrayPointer = rawModule.commons_getArray(arrayNamePointer);\\n                return readTypedArray(rawModule, engineData.arrayType, arrayPointer);\\n            },\\n        },\\n        setArray: {\\n            type: 'proxy',\\n            value: (arrayName, array) => {\\n                const stringPointer = lowerString(rawModule, arrayName);\\n                const { arrayPointer } = lowerFloatArray(rawModule, engineData.bitDepth, array);\\n                rawModule.commons_setArray(stringPointer, arrayPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n            },\\n        },\\n    });\\n\\n    const createEngine = async (wasmBuffer) => {\\n        const { rawModule, engineData, forwardReferences } = await createRawModule(wasmBuffer);\\n        const engineBindings = await createBindings(rawModule, engineData, forwardReferences);\\n        return createModule(rawModule, engineBindings);\\n    };\\n    const createRawModule = async (wasmBuffer) => {\\n        const metadata = await readMetadata(wasmBuffer);\\n        const forwardReferences = { modules: {} };\\n        const wasmImports = {\\n            ...createFsImports(forwardReferences),\\n            ...ioMsgSendersImports(forwardReferences, metadata),\\n        };\\n        const bitDepth = metadata.audioSettings.bitDepth;\\n        const arrayType = getFloatArrayType(bitDepth);\\n        const engineData = {\\n            metadata,\\n            wasmOutput: new arrayType(0),\\n            wasmInput: new arrayType(0),\\n            arrayType,\\n            bitDepth,\\n            blockSize: 0,\\n        };\\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\\n            input: wasmImports,\\n        });\\n        const rawModule = wasmInstance.exports;\\n        return { rawModule, engineData, forwardReferences };\\n    };\\n    const createBindings = async (rawModule, engineData, forwardReferences) => {\\n        const commons = createModule(rawModule, createCommonsBindings(rawModule, engineData));\\n        const fs = createModule(rawModule, createFsBindings(rawModule, engineData));\\n        const io = {\\n            messageReceivers: createModule(rawModule, createIoMessageReceiversBindings(rawModule, engineData)),\\n            messageSenders: createModule(rawModule, createIoMessageSendersBindings(rawModule, engineData)),\\n        };\\n        forwardReferences.modules.fs = fs;\\n        forwardReferences.modules.io = io;\\n        forwardReferences.engineData = engineData;\\n        forwardReferences.rawModule = rawModule;\\n        return {\\n            ...createEngineLifecycleBindings(rawModule, engineData),\\n            metadata: { type: 'proxy', value: engineData.metadata },\\n            commons: { type: 'proxy', value: commons },\\n            fs: { type: 'proxy', value: fs },\\n            io: { type: 'proxy', value: io },\\n        };\\n    };\\n\\n    exports.createBindings = createBindings;\\n    exports.createEngine = createEngine;\\n    exports.createRawModule = createRawModule;\\n\\n    return exports;\\n\\n})({});\\n\";\n\n  var JavaScriptBindingsCode = \"var JavaScriptBindings = (function (exports) {\\n    'use strict';\\n\\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\\n    const createModule = (rawModule, bindings) => new Proxy({}, {\\n        get: (_, k) => {\\n            if (bindings.hasOwnProperty(k)) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                switch (bindingSpec.type) {\\n                    case 'raw':\\n                        if (k in rawModule) {\\n                            return rawModule[key];\\n                        }\\n                        else {\\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\\n                        }\\n                    case 'proxy':\\n                    case 'callback':\\n                        return bindingSpec.value;\\n                }\\n            }\\n            else {\\n                return undefined;\\n            }\\n        },\\n        set: (_, k, newValue) => {\\n            if (bindings.hasOwnProperty(String(k))) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                if (bindingSpec.type === 'callback') {\\n                    bindingSpec.value = newValue;\\n                }\\n                else {\\n                    throw new Error(`Binding key ${String(key)} is read-only`);\\n                }\\n            }\\n            else {\\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\\n            }\\n            return true;\\n        },\\n    });\\n\\n    const createRawModule = (code) => new Function(`\\n        ${code}\\n        return exports\\n    `)();\\n    const createBindings = (rawModule) => ({\\n        fs: { type: 'proxy', value: createFsModule(rawModule) },\\n        metadata: { type: 'raw' },\\n        configure: { type: 'raw' },\\n        loop: { type: 'raw' },\\n        io: { type: 'raw' },\\n        commons: {\\n            type: 'proxy',\\n            value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),\\n        },\\n    });\\n    const createEngine = (code) => {\\n        const rawModule = createRawModule(code);\\n        return createModule(rawModule, createBindings(rawModule));\\n    };\\n    const createFsModule = (rawModule) => {\\n        const fs = createModule(rawModule, {\\n            onReadSoundFile: { type: 'callback', value: () => undefined },\\n            onWriteSoundFile: { type: 'callback', value: () => undefined },\\n            onOpenSoundReadStream: { type: 'callback', value: () => undefined },\\n            onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\\n            onSoundStreamData: { type: 'callback', value: () => undefined },\\n            onCloseSoundStream: { type: 'callback', value: () => undefined },\\n            sendReadSoundFileResponse: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onReadSoundFileResponse,\\n            },\\n            sendWriteSoundFileResponse: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onWriteSoundFileResponse,\\n            },\\n            sendSoundStreamData: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onSoundStreamData,\\n            },\\n            closeSoundStream: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onCloseSoundStream,\\n            },\\n        });\\n        rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);\\n        rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);\\n        rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);\\n        rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);\\n        rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);\\n        rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);\\n        return fs;\\n    };\\n    const createCommonsModule = (rawModule, bitDepth) => {\\n        const floatArrayType = getFloatArrayType(bitDepth);\\n        return createModule(rawModule, {\\n            getArray: { type: 'proxy', value: rawModule.commons_getArray },\\n            setArray: {\\n                type: 'proxy',\\n                value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),\\n            },\\n        });\\n    };\\n\\n    exports.createBindings = createBindings;\\n    exports.createEngine = createEngine;\\n    exports.createRawModule = createRawModule;\\n\\n    return exports;\\n\\n})({});\\n\";\n\n  var fetchRetry$1 = function (fetch, defaults) {\n    defaults = defaults || {};\n    if (typeof fetch !== 'function') {\n      throw new ArgumentError('fetch must be a function');\n    }\n\n    if (typeof defaults !== 'object') {\n      throw new ArgumentError('defaults must be an object');\n    }\n\n    if (defaults.retries !== undefined && !isPositiveInteger(defaults.retries)) {\n      throw new ArgumentError('retries must be a positive integer');\n    }\n\n    if (defaults.retryDelay !== undefined && !isPositiveInteger(defaults.retryDelay) && typeof defaults.retryDelay !== 'function') {\n      throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');\n    }\n\n    if (defaults.retryOn !== undefined && !Array.isArray(defaults.retryOn) && typeof defaults.retryOn !== 'function') {\n      throw new ArgumentError('retryOn property expects an array or function');\n    }\n\n    var baseDefaults = {\n      retries: 3,\n      retryDelay: 1000,\n      retryOn: [],\n    };\n\n    defaults = Object.assign(baseDefaults, defaults);\n\n    return function fetchRetry(input, init) {\n      var retries = defaults.retries;\n      var retryDelay = defaults.retryDelay;\n      var retryOn = defaults.retryOn;\n\n      if (init && init.retries !== undefined) {\n        if (isPositiveInteger(init.retries)) {\n          retries = init.retries;\n        } else {\n          throw new ArgumentError('retries must be a positive integer');\n        }\n      }\n\n      if (init && init.retryDelay !== undefined) {\n        if (isPositiveInteger(init.retryDelay) || (typeof init.retryDelay === 'function')) {\n          retryDelay = init.retryDelay;\n        } else {\n          throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');\n        }\n      }\n\n      if (init && init.retryOn) {\n        if (Array.isArray(init.retryOn) || (typeof init.retryOn === 'function')) {\n          retryOn = init.retryOn;\n        } else {\n          throw new ArgumentError('retryOn property expects an array or function');\n        }\n      }\n\n      // eslint-disable-next-line no-undef\n      return new Promise(function (resolve, reject) {\n        var wrappedFetch = function (attempt) {\n          // As of node 18, this is no longer needed since node comes with native support for fetch:\n          /* istanbul ignore next */\n          var _input =\n            typeof Request !== 'undefined' && input instanceof Request\n              ? input.clone()\n              : input;\n          fetch(_input, init)\n            .then(function (response) {\n              if (Array.isArray(retryOn) && retryOn.indexOf(response.status) === -1) {\n                resolve(response);\n              } else if (typeof retryOn === 'function') {\n                try {\n                  // eslint-disable-next-line no-undef\n                  return Promise.resolve(retryOn(attempt, null, response))\n                    .then(function (retryOnResponse) {\n                      if(retryOnResponse) {\n                        retry(attempt, null, response);\n                      } else {\n                        resolve(response);\n                      }\n                    }).catch(reject);\n                } catch (error) {\n                  reject(error);\n                }\n              } else {\n                if (attempt < retries) {\n                  retry(attempt, null, response);\n                } else {\n                  resolve(response);\n                }\n              }\n            })\n            .catch(function (error) {\n              if (typeof retryOn === 'function') {\n                try {\n                  // eslint-disable-next-line no-undef\n                  Promise.resolve(retryOn(attempt, error, null))\n                    .then(function (retryOnResponse) {\n                      if(retryOnResponse) {\n                        retry(attempt, error, null);\n                      } else {\n                        reject(error);\n                      }\n                    })\n                    .catch(function(error) {\n                      reject(error);\n                    });\n                } catch(error) {\n                  reject(error);\n                }\n              } else if (attempt < retries) {\n                retry(attempt, error, null);\n              } else {\n                reject(error);\n              }\n            });\n        };\n\n        function retry(attempt, error, response) {\n          var delay = (typeof retryDelay === 'function') ?\n            retryDelay(attempt, error, response) : retryDelay;\n          setTimeout(function () {\n            wrappedFetch(++attempt);\n          }, delay);\n        }\n\n        wrappedFetch(0);\n      });\n    };\n  };\n\n  function isPositiveInteger(value) {\n    return Number.isInteger(value) && value >= 0;\n  }\n\n  function ArgumentError(message) {\n    this.name = 'ArgumentError';\n    this.message = message;\n  }\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const fetchRetry = fetchRetry$1(fetch);\n  /**\n   * Note : the audio worklet feature is available only in secure context.\n   * This function will fail when used in insecure context (non-https, etc ...)\n   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet\n   */\n  const addModule = async (context, processorCode) => {\n      const blob = new Blob([processorCode], { type: 'text/javascript' });\n      const workletProcessorUrl = URL.createObjectURL(blob);\n      return context.audioWorklet.addModule(workletProcessorUrl);\n  };\n  // TODO : testing\n  const fetchFile = async (url) => {\n      let response;\n      try {\n          response = await fetchRetry(url, { retries: 3 });\n      }\n      catch (err) {\n          throw new FileError(response.status, err.toString());\n      }\n      if (!response.ok) {\n          const responseText = await response.text();\n          throw new FileError(response.status, responseText);\n      }\n      return response.arrayBuffer();\n  };\n  const audioBufferToArray = (audioBuffer) => {\n      const sound = [];\n      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {\n          sound.push(audioBuffer.getChannelData(channel));\n      }\n      return sound;\n  };\n  // TODO : testing\n  const fixSoundChannelCount = (sound, targetChannelCount) => {\n      if (sound.length === 0) {\n          throw new Error(`Received empty sound`);\n      }\n      const floatArrayType = sound[0].constructor;\n      const frameCount = sound[0].length;\n      const fixedSound = sound.slice(0, targetChannelCount);\n      while (sound.length < targetChannelCount) {\n          fixedSound.push(new floatArrayType(frameCount));\n      }\n      return fixedSound;\n  };\n  const resolveRelativeUrl = (rootUrl, relativeUrl) => {\n      return new URL(relativeUrl, rootUrl).href;\n  };\n  class FileError extends Error {\n      constructor(status, msg) {\n          super(`Error ${status} : ${msg}`);\n      }\n  }\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  // TODO : manage transferables\n  class WebPdWorkletNode extends AudioWorkletNode {\n      constructor(context) {\n          super(context, 'webpd-node', {\n              numberOfOutputs: 1,\n              outputChannelCount: [2],\n          });\n      }\n      destroy() {\n          this.port.postMessage({\n              type: 'destroy',\n              payload: {},\n          });\n      }\n  }\n  // Concatenate WorkletProcessor code with the Wasm bindings it needs\n  const WEBPD_WORKLET_PROCESSOR_CODE = AssemblyScriptWasmBindingsCode +\n      ';\\n' +\n      JavaScriptBindingsCode +\n      ';\\n' +\n      _WebPdWorkletProcessorCode;\n  const registerWebPdWorkletNode = (context) => {\n      return addModule(context, WEBPD_WORKLET_PROCESSOR_CODE);\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const FILES = {};\n  const STREAMS = {};\n  class FakeStream {\n      constructor(url, sound) {\n          this.url = url;\n          this.sound = sound;\n          this.frameCount = sound[0].length;\n          this.readPosition = 0;\n      }\n  }\n  const read = async (url) => {\n      if (FILES[url]) {\n          return FILES[url];\n      }\n      const arrayBuffer = await fetchFile(url);\n      return {\n          type: 'binary',\n          data: arrayBuffer,\n      };\n  };\n  // TODO : testing\n  const readSound = async (url, context) => {\n      let fakeFile = FILES[url] || (await read(url));\n      switch (fakeFile.type) {\n          case 'binary':\n              const audioBuffer = await context.decodeAudioData(fakeFile.data);\n              return audioBufferToArray(audioBuffer);\n          case 'sound':\n              // We copy the data here o it can be manipulated freely by the host.\n              // e.g. if the buffer is sent as transferrable to the node we don't want the original to be transferred.\n              return fakeFile.data.map((array) => array.slice());\n      }\n  };\n  const writeSound = async (sound, url) => {\n      FILES[url] = {\n          type: 'sound',\n          data: sound,\n      };\n  };\n  const readStreamSound = async (operationId, url, channelCount, context) => {\n      const sound = await readSound(url, context);\n      STREAMS[operationId] = new FakeStream(url, fixSoundChannelCount(sound, channelCount));\n      return STREAMS[operationId];\n  };\n  const writeStreamSound = async (operationId, url, channelCount) => {\n      const emptySound = [];\n      for (let channel = 0; channel < channelCount; channel++) {\n          emptySound.push(new Float32Array(0));\n      }\n      STREAMS[operationId] = new FakeStream(url, emptySound);\n      FILES[url] = {\n          type: 'sound',\n          data: emptySound,\n      };\n      return STREAMS[operationId];\n  };\n  const getStream = (operationId) => {\n      return STREAMS[operationId];\n  };\n  const killStream = (operationId) => {\n      console.log('KILL STREAM', operationId);\n      delete STREAMS[operationId];\n  };\n  const pullBlock = (stream, frameCount) => {\n      const block = stream.sound.map((array) => array.slice(stream.readPosition, stream.readPosition + frameCount));\n      stream.readPosition += frameCount;\n      return block;\n  };\n  const pushBlock = (stream, block) => {\n      stream.sound = stream.sound.map((channelData, channel) => {\n          const concatenated = new Float32Array(channelData.length + block[channel].length);\n          concatenated.set(channelData);\n          concatenated.set(block[channel], channelData.length);\n          return concatenated;\n      });\n      stream.frameCount = stream.sound[0].length;\n      FILES[stream.url].data = stream.sound;\n  };\n  var fakeFs = {\n      writeSound,\n      readSound,\n      readStreamSound,\n      writeStreamSound,\n      pullBlock,\n      pushBlock,\n  };\n\n  var closeSoundStream = async (_, payload, __) => {\n      if (payload.functionName === 'onCloseSoundStream') {\n          killStream(payload.arguments[0]);\n      }\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  /** Generate an integer series from 0 to `count` (non-inclusive). */\n  const countTo$1 = (count) => {\n      const results = [];\n      for (let i = 0; i < count; i++) {\n          results.push(i);\n      }\n      return results;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const Var$1 = (typeName, name, value) => _preventToString$1({\n      astType: 'Var',\n      name,\n      type: typeName,\n      value: value !== undefined ? _prepareVarValue$1(value) : undefined,\n  });\n  const ConstVar$1 = (typeName, name, value) => _preventToString$1({\n      astType: 'ConstVar',\n      name,\n      type: typeName,\n      value: _prepareVarValue$1(value),\n  });\n  const Func$1 = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({\n      astType: 'Func',\n      name,\n      args,\n      returnType,\n      body: ast$1(strings, ...content),\n  });\n  const AnonFunc$1 = (args = [], returnType = 'void') => (strings, ...content) => _preventToString$1({\n      astType: 'Func',\n      name: null,\n      args,\n      returnType,\n      body: ast$1(strings, ...content),\n  });\n  const Class$1 = (name, members) => _preventToString$1({\n      astType: 'Class',\n      name,\n      members,\n  });\n  const Sequence$1 = (content) => ({\n      astType: 'Sequence',\n      content: _processRawContent$1(_intersperse$1(content, countTo$1(content.length - 1).map(() => '\\n'))),\n  });\n  const ast$1 = (strings, ...content) => _preventToString$1({\n      astType: 'Sequence',\n      content: _processRawContent$1(_intersperse$1(strings, content)),\n  });\n  const _processRawContent$1 = (content) => {\n      // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings\n      // Basically converts input to an Array<AstContent>.\n      const flattenedAndFiltered = content.flatMap((element) => {\n          if (typeof element === 'string') {\n              return [element];\n          }\n          else if (typeof element === 'number') {\n              return [element.toString()];\n          }\n          else {\n              if (element === null) {\n                  return [];\n              }\n              else if (Array.isArray(element)) {\n                  return _processRawContent$1(_intersperse$1(element, countTo$1(element.length - 1).map(() => '\\n')));\n              }\n              else if (typeof element === 'object' &&\n                  element.astType === 'Sequence') {\n                  return element.content;\n              }\n              else {\n                  return [element];\n              }\n          }\n      });\n      // 2. Combine adjacent strings\n      const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {\n          if (typeof element === 'string') {\n              return [combinedContent, currentString + element];\n          }\n          else {\n              if (currentString.length) {\n                  return [[...combinedContent, currentString, element], ''];\n              }\n              else {\n                  return [[...combinedContent, element], ''];\n              }\n          }\n      }, [[], '']);\n      if (remainingString.length) {\n          combinedContent.push(remainingString);\n      }\n      return combinedContent;\n  };\n  /**\n   * Intersperse content from array1 with content from array2.\n   * `array1.length` must be equal to `array2.length + 1`.\n   */\n  const _intersperse$1 = (array1, array2) => {\n      if (array1.length === 0) {\n          return [];\n      }\n      return array1\n          .slice(1)\n          .reduce((combinedContent, element, i) => combinedContent.concat([array2[i], element]), [array1[0]]);\n  };\n  /**\n   * Prevents AST elements from being rendered as a string, as this is\n   * most likely an error due to unproper use of `ast`.\n   * Deacivated. Activate for debugging by uncommenting the line below.\n   */\n  const _preventToString$1 = (element) => ({\n      ...element,\n      // Uncomment this to activate\n      // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }\n  });\n  const _prepareVarValue$1 = (value) => {\n      if (typeof value === 'number') {\n          return Sequence$1([value.toString()]);\n      }\n      else if (typeof value === 'string') {\n          return Sequence$1([value]);\n      }\n      else {\n          return value;\n      }\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const bufCore$1 = () => Sequence$1([\n      /**\n       * Ring buffer\n       */\n      Class$1('buf_SoundBuffer', [\n          Var$1('FloatArray', 'data'),\n          Var$1('Int', 'length'),\n          Var$1('Int', 'writeCursor'),\n          Var$1('Int', 'pullAvailableLength'),\n      ]),\n      /** Erases all the content from the buffer */\n      Func$1('buf_clear', [\n          Var$1('buf_SoundBuffer', 'buffer')\n      ], 'void') `\n        buffer.data.fill(0)\n    `,\n      /** Erases all the content from the buffer */\n      Func$1('buf_create', [\n          Var$1('Int', 'length')\n      ], 'buf_SoundBuffer') `\n        return {\n            data: createFloatArray(length),\n            length: length,\n            writeCursor: 0,\n            pullAvailableLength: 0,\n        }\n    `\n  ]);\n  const bufPushPull$1 = {\n      codeGenerator: () => Sequence$1([\n          /**\n           * Pushes a block to the buffer, throwing an error if the buffer is full.\n           * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}\n           * is moved corresponding with the length of data written.\n           *\n           * @todo : Optimize by allowing to read/write directly from host\n           */\n          Func$1('buf_pushBlock', [\n              Var$1('buf_SoundBuffer', 'buffer'),\n              Var$1('FloatArray', 'block')\n          ], 'Int') `\n            if (buffer.pullAvailableLength + block.length > buffer.length) {\n                throw new Error('buffer full')\n            }\n\n            ${Var$1('Int', 'left', 'block.length')}\n            while (left > 0) {\n                ${ConstVar$1('Int', 'lengthToWrite', `toInt(Math.min(\n                    toFloat(buffer.length - buffer.writeCursor), \n                    toFloat(left),\n                ))`)}\n                buffer.data.set(\n                    block.subarray(\n                        block.length - left, \n                        block.length - left + lengthToWrite\n                    ), \n                    buffer.writeCursor\n                )\n                left -= lengthToWrite\n                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length\n                buffer.pullAvailableLength += lengthToWrite\n            }\n            return buffer.pullAvailableLength\n        `,\n          /**\n           * Pulls a single sample from the buffer.\n           * This is a destructive operation, and the sample will be\n           * unavailable for subsequent readers with the same operation.\n           */\n          Func$1('buf_pullSample', [\n              Var$1('buf_SoundBuffer', 'buffer')\n          ], 'Float') `\n            if (buffer.pullAvailableLength <= 0) {\n                return 0\n            }\n            ${ConstVar$1('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}\n            buffer.pullAvailableLength -= 1\n            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]\n        `\n      ]),\n      dependencies: [bufCore$1],\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const msg$1 = {\n      codeGenerator: ({ target }) => {\n          const declareFuncs = {\n              msg_create: Func$1('msg_create', [Var$1('MessageTemplate', 'template')], 'Message'),\n              msg_writeStringToken: Func$1('msg_writeStringToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n                  Var$1('string', 'value'),\n              ], 'void'),\n              msg_writeFloatToken: Func$1('msg_writeFloatToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n                  Var$1('MessageFloatToken', 'value'),\n              ], 'void'),\n              msg_readStringToken: Func$1('msg_readStringToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n              ], 'string'),\n              msg_readFloatToken: Func$1('msg_readFloatToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n              ], 'MessageFloatToken'),\n              msg_getLength: Func$1('msg_getLength', [\n                  Var$1('Message', 'message')\n              ], 'Int'),\n              msg_getTokenType: Func$1('msg_getTokenType', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n              ], 'Int'),\n              msg_isStringToken: Func$1('msg_isStringToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n              ], 'boolean'),\n              msg_isFloatToken: Func$1('msg_isFloatToken', [\n                  Var$1('Message', 'message'),\n                  Var$1('Int', 'tokenIndex'),\n              ], 'boolean'),\n              msg_isMatching: Func$1('msg_isMatching', [\n                  Var$1('Message', 'message'),\n                  Var$1('Array<MessageHeaderEntry>', 'tokenTypes'),\n              ], 'boolean'),\n              msg_floats: Func$1('msg_floats', [\n                  Var$1('Array<Float>', 'values'),\n              ], 'Message'),\n              msg_strings: Func$1('msg_strings', [\n                  Var$1('Array<string>', 'values'),\n              ], 'Message'),\n              msg_display: Func$1('msg_display', [\n                  Var$1('Message', 'message'),\n              ], 'string')\n          };\n          if (target === 'assemblyscript') {\n              return Sequence$1([\n                  `\n                type MessageFloatToken = Float\n                type MessageCharToken = Int\n\n                type MessageTemplate = Array<Int>\n                type MessageHeaderEntry = Int\n                type MessageHeader = Int32Array\n                `,\n                  ConstVar$1('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),\n                  ConstVar$1('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),\n                  // =========================== EXPORTED API\n                  Func$1('x_msg_create', [\n                      Var$1('Int32Array', 'templateTypedArray')\n                  ], 'Message') `\n                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)\n                    for (let i: Int = 0; i < templateTypedArray.length; i++) {\n                        template[i] = templateTypedArray[i]\n                    }\n                    return msg_create(template)\n                `,\n                  Func$1('x_msg_getTokenTypes', [\n                      Var$1('Message', 'message')\n                  ], 'MessageHeader') `\n                    return message.tokenTypes\n                `,\n                  Func$1('x_msg_createTemplate', [\n                      Var$1('i32', 'length')\n                  ], 'Int32Array') `\n                    return new Int32Array(length)\n                `,\n                  // =========================== MSG API\n                  declareFuncs.msg_create `\n                    let i: Int = 0\n                    let byteCount: Int = 0\n                    let tokenTypes: Array<MessageHeaderEntry> = []\n                    let tokenPositions: Array<MessageHeaderEntry> = []\n\n                    i = 0\n                    while (i < template.length) {\n                        switch(template[i]) {\n                            case MSG_FLOAT_TOKEN:\n                                byteCount += sizeof<MessageFloatToken>()\n                                tokenTypes.push(MSG_FLOAT_TOKEN)\n                                tokenPositions.push(byteCount)\n                                i += 1\n                                break\n                            case MSG_STRING_TOKEN:\n                                byteCount += sizeof<MessageCharToken>() * template[i + 1]\n                                tokenTypes.push(MSG_STRING_TOKEN)\n                                tokenPositions.push(byteCount)\n                                i += 2\n                                break\n                            default:\n                                throw new Error(\"unknown token type : \" + template[i].toString())\n                        }\n                    }\n\n                    const tokenCount = tokenTypes.length\n                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()\n                    byteCount += headerByteCount\n\n                    const buffer = new ArrayBuffer(byteCount)\n                    const dataView = new DataView(buffer)\n                    let writePosition: Int = 0\n                    \n                    dataView.setInt32(writePosition, tokenCount)\n                    writePosition += sizeof<MessageHeaderEntry>()\n\n                    for (i = 0; i < tokenCount; i++) {\n                        dataView.setInt32(writePosition, tokenTypes[i])\n                        writePosition += sizeof<MessageHeaderEntry>()\n                    }\n\n                    dataView.setInt32(writePosition, headerByteCount)\n                    writePosition += sizeof<MessageHeaderEntry>()\n                    for (i = 0; i < tokenCount; i++) {\n                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])\n                        writePosition += sizeof<MessageHeaderEntry>()\n                    }\n\n                    const header = _msg_unpackHeader(dataView, tokenCount)\n                    return {\n                        dataView,\n                        tokenCount,\n                        header,\n                        tokenTypes: _msg_unpackTokenTypes(header),\n                        tokenPositions: _msg_unpackTokenPositions(header),\n                    }\n                `,\n                  declareFuncs.msg_writeStringToken `\n                    const startPosition = message.tokenPositions[tokenIndex]\n                    const endPosition = message.tokenPositions[tokenIndex + 1]\n                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n                    if (value.length !== expectedStringLength) {\n                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())\n                    }\n\n                    for (let i = 0; i < value.length; i++) {\n                        message.dataView.setInt32(\n                            startPosition + i * sizeof<MessageCharToken>(), \n                            value.codePointAt(i)\n                        )\n                    }\n                `,\n                  declareFuncs.msg_writeFloatToken `\n                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)\n                `,\n                  declareFuncs.msg_readStringToken `\n                    const startPosition = message.tokenPositions[tokenIndex]\n                    const endPosition = message.tokenPositions[tokenIndex + 1]\n                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n                    let value: string = ''\n                    for (let i = 0; i < stringLength; i++) {\n                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))\n                    }\n                    return value\n                `,\n                  declareFuncs.msg_readFloatToken `\n                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])\n                `,\n                  declareFuncs.msg_getLength `\n                    return message.tokenTypes.length\n                `,\n                  declareFuncs.msg_getTokenType `\n                    return message.tokenTypes[tokenIndex]\n                `,\n                  declareFuncs.msg_isStringToken `\n                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN\n                `,\n                  declareFuncs.msg_isFloatToken `\n                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN\n                `,\n                  declareFuncs.msg_isMatching `\n                    if (message.tokenTypes.length !== tokenTypes.length) {\n                        return false\n                    }\n                    for (let i: Int = 0; i < tokenTypes.length; i++) {\n                        if (message.tokenTypes[i] !== tokenTypes[i]) {\n                            return false\n                        }\n                    }\n                    return true\n                `,\n                  declareFuncs.msg_floats `\n                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))\n                    for (let i: Int = 0; i < values.length; i++) {\n                        msg_writeFloatToken(message, i, values[i])\n                    }\n                    return message\n                `,\n                  declareFuncs.msg_strings `\n                    const template: MessageTemplate = []\n                    for (let i: Int = 0; i < values.length; i++) {\n                        template.push(MSG_STRING_TOKEN)\n                        template.push(values[i].length)\n                    }\n                    const message: Message = msg_create(template)\n                    for (let i: Int = 0; i < values.length; i++) {\n                        msg_writeStringToken(message, i, values[i])\n                    }\n                    return message\n                `,\n                  declareFuncs.msg_display `\n                    let displayArray: Array<string> = []\n                    for (let i: Int = 0; i < msg_getLength(message); i++) {\n                        if (msg_isFloatToken(message, i)) {\n                            displayArray.push(msg_readFloatToken(message, i).toString())\n                        } else {\n                            displayArray.push('\"' + msg_readStringToken(message, i) + '\"')\n                        }\n                    }\n                    return '[' + displayArray.join(', ') + ']'\n                `,\n                  // =========================== PRIVATE\n                  // Message header : [\n                  //      <Token count>, \n                  //      <Token 1 type>,  ..., <Token N type>, \n                  //      <Token 1 start>, ..., <Token N start>, <Token N end>\n                  //      ... DATA ...\n                  // ]\n                  Class$1('Message', [\n                      Var$1('DataView', 'dataView'),\n                      Var$1('MessageHeader', 'header'),\n                      Var$1('MessageHeaderEntry', 'tokenCount'),\n                      Var$1('MessageHeader', 'tokenTypes'),\n                      Var$1('MessageHeader', 'tokenPositions'),\n                  ]),\n                  Func$1('_msg_computeHeaderLength', [\n                      Var$1('Int', 'tokenCount')\n                  ], 'Int') `\n                    return 1 + tokenCount * 2 + 1\n                `,\n                  Func$1('_msg_unpackTokenCount', [\n                      Var$1('DataView', 'messageDataView')\n                  ], 'MessageHeaderEntry') `\n                    return messageDataView.getInt32(0)\n                `,\n                  Func$1('_msg_unpackHeader', [\n                      Var$1('DataView', 'messageDataView'),\n                      Var$1('MessageHeaderEntry', 'tokenCount'),\n                  ], 'MessageHeader') `\n                    const headerLength = _msg_computeHeaderLength(tokenCount)\n                    // TODO : why is this \\`wrap\\` not working ?\n                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)\n                    const messageHeader = new Int32Array(headerLength)\n                    for (let i = 0; i < headerLength; i++) {\n                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)\n                    }\n                    return messageHeader\n                `,\n                  Func$1('_msg_unpackTokenTypes', [\n                      Var$1('MessageHeader', 'header'),\n                  ], 'MessageHeader') `\n                    return header.slice(1, 1 + header[0])\n                `,\n                  Func$1('_msg_unpackTokenPositions', [\n                      Var$1('MessageHeader', 'header'),\n                  ], 'MessageHeader') `\n                    return header.slice(1 + header[0])\n                `,\n              ]);\n          }\n          else if (target === 'javascript') {\n              return Sequence$1([\n                  ConstVar$1('string', 'MSG_FLOAT_TOKEN', '\"number\"'),\n                  ConstVar$1('string', 'MSG_STRING_TOKEN', '\"string\"'),\n                  declareFuncs.msg_create `\n                    const m = []\n                    let i = 0\n                    while (i < template.length) {\n                        if (template[i] === MSG_STRING_TOKEN) {\n                            m.push('')\n                            i += 2\n                        } else if (template[i] === MSG_FLOAT_TOKEN) {\n                            m.push(0)\n                            i += 1\n                        }\n                    }\n                    return m\n                `,\n                  declareFuncs.msg_getLength `\n                    return message.length\n                `,\n                  declareFuncs.msg_getTokenType `\n                    return typeof message[tokenIndex]\n                `,\n                  declareFuncs.msg_isStringToken `\n                    return msg_getTokenType(message, tokenIndex) === 'string'\n                `,\n                  declareFuncs.msg_isFloatToken `\n                    return msg_getTokenType(message, tokenIndex) === 'number'\n                `,\n                  declareFuncs.msg_isMatching `\n                    return (message.length === tokenTypes.length) \n                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])\n                `,\n                  declareFuncs.msg_writeFloatToken `\n                    message[tokenIndex] = value\n                `,\n                  declareFuncs.msg_writeStringToken `\n                    message[tokenIndex] = value\n                `,\n                  declareFuncs.msg_readFloatToken `\n                    return message[tokenIndex]\n                `,\n                  declareFuncs.msg_readStringToken `\n                    return message[tokenIndex]\n                `,\n                  declareFuncs.msg_floats `\n                    return values\n                `,\n                  declareFuncs.msg_strings `\n                    return values\n                `,\n                  declareFuncs.msg_display `\n                    return '[' + message\n                        .map(t => typeof t === 'string' ? '\"' + t + '\"' : t.toString())\n                        .join(', ') + ']'\n                `,\n              ]);\n          }\n          else {\n              throw new Error(`Unexpected target: ${target}`);\n          }\n      },\n      exports: [\n          { name: 'x_msg_create', targets: ['assemblyscript'] },\n          { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },\n          { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },\n          { name: 'msg_writeStringToken', targets: ['assemblyscript'] },\n          { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },\n          { name: 'msg_readStringToken', targets: ['assemblyscript'] },\n          { name: 'msg_readFloatToken', targets: ['assemblyscript'] },\n          { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },\n          { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },\n      ],\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const FS_OPERATION_SUCCESS$1 = 0;\n  const FS_OPERATION_FAILURE$1 = 1;\n  const fsCore$1 = {\n      codeGenerator: ({ target }) => {\n          const content = [];\n          if (target === 'assemblyscript') {\n              content.push(`\n                type fs_OperationId = Int\n                type fs_OperationStatus = Int\n                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void\n                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void\n                type fs_Url = string\n            `);\n          }\n          return Sequence$1([\n              ...content,\n              ConstVar$1('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS$1.toString()),\n              ConstVar$1('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE$1.toString()),\n              ConstVar$1('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),\n              ConstVar$1('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),\n              ConstVar$1('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),\n              // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to \n              // a function. Therefore we can get false negatives when a test happens to expect a 0.\n              Var$1('Int', '_FS_OPERATION_COUNTER', '1'),\n              Class$1('fs_SoundInfo', [\n                  Var$1('Int', 'channelCount'),\n                  Var$1('Int', 'sampleRate'),\n                  Var$1('Int', 'bitDepth'),\n                  Var$1('string', 'encodingFormat'),\n                  Var$1('string', 'endianness'),\n                  Var$1('string', 'extraOptions'),\n              ]),\n              Func$1('fs_soundInfoToMessage', [\n                  Var$1('fs_SoundInfo', 'soundInfo')\n              ], 'Message') `\n                ${ConstVar$1('Message', 'info', `msg_create([\n                    MSG_FLOAT_TOKEN,\n                    MSG_FLOAT_TOKEN,\n                    MSG_FLOAT_TOKEN,\n                    MSG_STRING_TOKEN,\n                    soundInfo.encodingFormat.length,\n                    MSG_STRING_TOKEN,\n                    soundInfo.endianness.length,\n                    MSG_STRING_TOKEN,\n                    soundInfo.extraOptions.length\n                ])`)}\n                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))\n                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))\n                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))\n                msg_writeStringToken(info, 3, soundInfo.encodingFormat)\n                msg_writeStringToken(info, 4, soundInfo.endianness)\n                msg_writeStringToken(info, 5, soundInfo.extraOptions)\n                return info\n            `,\n              Func$1('_fs_assertOperationExists', [\n                  Var$1('fs_OperationId', 'id'),\n                  Var$1('string', 'operationName'),\n              ], 'void') `\n                if (!_FS_OPERATIONS_IDS.has(id)) {\n                    throw new Error(operationName + ' operation unknown : ' + id.toString())\n                }\n            `,\n              Func$1('_fs_createOperationId', [], 'fs_OperationId') `\n                ${ConstVar$1('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}\n                _FS_OPERATIONS_IDS.add(id)\n                return id\n            `\n          ]);\n      },\n      dependencies: [msg$1],\n  };\n  ({\n      codeGenerator: () => Sequence$1([\n          Func$1('fs_readSoundFile', [\n              Var$1('fs_Url', 'url'),\n              Var$1('fs_SoundInfo', 'soundInfo'),\n              Var$1('fs_OperationSoundCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}\n            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)\n            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func$1('x_fs_onReadSoundFileResponse', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_OperationStatus', 'status'),\n              Var$1('FloatArray[]', 'sound'),\n          ], 'void') `\n            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')\n            _FS_OPERATIONS_IDS.delete(id)\n            // Finish cleaning before calling the callback in case it would throw an error.\n            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)\n            callback(id, status, sound)\n            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onReadSoundFileResponse',\n          },\n      ],\n      imports: [\n          Func$1('i_fs_readSoundFile', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_Url', 'url'),\n              Var$1('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsCore$1],\n  });\n  ({\n      codeGenerator: () => Sequence$1([\n          Func$1('fs_writeSoundFile', [\n              Var$1('FloatArray[]', 'sound'),\n              Var$1('fs_Url', 'url'),\n              Var$1('fs_SoundInfo', 'soundInfo'),\n              Var$1('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func$1('x_fs_onWriteSoundFileResponse', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_OperationStatus', 'status'),\n          ], 'void') `\n            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')\n            _FS_OPERATIONS_IDS.delete(id)\n            // Finish cleaning before calling the callback in case it would throw an error.\n            ${ConstVar$1('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}\n            callback(id, status)\n            _FS_OPERATIONS_CALLBACKS.delete(id)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onWriteSoundFileResponse',\n          },\n      ],\n      imports: [\n          Func$1('i_fs_writeSoundFile', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('FloatArray[]', 'sound'),\n              Var$1('fs_Url', 'url'),\n              Var$1('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsCore$1],\n  });\n  const fsSoundStreamCore$1 = {\n      codeGenerator: () => Sequence$1([\n          ConstVar$1('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),\n          ConstVar$1('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),\n          Func$1('fs_closeSoundStream', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_OperationStatus', 'status'),\n          ], 'void') `\n            if (!_FS_OPERATIONS_IDS.has(id)) {\n                return\n            }\n            _FS_OPERATIONS_IDS.delete(id)\n            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)\n            _FS_OPERATIONS_CALLBACKS.delete(id)\n            // Delete this last, to give the callback \n            // a chance to save a reference to the buffer\n            // If write stream, there won't be a buffer\n            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {\n                _FS_SOUND_STREAM_BUFFERS.delete(id)\n            }\n            i_fs_closeSoundStream(id, status)\n        `,\n          Func$1('x_fs_onCloseSoundStream', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_OperationStatus', 'status'),\n          ], 'void') `\n            fs_closeSoundStream(id, status)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onCloseSoundStream',\n          },\n      ],\n      imports: [\n          Func$1('i_fs_closeSoundStream', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_OperationStatus', 'status'),\n          ], 'void') ``,\n      ],\n      dependencies: [bufCore$1, fsCore$1],\n  };\n  ({\n      codeGenerator: () => Sequence$1([\n          Func$1('fs_openSoundReadStream', [\n              Var$1('fs_Url', 'url'),\n              Var$1('fs_SoundInfo', 'soundInfo'),\n              Var$1('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar$1('fs_OperationId', 'id', '_fs_createOperationId()')}\n            ${ConstVar$1('Array<buf_SoundBuffer>', 'buffers', '[]')}\n            for (${Var$1('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {\n                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))\n            }\n            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func$1('x_fs_onSoundStreamData', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('FloatArray[]', 'block'),\n          ], 'Int') `\n            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')\n            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)\n            for (${Var$1('Int', 'i', '0')}; i < buffers.length; i++) {\n                buf_pushBlock(buffers[i], block[i])\n            }\n            return buffers[0].pullAvailableLength\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onSoundStreamData',\n          },\n      ],\n      imports: [\n          Func$1('i_fs_openSoundReadStream', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_Url', 'url'),\n              Var$1('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsSoundStreamCore$1, bufPushPull$1],\n  });\n  ({\n      codeGenerator: () => Sequence$1([\n          Func$1('fs_openSoundWriteStream', [\n              Var$1('fs_Url', 'url'),\n              Var$1('fs_SoundInfo', 'soundInfo'),\n              Var$1('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            const id = _fs_createOperationId()\n            _FS_SOUND_STREAM_BUFFERS.set(id, [])\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func$1('fs_sendSoundStreamData', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('FloatArray[]', 'block')\n          ], 'void') `\n            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')\n            i_fs_sendSoundStreamData(id, block)\n        `\n      ]),\n      imports: [\n          Func$1('i_fs_openSoundWriteStream', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('fs_Url', 'url'),\n              Var$1('Message', 'info'),\n          ], 'void') ``,\n          Func$1('i_fs_sendSoundStreamData', [\n              Var$1('fs_OperationId', 'id'),\n              Var$1('FloatArray[]', 'block'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsSoundStreamCore$1],\n  });\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  AnonFunc$1([Var$1('Message', 'm')], 'void') ``;\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var readSoundFile = async (node, payload, settings) => {\n      if (payload.functionName === 'onReadSoundFile') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          let operationStatus = FS_OPERATION_SUCCESS$1;\n          let sound = null;\n          try {\n              sound = await fakeFs.readSound(absoluteUrl, node.context);\n          }\n          catch (err) {\n              operationStatus = FS_OPERATION_FAILURE$1;\n              console.error(err);\n          }\n          if (sound) {\n              sound = fixSoundChannelCount(sound, channelCount);\n          }\n          node.port.postMessage({\n              type: 'fs',\n              payload: {\n                  functionName: 'sendReadSoundFileResponse',\n                  arguments: [operationId, operationStatus, sound],\n              },\n          }, \n          // Add as transferables to avoid copies between threads\n          sound.map((array) => array.buffer));\n      }\n      else if (payload.functionName === 'sendReadSoundFileResponse_return') ;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const BUFFER_HIGH = 10 * 44100;\n  const BUFFER_LOW = BUFFER_HIGH / 2;\n  var readSoundStream = async (node, payload, settings) => {\n      if (payload.functionName === 'onOpenSoundReadStream') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          try {\n              const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n              await fakeFs.readStreamSound(operationId, absoluteUrl, channelCount, node.context);\n          }\n          catch (err) {\n              console.error(err);\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'closeSoundStream',\n                      arguments: [operationId, FS_OPERATION_FAILURE$1],\n                  },\n              });\n              return;\n          }\n          streamLoop(node, operationId, 0);\n      }\n      else if (payload.functionName === 'sendSoundStreamData_return') {\n          const stream = getStream(payload.operationId);\n          if (!stream) {\n              throw new Error(`unknown stream ${payload.operationId}`);\n          }\n          streamLoop(node, payload.operationId, payload.returned);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          const stream = getStream(payload.operationId);\n          if (stream) {\n              killStream(payload.operationId);\n          }\n      }\n  };\n  const streamLoop = (node, operationId, framesAvailableInEngine) => {\n      const sampleRate = node.context.sampleRate;\n      const secondsToThreshold = Math.max(framesAvailableInEngine - BUFFER_LOW, 10) / sampleRate;\n      const framesToSend = BUFFER_HIGH -\n          (framesAvailableInEngine - secondsToThreshold * sampleRate);\n      setTimeout(() => {\n          const stream = getStream(operationId);\n          if (!stream) {\n              console.log(`stream ${operationId} was maybe closed`);\n              return;\n          }\n          if (stream.readPosition < stream.frameCount) {\n              const block = pullBlock(stream, framesToSend);\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'sendSoundStreamData',\n                      arguments: [operationId, block],\n                  },\n              }, \n              // Add as transferables to avoid copies between threads\n              block.map((array) => array.buffer));\n          }\n          else {\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'closeSoundStream',\n                      arguments: [operationId, FS_OPERATION_SUCCESS$1],\n                  },\n              });\n          }\n      }, secondsToThreshold * 1000);\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var writeSoundFile = async (node, payload, settings) => {\n      if (payload.functionName === 'onWriteSoundFile') {\n          const [operationId, sound, url, [channelCount]] = payload.arguments;\n          const fixedSound = fixSoundChannelCount(sound, channelCount);\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          await fakeFs.writeSound(fixedSound, absoluteUrl);\n          let operationStatus = FS_OPERATION_SUCCESS$1;\n          node.port.postMessage({\n              type: 'fs',\n              payload: {\n                  functionName: 'sendWriteSoundFileResponse',\n                  arguments: [operationId, operationStatus],\n              },\n          });\n      }\n      else if (payload.functionName === 'sendWriteSoundFileResponse_return') ;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var writeSoundStream = async (_, payload, settings) => {\n      if (payload.functionName === 'onOpenSoundWriteStream') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          await fakeFs.writeStreamSound(operationId, absoluteUrl, channelCount);\n      }\n      else if (payload.functionName === 'onSoundStreamData') {\n          const [operationId, sound] = payload.arguments;\n          const stream = getStream(operationId);\n          if (!stream) {\n              throw new Error(`unknown stream ${operationId}`);\n          }\n          pushBlock(stream, sound);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          const stream = getStream(payload.operationId);\n          if (stream) {\n              killStream(payload.operationId);\n          }\n      }\n  };\n\n  var index = async (node, messageEvent, settings) => {\n      const message = messageEvent.data;\n      const { payload } = message;\n      if (message.type !== 'fs') {\n          throw new Error(`Unknown message type from node ${message.type}`);\n      }\n      if (payload.functionName === 'onReadSoundFile' ||\n          payload.functionName === 'sendReadSoundFileResponse_return') {\n          readSoundFile(node, payload, settings);\n      }\n      else if (payload.functionName === 'onOpenSoundReadStream' ||\n          payload.functionName === 'sendSoundStreamData_return') {\n          readSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'onWriteSoundFile' ||\n          payload.functionName === 'sendWriteSoundFileResponse_return') {\n          writeSoundFile(node, payload, settings);\n      }\n      else if (payload.functionName === 'onOpenSoundWriteStream' ||\n          payload.functionName === 'onSoundStreamData') {\n          writeSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          writeSoundStream(node, payload, settings);\n          readSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'onCloseSoundStream') {\n          closeSoundStream(node, payload);\n      }\n      else {\n          throw new Error(`Unknown callback ${payload.functionName}`);\n      }\n  };\n\n  var initialize = (...args) => {\n      return registerWebPdWorkletNode(...args);\n  };\n\n  const urlDirName = (url) => {\n      if (isExternalUrl(url)) {\n          return new URL('.', url).href;\n      }\n      else {\n          return new URL('.', new URL(url, document.URL).href).href;\n      }\n  };\n  const isExternalUrl = (urlString) => {\n      try {\n          const url = new URL(urlString);\n          if (url.origin !== new URL(document.URL, document.baseURI).origin) {\n              return true;\n          }\n      }\n      catch (_e) {\n          new URL(urlString, document.baseURI);\n      }\n      return false;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  /** Generate an integer series from 0 to `count` (non-inclusive). */\n  const countTo = (count) => {\n      const results = [];\n      for (let i = 0; i < count; i++) {\n          results.push(i);\n      }\n      return results;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const Var = (typeName, name, value) => _preventToString({\n      astType: 'Var',\n      name,\n      type: typeName,\n      value: value !== undefined ? _prepareVarValue(value) : undefined,\n  });\n  const ConstVar = (typeName, name, value) => _preventToString({\n      astType: 'ConstVar',\n      name,\n      type: typeName,\n      value: _prepareVarValue(value),\n  });\n  const Func = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString({\n      astType: 'Func',\n      name,\n      args,\n      returnType,\n      body: ast(strings, ...content),\n  });\n  const AnonFunc = (args = [], returnType = 'void') => (strings, ...content) => _preventToString({\n      astType: 'Func',\n      name: null,\n      args,\n      returnType,\n      body: ast(strings, ...content),\n  });\n  const Class = (name, members) => _preventToString({\n      astType: 'Class',\n      name,\n      members,\n  });\n  const Sequence = (content) => ({\n      astType: 'Sequence',\n      content: _processRawContent(_intersperse(content, countTo(content.length - 1).map(() => '\\n'))),\n  });\n  const ast = (strings, ...content) => _preventToString({\n      astType: 'Sequence',\n      content: _processRawContent(_intersperse(strings, content)),\n  });\n  const _processRawContent = (content) => {\n      // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings\n      // Basically converts input to an Array<AstContent>.\n      const flattenedAndFiltered = content.flatMap((element) => {\n          if (typeof element === 'string') {\n              return [element];\n          }\n          else if (typeof element === 'number') {\n              return [element.toString()];\n          }\n          else {\n              if (element === null) {\n                  return [];\n              }\n              else if (Array.isArray(element)) {\n                  return _processRawContent(_intersperse(element, countTo(element.length - 1).map(() => '\\n')));\n              }\n              else if (typeof element === 'object' &&\n                  element.astType === 'Sequence') {\n                  return element.content;\n              }\n              else {\n                  return [element];\n              }\n          }\n      });\n      // 2. Combine adjacent strings\n      const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {\n          if (typeof element === 'string') {\n              return [combinedContent, currentString + element];\n          }\n          else {\n              if (currentString.length) {\n                  return [[...combinedContent, currentString, element], ''];\n              }\n              else {\n                  return [[...combinedContent, element], ''];\n              }\n          }\n      }, [[], '']);\n      if (remainingString.length) {\n          combinedContent.push(remainingString);\n      }\n      return combinedContent;\n  };\n  /**\n   * Intersperse content from array1 with content from array2.\n   * `array1.length` must be equal to `array2.length + 1`.\n   */\n  const _intersperse = (array1, array2) => {\n      if (array1.length === 0) {\n          return [];\n      }\n      return array1\n          .slice(1)\n          .reduce((combinedContent, element, i) => combinedContent.concat([array2[i], element]), [array1[0]]);\n  };\n  /**\n   * Prevents AST elements from being rendered as a string, as this is\n   * most likely an error due to unproper use of `ast`.\n   * Deacivated. Activate for debugging by uncommenting the line below.\n   */\n  const _preventToString = (element) => ({\n      ...element,\n      // Uncomment this to activate\n      // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }\n  });\n  const _prepareVarValue = (value) => {\n      if (typeof value === 'number') {\n          return Sequence([value.toString()]);\n      }\n      else if (typeof value === 'string') {\n          return Sequence([value]);\n      }\n      else {\n          return value;\n      }\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const bufCore = () => Sequence([\n      /**\n       * Ring buffer\n       */\n      Class('buf_SoundBuffer', [\n          Var('FloatArray', 'data'),\n          Var('Int', 'length'),\n          Var('Int', 'writeCursor'),\n          Var('Int', 'pullAvailableLength'),\n      ]),\n      /** Erases all the content from the buffer */\n      Func('buf_clear', [\n          Var('buf_SoundBuffer', 'buffer')\n      ], 'void') `\n        buffer.data.fill(0)\n    `,\n      /** Erases all the content from the buffer */\n      Func('buf_create', [\n          Var('Int', 'length')\n      ], 'buf_SoundBuffer') `\n        return {\n            data: createFloatArray(length),\n            length: length,\n            writeCursor: 0,\n            pullAvailableLength: 0,\n        }\n    `\n  ]);\n  const bufPushPull = {\n      codeGenerator: () => Sequence([\n          /**\n           * Pushes a block to the buffer, throwing an error if the buffer is full.\n           * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}\n           * is moved corresponding with the length of data written.\n           *\n           * @todo : Optimize by allowing to read/write directly from host\n           */\n          Func('buf_pushBlock', [\n              Var('buf_SoundBuffer', 'buffer'),\n              Var('FloatArray', 'block')\n          ], 'Int') `\n            if (buffer.pullAvailableLength + block.length > buffer.length) {\n                throw new Error('buffer full')\n            }\n\n            ${Var('Int', 'left', 'block.length')}\n            while (left > 0) {\n                ${ConstVar('Int', 'lengthToWrite', `toInt(Math.min(\n                    toFloat(buffer.length - buffer.writeCursor), \n                    toFloat(left),\n                ))`)}\n                buffer.data.set(\n                    block.subarray(\n                        block.length - left, \n                        block.length - left + lengthToWrite\n                    ), \n                    buffer.writeCursor\n                )\n                left -= lengthToWrite\n                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length\n                buffer.pullAvailableLength += lengthToWrite\n            }\n            return buffer.pullAvailableLength\n        `,\n          /**\n           * Pulls a single sample from the buffer.\n           * This is a destructive operation, and the sample will be\n           * unavailable for subsequent readers with the same operation.\n           */\n          Func('buf_pullSample', [\n              Var('buf_SoundBuffer', 'buffer')\n          ], 'Float') `\n            if (buffer.pullAvailableLength <= 0) {\n                return 0\n            }\n            ${ConstVar('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}\n            buffer.pullAvailableLength -= 1\n            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]\n        `\n      ]),\n      dependencies: [bufCore],\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const msg = {\n      codeGenerator: ({ target }) => {\n          const declareFuncs = {\n              msg_create: Func('msg_create', [Var('MessageTemplate', 'template')], 'Message'),\n              msg_writeStringToken: Func('msg_writeStringToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n                  Var('string', 'value'),\n              ], 'void'),\n              msg_writeFloatToken: Func('msg_writeFloatToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n                  Var('MessageFloatToken', 'value'),\n              ], 'void'),\n              msg_readStringToken: Func('msg_readStringToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n              ], 'string'),\n              msg_readFloatToken: Func('msg_readFloatToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n              ], 'MessageFloatToken'),\n              msg_getLength: Func('msg_getLength', [\n                  Var('Message', 'message')\n              ], 'Int'),\n              msg_getTokenType: Func('msg_getTokenType', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n              ], 'Int'),\n              msg_isStringToken: Func('msg_isStringToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n              ], 'boolean'),\n              msg_isFloatToken: Func('msg_isFloatToken', [\n                  Var('Message', 'message'),\n                  Var('Int', 'tokenIndex'),\n              ], 'boolean'),\n              msg_isMatching: Func('msg_isMatching', [\n                  Var('Message', 'message'),\n                  Var('Array<MessageHeaderEntry>', 'tokenTypes'),\n              ], 'boolean'),\n              msg_floats: Func('msg_floats', [\n                  Var('Array<Float>', 'values'),\n              ], 'Message'),\n              msg_strings: Func('msg_strings', [\n                  Var('Array<string>', 'values'),\n              ], 'Message'),\n              msg_display: Func('msg_display', [\n                  Var('Message', 'message'),\n              ], 'string')\n          };\n          if (target === 'assemblyscript') {\n              return Sequence([\n                  `\n                type MessageFloatToken = Float\n                type MessageCharToken = Int\n\n                type MessageTemplate = Array<Int>\n                type MessageHeaderEntry = Int\n                type MessageHeader = Int32Array\n                `,\n                  ConstVar('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),\n                  ConstVar('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),\n                  // =========================== EXPORTED API\n                  Func('x_msg_create', [\n                      Var('Int32Array', 'templateTypedArray')\n                  ], 'Message') `\n                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)\n                    for (let i: Int = 0; i < templateTypedArray.length; i++) {\n                        template[i] = templateTypedArray[i]\n                    }\n                    return msg_create(template)\n                `,\n                  Func('x_msg_getTokenTypes', [\n                      Var('Message', 'message')\n                  ], 'MessageHeader') `\n                    return message.tokenTypes\n                `,\n                  Func('x_msg_createTemplate', [\n                      Var('i32', 'length')\n                  ], 'Int32Array') `\n                    return new Int32Array(length)\n                `,\n                  // =========================== MSG API\n                  declareFuncs.msg_create `\n                    let i: Int = 0\n                    let byteCount: Int = 0\n                    let tokenTypes: Array<MessageHeaderEntry> = []\n                    let tokenPositions: Array<MessageHeaderEntry> = []\n\n                    i = 0\n                    while (i < template.length) {\n                        switch(template[i]) {\n                            case MSG_FLOAT_TOKEN:\n                                byteCount += sizeof<MessageFloatToken>()\n                                tokenTypes.push(MSG_FLOAT_TOKEN)\n                                tokenPositions.push(byteCount)\n                                i += 1\n                                break\n                            case MSG_STRING_TOKEN:\n                                byteCount += sizeof<MessageCharToken>() * template[i + 1]\n                                tokenTypes.push(MSG_STRING_TOKEN)\n                                tokenPositions.push(byteCount)\n                                i += 2\n                                break\n                            default:\n                                throw new Error(\"unknown token type : \" + template[i].toString())\n                        }\n                    }\n\n                    const tokenCount = tokenTypes.length\n                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()\n                    byteCount += headerByteCount\n\n                    const buffer = new ArrayBuffer(byteCount)\n                    const dataView = new DataView(buffer)\n                    let writePosition: Int = 0\n                    \n                    dataView.setInt32(writePosition, tokenCount)\n                    writePosition += sizeof<MessageHeaderEntry>()\n\n                    for (i = 0; i < tokenCount; i++) {\n                        dataView.setInt32(writePosition, tokenTypes[i])\n                        writePosition += sizeof<MessageHeaderEntry>()\n                    }\n\n                    dataView.setInt32(writePosition, headerByteCount)\n                    writePosition += sizeof<MessageHeaderEntry>()\n                    for (i = 0; i < tokenCount; i++) {\n                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])\n                        writePosition += sizeof<MessageHeaderEntry>()\n                    }\n\n                    const header = _msg_unpackHeader(dataView, tokenCount)\n                    return {\n                        dataView,\n                        tokenCount,\n                        header,\n                        tokenTypes: _msg_unpackTokenTypes(header),\n                        tokenPositions: _msg_unpackTokenPositions(header),\n                    }\n                `,\n                  declareFuncs.msg_writeStringToken `\n                    const startPosition = message.tokenPositions[tokenIndex]\n                    const endPosition = message.tokenPositions[tokenIndex + 1]\n                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n                    if (value.length !== expectedStringLength) {\n                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())\n                    }\n\n                    for (let i = 0; i < value.length; i++) {\n                        message.dataView.setInt32(\n                            startPosition + i * sizeof<MessageCharToken>(), \n                            value.codePointAt(i)\n                        )\n                    }\n                `,\n                  declareFuncs.msg_writeFloatToken `\n                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)\n                `,\n                  declareFuncs.msg_readStringToken `\n                    const startPosition = message.tokenPositions[tokenIndex]\n                    const endPosition = message.tokenPositions[tokenIndex + 1]\n                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()\n                    let value: string = ''\n                    for (let i = 0; i < stringLength; i++) {\n                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))\n                    }\n                    return value\n                `,\n                  declareFuncs.msg_readFloatToken `\n                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])\n                `,\n                  declareFuncs.msg_getLength `\n                    return message.tokenTypes.length\n                `,\n                  declareFuncs.msg_getTokenType `\n                    return message.tokenTypes[tokenIndex]\n                `,\n                  declareFuncs.msg_isStringToken `\n                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN\n                `,\n                  declareFuncs.msg_isFloatToken `\n                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN\n                `,\n                  declareFuncs.msg_isMatching `\n                    if (message.tokenTypes.length !== tokenTypes.length) {\n                        return false\n                    }\n                    for (let i: Int = 0; i < tokenTypes.length; i++) {\n                        if (message.tokenTypes[i] !== tokenTypes[i]) {\n                            return false\n                        }\n                    }\n                    return true\n                `,\n                  declareFuncs.msg_floats `\n                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))\n                    for (let i: Int = 0; i < values.length; i++) {\n                        msg_writeFloatToken(message, i, values[i])\n                    }\n                    return message\n                `,\n                  declareFuncs.msg_strings `\n                    const template: MessageTemplate = []\n                    for (let i: Int = 0; i < values.length; i++) {\n                        template.push(MSG_STRING_TOKEN)\n                        template.push(values[i].length)\n                    }\n                    const message: Message = msg_create(template)\n                    for (let i: Int = 0; i < values.length; i++) {\n                        msg_writeStringToken(message, i, values[i])\n                    }\n                    return message\n                `,\n                  declareFuncs.msg_display `\n                    let displayArray: Array<string> = []\n                    for (let i: Int = 0; i < msg_getLength(message); i++) {\n                        if (msg_isFloatToken(message, i)) {\n                            displayArray.push(msg_readFloatToken(message, i).toString())\n                        } else {\n                            displayArray.push('\"' + msg_readStringToken(message, i) + '\"')\n                        }\n                    }\n                    return '[' + displayArray.join(', ') + ']'\n                `,\n                  // =========================== PRIVATE\n                  // Message header : [\n                  //      <Token count>, \n                  //      <Token 1 type>,  ..., <Token N type>, \n                  //      <Token 1 start>, ..., <Token N start>, <Token N end>\n                  //      ... DATA ...\n                  // ]\n                  Class('Message', [\n                      Var('DataView', 'dataView'),\n                      Var('MessageHeader', 'header'),\n                      Var('MessageHeaderEntry', 'tokenCount'),\n                      Var('MessageHeader', 'tokenTypes'),\n                      Var('MessageHeader', 'tokenPositions'),\n                  ]),\n                  Func('_msg_computeHeaderLength', [\n                      Var('Int', 'tokenCount')\n                  ], 'Int') `\n                    return 1 + tokenCount * 2 + 1\n                `,\n                  Func('_msg_unpackTokenCount', [\n                      Var('DataView', 'messageDataView')\n                  ], 'MessageHeaderEntry') `\n                    return messageDataView.getInt32(0)\n                `,\n                  Func('_msg_unpackHeader', [\n                      Var('DataView', 'messageDataView'),\n                      Var('MessageHeaderEntry', 'tokenCount'),\n                  ], 'MessageHeader') `\n                    const headerLength = _msg_computeHeaderLength(tokenCount)\n                    // TODO : why is this \\`wrap\\` not working ?\n                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)\n                    const messageHeader = new Int32Array(headerLength)\n                    for (let i = 0; i < headerLength; i++) {\n                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)\n                    }\n                    return messageHeader\n                `,\n                  Func('_msg_unpackTokenTypes', [\n                      Var('MessageHeader', 'header'),\n                  ], 'MessageHeader') `\n                    return header.slice(1, 1 + header[0])\n                `,\n                  Func('_msg_unpackTokenPositions', [\n                      Var('MessageHeader', 'header'),\n                  ], 'MessageHeader') `\n                    return header.slice(1 + header[0])\n                `,\n              ]);\n          }\n          else if (target === 'javascript') {\n              return Sequence([\n                  ConstVar('string', 'MSG_FLOAT_TOKEN', '\"number\"'),\n                  ConstVar('string', 'MSG_STRING_TOKEN', '\"string\"'),\n                  declareFuncs.msg_create `\n                    const m = []\n                    let i = 0\n                    while (i < template.length) {\n                        if (template[i] === MSG_STRING_TOKEN) {\n                            m.push('')\n                            i += 2\n                        } else if (template[i] === MSG_FLOAT_TOKEN) {\n                            m.push(0)\n                            i += 1\n                        }\n                    }\n                    return m\n                `,\n                  declareFuncs.msg_getLength `\n                    return message.length\n                `,\n                  declareFuncs.msg_getTokenType `\n                    return typeof message[tokenIndex]\n                `,\n                  declareFuncs.msg_isStringToken `\n                    return msg_getTokenType(message, tokenIndex) === 'string'\n                `,\n                  declareFuncs.msg_isFloatToken `\n                    return msg_getTokenType(message, tokenIndex) === 'number'\n                `,\n                  declareFuncs.msg_isMatching `\n                    return (message.length === tokenTypes.length) \n                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])\n                `,\n                  declareFuncs.msg_writeFloatToken `\n                    message[tokenIndex] = value\n                `,\n                  declareFuncs.msg_writeStringToken `\n                    message[tokenIndex] = value\n                `,\n                  declareFuncs.msg_readFloatToken `\n                    return message[tokenIndex]\n                `,\n                  declareFuncs.msg_readStringToken `\n                    return message[tokenIndex]\n                `,\n                  declareFuncs.msg_floats `\n                    return values\n                `,\n                  declareFuncs.msg_strings `\n                    return values\n                `,\n                  declareFuncs.msg_display `\n                    return '[' + message\n                        .map(t => typeof t === 'string' ? '\"' + t + '\"' : t.toString())\n                        .join(', ') + ']'\n                `,\n              ]);\n          }\n          else {\n              throw new Error(`Unexpected target: ${target}`);\n          }\n      },\n      exports: [\n          { name: 'x_msg_create', targets: ['assemblyscript'] },\n          { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },\n          { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },\n          { name: 'msg_writeStringToken', targets: ['assemblyscript'] },\n          { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },\n          { name: 'msg_readStringToken', targets: ['assemblyscript'] },\n          { name: 'msg_readFloatToken', targets: ['assemblyscript'] },\n          { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },\n          { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },\n      ],\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const FS_OPERATION_SUCCESS = 0;\n  const FS_OPERATION_FAILURE = 1;\n  const fsCore = {\n      codeGenerator: ({ target }) => {\n          const content = [];\n          if (target === 'assemblyscript') {\n              content.push(`\n                type fs_OperationId = Int\n                type fs_OperationStatus = Int\n                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void\n                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void\n                type fs_Url = string\n            `);\n          }\n          return Sequence([\n              ...content,\n              ConstVar('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS.toString()),\n              ConstVar('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE.toString()),\n              ConstVar('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),\n              ConstVar('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),\n              ConstVar('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),\n              // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to \n              // a function. Therefore we can get false negatives when a test happens to expect a 0.\n              Var('Int', '_FS_OPERATION_COUNTER', '1'),\n              Class('fs_SoundInfo', [\n                  Var('Int', 'channelCount'),\n                  Var('Int', 'sampleRate'),\n                  Var('Int', 'bitDepth'),\n                  Var('string', 'encodingFormat'),\n                  Var('string', 'endianness'),\n                  Var('string', 'extraOptions'),\n              ]),\n              Func('fs_soundInfoToMessage', [\n                  Var('fs_SoundInfo', 'soundInfo')\n              ], 'Message') `\n                ${ConstVar('Message', 'info', `msg_create([\n                    MSG_FLOAT_TOKEN,\n                    MSG_FLOAT_TOKEN,\n                    MSG_FLOAT_TOKEN,\n                    MSG_STRING_TOKEN,\n                    soundInfo.encodingFormat.length,\n                    MSG_STRING_TOKEN,\n                    soundInfo.endianness.length,\n                    MSG_STRING_TOKEN,\n                    soundInfo.extraOptions.length\n                ])`)}\n                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))\n                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))\n                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))\n                msg_writeStringToken(info, 3, soundInfo.encodingFormat)\n                msg_writeStringToken(info, 4, soundInfo.endianness)\n                msg_writeStringToken(info, 5, soundInfo.extraOptions)\n                return info\n            `,\n              Func('_fs_assertOperationExists', [\n                  Var('fs_OperationId', 'id'),\n                  Var('string', 'operationName'),\n              ], 'void') `\n                if (!_FS_OPERATIONS_IDS.has(id)) {\n                    throw new Error(operationName + ' operation unknown : ' + id.toString())\n                }\n            `,\n              Func('_fs_createOperationId', [], 'fs_OperationId') `\n                ${ConstVar('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}\n                _FS_OPERATIONS_IDS.add(id)\n                return id\n            `\n          ]);\n      },\n      dependencies: [msg],\n  };\n  ({\n      codeGenerator: () => Sequence([\n          Func('fs_readSoundFile', [\n              Var('fs_Url', 'url'),\n              Var('fs_SoundInfo', 'soundInfo'),\n              Var('fs_OperationSoundCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}\n            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)\n            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func('x_fs_onReadSoundFileResponse', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_OperationStatus', 'status'),\n              Var('FloatArray[]', 'sound'),\n          ], 'void') `\n            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')\n            _FS_OPERATIONS_IDS.delete(id)\n            // Finish cleaning before calling the callback in case it would throw an error.\n            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)\n            callback(id, status, sound)\n            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onReadSoundFileResponse',\n          },\n      ],\n      imports: [\n          Func('i_fs_readSoundFile', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_Url', 'url'),\n              Var('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsCore],\n  });\n  ({\n      codeGenerator: () => Sequence([\n          Func('fs_writeSoundFile', [\n              Var('FloatArray[]', 'sound'),\n              Var('fs_Url', 'url'),\n              Var('fs_SoundInfo', 'soundInfo'),\n              Var('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func('x_fs_onWriteSoundFileResponse', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_OperationStatus', 'status'),\n          ], 'void') `\n            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')\n            _FS_OPERATIONS_IDS.delete(id)\n            // Finish cleaning before calling the callback in case it would throw an error.\n            ${ConstVar('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}\n            callback(id, status)\n            _FS_OPERATIONS_CALLBACKS.delete(id)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onWriteSoundFileResponse',\n          },\n      ],\n      imports: [\n          Func('i_fs_writeSoundFile', [\n              Var('fs_OperationId', 'id'),\n              Var('FloatArray[]', 'sound'),\n              Var('fs_Url', 'url'),\n              Var('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsCore],\n  });\n  const fsSoundStreamCore = {\n      codeGenerator: () => Sequence([\n          ConstVar('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),\n          ConstVar('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),\n          Func('fs_closeSoundStream', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_OperationStatus', 'status'),\n          ], 'void') `\n            if (!_FS_OPERATIONS_IDS.has(id)) {\n                return\n            }\n            _FS_OPERATIONS_IDS.delete(id)\n            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)\n            _FS_OPERATIONS_CALLBACKS.delete(id)\n            // Delete this last, to give the callback \n            // a chance to save a reference to the buffer\n            // If write stream, there won't be a buffer\n            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {\n                _FS_SOUND_STREAM_BUFFERS.delete(id)\n            }\n            i_fs_closeSoundStream(id, status)\n        `,\n          Func('x_fs_onCloseSoundStream', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_OperationStatus', 'status'),\n          ], 'void') `\n            fs_closeSoundStream(id, status)\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onCloseSoundStream',\n          },\n      ],\n      imports: [\n          Func('i_fs_closeSoundStream', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_OperationStatus', 'status'),\n          ], 'void') ``,\n      ],\n      dependencies: [bufCore, fsCore],\n  };\n  ({\n      codeGenerator: () => Sequence([\n          Func('fs_openSoundReadStream', [\n              Var('fs_Url', 'url'),\n              Var('fs_SoundInfo', 'soundInfo'),\n              Var('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}\n            ${ConstVar('Array<buf_SoundBuffer>', 'buffers', '[]')}\n            for (${Var('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {\n                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))\n            }\n            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func('x_fs_onSoundStreamData', [\n              Var('fs_OperationId', 'id'),\n              Var('FloatArray[]', 'block'),\n          ], 'Int') `\n            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')\n            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)\n            for (${Var('Int', 'i', '0')}; i < buffers.length; i++) {\n                buf_pushBlock(buffers[i], block[i])\n            }\n            return buffers[0].pullAvailableLength\n        `\n      ]),\n      exports: [\n          {\n              name: 'x_fs_onSoundStreamData',\n          },\n      ],\n      imports: [\n          Func('i_fs_openSoundReadStream', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_Url', 'url'),\n              Var('Message', 'info'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsSoundStreamCore, bufPushPull],\n  });\n  ({\n      codeGenerator: () => Sequence([\n          Func('fs_openSoundWriteStream', [\n              Var('fs_Url', 'url'),\n              Var('fs_SoundInfo', 'soundInfo'),\n              Var('fs_OperationCallback', 'callback'),\n          ], 'fs_OperationId') `\n            const id = _fs_createOperationId()\n            _FS_SOUND_STREAM_BUFFERS.set(id, [])\n            _FS_OPERATIONS_CALLBACKS.set(id, callback)\n            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))\n            return id\n        `,\n          Func('fs_sendSoundStreamData', [\n              Var('fs_OperationId', 'id'),\n              Var('FloatArray[]', 'block')\n          ], 'void') `\n            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')\n            i_fs_sendSoundStreamData(id, block)\n        `\n      ]),\n      imports: [\n          Func('i_fs_openSoundWriteStream', [\n              Var('fs_OperationId', 'id'),\n              Var('fs_Url', 'url'),\n              Var('Message', 'info'),\n          ], 'void') ``,\n          Func('i_fs_sendSoundStreamData', [\n              Var('fs_OperationId', 'id'),\n              Var('FloatArray[]', 'block'),\n          ], 'void') ``,\n      ],\n      dependencies: [fsSoundStreamCore],\n  });\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  AnonFunc([Var('Message', 'm')], 'void') ``;\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  // NOTE : not necessarily the most logical place to put this function, but we need it here\n  // cause it's imported by the bindings.\n  const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\n  /** Helper to create a Module by wrapping a RawModule with Bindings */\n  const createModule = (rawModule, bindings) => \n  // Use empty object on proxy cause proxy cannot redefine access of member of its target,\n  // which causes issues for example for WebAssembly exports.\n  // See : https://stackoverflow.com/questions/75148897/get-on-proxy-property-items-is-a-read-only-and-non-configurable-data-proper\n  new Proxy({}, {\n      get: (_, k) => {\n          if (bindings.hasOwnProperty(k)) {\n              const key = String(k);\n              const bindingSpec = bindings[key];\n              switch (bindingSpec.type) {\n                  case 'raw':\n                      // Cannot use hasOwnProperty here cause not defined in wasm exports object\n                      if (k in rawModule) {\n                          return rawModule[key];\n                      }\n                      else {\n                          throw new Error(`Key ${String(key)} doesn't exist in raw module`);\n                      }\n                  case 'proxy':\n                  case 'callback':\n                      return bindingSpec.value;\n              }\n              // We need to return undefined here for compatibility with various APIs\n              // which inspect object's attributes.\n          }\n          else {\n              return undefined;\n          }\n      },\n      set: (_, k, newValue) => {\n          if (bindings.hasOwnProperty(String(k))) {\n              const key = String(k);\n              const bindingSpec = bindings[key];\n              if (bindingSpec.type === 'callback') {\n                  bindingSpec.value = newValue;\n              }\n              else {\n                  throw new Error(`Binding key ${String(key)} is read-only`);\n              }\n          }\n          else {\n              throw new Error(`Key ${String(k)} is not defined in bindings`);\n          }\n          return true;\n      },\n  });\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  /** @copyright Assemblyscript ESM bindings */\n  const liftString = (wasmExports, pointer) => {\n      if (!pointer)\n          return null;\n      pointer = pointer >>> 0;\n      const end = (pointer +\n          new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\n          1;\n      const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\n      let start = pointer >>> 1;\n      let string = '';\n      while (end - start > 1024) {\n          string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\n      }\n      return string + String.fromCharCode(...memoryU16.subarray(start, end));\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  // REF : Assemblyscript ESM bindings\n  const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\n      const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\n          env: {\n              abort: (messagePointer, \n              // filename, not useful because we compile everything to a single string\n              _, lineNumber, columnNumber) => {\n                  const message = liftString(wasmExports, messagePointer);\n                  lineNumber = lineNumber;\n                  columnNumber = columnNumber;\n                  (() => {\n                      // @external.js\n                      throw Error(`${message} at ${lineNumber}:${columnNumber}`);\n                  })();\n              },\n              seed: () => {\n                  return (() => {\n                      return Date.now() * Math.random();\n                  })();\n              },\n              'console.log': (textPointer) => {\n                  console.log(liftString(wasmExports, textPointer));\n              },\n          },\n          ...wasmImports,\n      });\n      const wasmExports = instanceAndModule.instance\n          .exports;\n      return instanceAndModule.instance;\n  };\n\n  const readMetadata$2 = async (wasmBuffer) => {\n      // In order to read metadata, we need to introspect the module to get the imports\n      const inputImports = {};\n      const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\n      // Then we generate dummy functions to be able to instantiate the module\n      wasmModule\n          .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\n          .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\n      const wasmInstance = await instantiateWasmModule(wasmBuffer, {\n          input: inputImports,\n      });\n      // Finally, once the module instantiated, we read the metadata\n      const wasmExports = wasmInstance.exports;\n      const stringPointer = wasmExports.metadata.valueOf();\n      const metadataJSON = liftString(wasmExports, stringPointer);\n      return JSON.parse(metadataJSON);\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const createRawModule = (code) => new Function(`\n        ${code}\n        return exports\n    `)();\n  const createBindings = (rawModule) => ({\n      fs: { type: 'proxy', value: createFsModule(rawModule) },\n      metadata: { type: 'raw' },\n      configure: { type: 'raw' },\n      loop: { type: 'raw' },\n      io: { type: 'raw' },\n      commons: {\n          type: 'proxy',\n          value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),\n      },\n  });\n  const createEngine = (code) => {\n      const rawModule = createRawModule(code);\n      return createModule(rawModule, createBindings(rawModule));\n  };\n  const createFsModule = (rawModule) => {\n      const fs = createModule(rawModule, {\n          onReadSoundFile: { type: 'callback', value: () => undefined },\n          onWriteSoundFile: { type: 'callback', value: () => undefined },\n          onOpenSoundReadStream: { type: 'callback', value: () => undefined },\n          onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\n          onSoundStreamData: { type: 'callback', value: () => undefined },\n          onCloseSoundStream: { type: 'callback', value: () => undefined },\n          sendReadSoundFileResponse: {\n              type: 'proxy',\n              value: rawModule.x_fs_onReadSoundFileResponse,\n          },\n          sendWriteSoundFileResponse: {\n              type: 'proxy',\n              value: rawModule.x_fs_onWriteSoundFileResponse,\n          },\n          sendSoundStreamData: {\n              type: 'proxy',\n              value: rawModule.x_fs_onSoundStreamData,\n          },\n          closeSoundStream: {\n              type: 'proxy',\n              value: rawModule.x_fs_onCloseSoundStream,\n          },\n      });\n      rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);\n      rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);\n      rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);\n      rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);\n      rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);\n      rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);\n      return fs;\n  };\n  const createCommonsModule = (rawModule, bitDepth) => {\n      const floatArrayType = getFloatArrayType(bitDepth);\n      return createModule(rawModule, {\n          getArray: { type: 'proxy', value: rawModule.commons_getArray },\n          setArray: {\n              type: 'proxy',\n              value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),\n          },\n      });\n  };\n\n  const readMetadata$1 = async (target, compiled) => {\n      switch (target) {\n          case 'assemblyscript':\n              return readMetadata$2(compiled);\n          case 'javascript':\n              return createEngine(compiled).metadata;\n      }\n  };\n\n  const defaultSettingsForRun = (patchUrl) => {\n      const rootUrl = urlDirName(patchUrl);\n      return {\n          messageHandler: (node, message) => index(node, message, { rootUrl }),\n      };\n  };\n  const readMetadata = (compiledPatch) => {\n      if (typeof compiledPatch === 'string') {\n          return readMetadata$1('javascript', compiledPatch);\n      }\n      else {\n          return readMetadata$1('assemblyscript', compiledPatch);\n      }\n  };\n\n  var run = async (audioContext, compiledPatch, settings) => {\n      const { messageHandler } = settings;\n      const webpdNode = new WebPdWorkletNode(audioContext);\n      webpdNode.port.onmessage = (msg) => messageHandler(webpdNode, msg);\n      if (typeof compiledPatch === 'string') {\n          webpdNode.port.postMessage({\n              type: 'code:JS',\n              payload: {\n                  jsCode: compiledPatch,\n              },\n          });\n      }\n      else {\n          webpdNode.port.postMessage({\n              type: 'code:WASM',\n              payload: {\n                  wasmBuffer: compiledPatch,\n              },\n          });\n      }\n      return webpdNode;\n  };\n\n  exports.defaultSettingsForRun = defaultSettingsForRun;\n  exports.initialize = initialize;\n  exports.readMetadata = readMetadata;\n  exports.run = run;\n\n  return exports;\n\n})({});\n";

const WEBPD_RUNTIME_FILENAME = 'webpd-runtime.js';
var appGenerator = (template, artefacts) => {
    switch (template) {
        case 'bare-bones':
            const generated = bareBonesApp({ artefacts });
            return {
                ...generated,
                [WEBPD_RUNTIME_FILENAME]: WEBPD_RUNTIME_CODE,
            };
        default:
            throw new Error(`Unknown template ${template}`);
    }
};
const bareBonesApp = (settings) => {
    const { artefacts } = settings;
    if (!artefacts.javascript && !artefacts.wasm) {
        throw new Error(`Needs at least javascript or wasm to run`);
    }
    const compiledPatchFilename = artefacts.javascript
        ? 'patch.js'
        : 'patch.wasm';
    // prettier-ignore
    const generatedApp = {
        'index.html': `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>WebPd boilerplate</title>
        <style>
            #start {
                display: none;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            #loading {
                width: 100%;
                height: 100%;
                position: fixed;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                justify-content: center;
                align-items: center;
            }
        </style>
    </head>
    <body>
        <h1>My Web Page</h1>
        <div>For more info about usage (how to interact with the patch), you can open this HTML file in a code editor.</div>
        <button id="start"> Start </button>
        <div id="loading"> Loading ... </div>
        <script src="${WEBPD_RUNTIME_FILENAME}"></script>
        <script>
            // SUMMARY
            // 1. WEB PAGE INITIALIZATION
            // 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
            // 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT (coming soon ...)


            // ------------- 1. WEB PAGE INITIALIZATION
            const loadingDiv = document.querySelector('#loading')
            const startButton = document.querySelector('#start')
            const audioContext = new AudioContext()

            let patch = null
            let stream = null
            let webpdNode = null

            const initApp = async () => {
                // Register the worklet
                await WebPdRuntime.initialize(audioContext)

                // Fetch the patch code
                response = await fetch('${compiledPatchFilename}')
                patch = await ${artefacts.javascript ?
            'response.text()' : 'response.arrayBuffer()'}

                // Comment this if you don't need audio input
                stream = await navigator.mediaDevices.getUserMedia({ audio: true })

                // Hide loading and show start button
                loadingDiv.style.display = 'none'
                startButton.style.display = 'block'
            }

            const startApp = async () => {
                // AudioContext needs to be resumed on click to protects users 
                // from being spammed with autoplay.
                // See : https://github.com/WebAudio/web-audio-api/issues/345
                if (audioContext.state === 'suspended') {
                    audioContext.resume()
                }

                // Setup web audio graph
                webpdNode = await WebPdRuntime.run(
                    audioContext, 
                    patch, 
                    WebPdRuntime.defaultSettingsForRun('./${compiledPatchFilename}'),
                )
                webpdNode.connect(audioContext.destination)

                // Comment this if you don't need audio input
                const sourceNode = audioContext.createMediaStreamSource(stream)
                sourceNode.connect(webpdNode)

                // Hide the start button
                startButton.style.display = 'none'
            }

            startButton.onclick = startApp

            initApp().
                then(() => {
                    console.log('App initialized')
                })

            
            // ------------- 2. SENDING MESSAGES FROM JAVASCRIPT TO THE PATCH
            // Use the function sendMsgToWebPd to send a message from JavaScript to an object inside your patch.
            // 
            // Parameters : 
            // - nodeId: the ID of the object you want to send a message to. 
            //          This ID is a string that has been assigned by WebPd at compilation.
            //          You can find below the list of available IDs with hints to help you 
            //          identify the object you want to interact with.
            // - portletId : the ID of the object portlet to which the message should be sent. 
            // - message : the message to send. This must be a list of strings and / or numbers.
            // 
            // Examples :
            // - sending a message to a bang node of ID 'n_0_1' :
            //          sendMsgToWebPd('n_0_1', '0', ['bang'])
            // - sending a message to a number object of ID 'n_0_2' :
            //          sendMsgToWebPd('n_0_2', '0', [123])
            // 
            const sendMsgToWebPd = (nodeId, portletId, message) => {
                webpdNode.port.postMessage({
                    type: 'io:messageReceiver',
                    payload: {
                        nodeId,
                        portletId,
                        message,
                    },
                })
            }
            
            // Here is an index of objects IDs to which you can send messages, with hints so you can find the right ID.
            // Note that by default only GUI objects (bangs, sliders, etc ...) are available.${artefacts.dspGraph
            && artefacts.dspGraph.io
            && Object.keys(artefacts.dspGraph.io.messageReceivers).length ?
            Object.entries(artefacts.dspGraph.io.messageReceivers)
                .map(([nodeId, { portletIds, metadata: _metadata }]) => portletIds.map(portletId => {
                const metadata = _metadata;
                if (!metadata) {
                    return '';
                }
                else if (metadata.group === 'control' || metadata.group === 'control:float') {
                    return `
            //  - nodeId "${nodeId}" portletId "${portletId}"
            //      * type "${metadata.type}"
            //      * position ${JSON.stringify(metadata.position)}${metadata.label ? `
            //      * label "${metadata.label}"` : ''}
            `;
                }
                else if (metadata.group === 'send') {
                    return `
            //  - nodeId "${nodeId}" portletId "${portletId}"
            //      * type "send"
            //      * send "${metadata.name}"
            `;
                }
                else {
                    return '';
                }
            })).join('')
            : `
            // EMPTY (did you place a GUI object in your patch ?)
`}


            // ------------- 3. SENDING MESSAGES FROM THE PATCH TO JAVASCRIPT
            // Coming soon ... 

        </script>
    </body>
</html>`
    };
    if (artefacts.javascript) {
        generatedApp[compiledPatchFilename] = artefacts.javascript;
    }
    else {
        generatedApp[compiledPatchFilename] = artefacts.wasm;
    }
    return generatedApp;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const discoverGuiControls = (pdJson) => {
    const rootPatch = pdJson.patches[pdJson.rootPatchId];
    return {
        controls: _discoverGuiControlsRecursive(pdJson, rootPatch),
        comments: Object.values(pdJson.patches[pdJson.rootPatchId].nodes)
            .filter((node) => node.type === 'text')
            .map((node) => {
            const comment = {
                type: 'comment',
                patch: rootPatch,
                node,
                text: node.args[0].toString(),
            };
            return comment;
        }),
    };
};
const _discoverGuiControlsRecursive = (pdJson, patch, viewport = null) => {
    if (viewport === null) {
        viewport = {
            topLeft: { x: -Infinity, y: -Infinity },
            bottomRight: { x: Infinity, y: Infinity },
        };
    }
    const controls = [];
    Object.values(patch.nodes).forEach((node) => {
        if (node.type === 'pd' && node.nodeClass === 'subpatch') {
            const subpatch = pdJson.patches[node.patchId];
            const nodeLayout = _assertNodeLayout(node.layout);
            if (!subpatch.layout.graphOnParent) {
                return;
            }
            const subpatchLayout = _assertPatchLayout(subpatch.layout);
            // 1. we convert all coordinates to the subpatch coords system
            const toSubpatchCoords = makeTranslationTransform({ x: nodeLayout.x, y: nodeLayout.y }, { x: subpatchLayout.viewportX, y: subpatchLayout.viewportY });
            const parentViewport = {
                topLeft: toSubpatchCoords(viewport.topLeft),
                bottomRight: toSubpatchCoords(viewport.bottomRight),
            };
            const topLeft = {
                x: subpatchLayout.viewportX,
                y: subpatchLayout.viewportY,
            };
            const subpatchViewport = {
                topLeft,
                bottomRight: sumPoints(topLeft, {
                    x: subpatchLayout.viewportWidth,
                    y: subpatchLayout.viewportHeight,
                }),
            };
            // 2. we compute the visible intersection in the subpatch coords system
            // and call the function for the subpatch
            const visibleSubpatchViewport = computeRectanglesIntersection(parentViewport, subpatchViewport);
            if (visibleSubpatchViewport === null) {
                return;
            }
            const children = _discoverGuiControlsRecursive(pdJson, subpatch, visibleSubpatchViewport);
            const control = {
                type: 'container',
                patch,
                node,
                children,
            };
            controls.push(control);
            // 3. When we get ab actual control node, we see if it is inside the
            // visible viewport (which was previously transformed to local coords).
        }
        else if (node.type in CONTROL_TYPE && node.nodeClass === 'control') {
            const nodeLayout = _assertNodeLayout(node.layout);
            if (!isPointInsideRectangle({
                x: nodeLayout.x,
                y: nodeLayout.y,
            }, viewport)) {
                return;
            }
            const control = {
                type: 'control',
                patch,
                node,
            };
            controls.push(control);
        }
    });
    return controls;
};
const traverseGuiControls = (controls, func) => {
    controls.forEach((control) => {
        if (control.type === 'container') {
            traverseGuiControls(control.children, func);
        }
        else if (control.type === 'control') {
            func(control);
        }
    });
};
const makeTranslationTransform = (fromPoint, toPoint) => {
    const xOffset = toPoint.x - fromPoint.x;
    const yOffset = toPoint.y - fromPoint.y;
    return (fromPoint) => {
        return {
            x: fromPoint.x + xOffset,
            y: fromPoint.y + yOffset,
        };
    };
};
const sumPoints = (p1, p2) => ({
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
        return null;
    }
    else {
        return { topLeft, bottomRight };
    }
};
const isPointInsideRectangle = (p, r) => r.topLeft.x <= p.x &&
    p.x <= r.bottomRight.x &&
    r.topLeft.y <= p.y &&
    p.y <= r.bottomRight.y;
const _assertNodeLayout = (layout) => {
    if (!layout) {
        throw new Error(`Missing node layout`);
    }
    const x = layout.x;
    const y = layout.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error(`Missing node layout attributes`);
    }
    return {
        x,
        y,
    };
};
const _assertPatchLayout = (layout) => {
    if (!layout) {
        throw new Error(`Missing patch layout`);
    }
    const viewportX = layout.viewportX;
    const viewportY = layout.viewportY;
    const viewportWidth = layout.viewportWidth;
    const viewportHeight = layout.viewportHeight;
    if (typeof viewportX !== 'number' ||
        typeof viewportY !== 'number' ||
        typeof viewportWidth !== 'number' ||
        typeof viewportHeight !== 'number') {
        debugger;
        throw new Error(`Missing patch layout attributes`);
    }
    return {
        viewportX,
        viewportY,
        viewportWidth,
        viewportHeight,
    };
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/** Regular expressions to deal with dollar-args */
const DOLLAR_VAR_REGEXP = /\$(\d+)/;
const resolvePatch = (pd, patchId) => {
    const patch = pd.patches[patchId];
    if (!patch) {
        throw new Error(`Patch ${patchId} not found`);
    }
    return patch;
};
const resolvePdNode = (patch, nodeId) => {
    const pdNode = patch.nodes[nodeId];
    if (!pdNode) {
        throw new Error(`Pd node ${nodeId} not found in patch ${patch.id}`);
    }
    return pdNode;
};
const resolveNodeType = (nodeBuilders, nodeType) => {
    const nodeBuilder = nodeBuilders[nodeType];
    if (!nodeBuilder) {
        return null;
    }
    if (nodeBuilder.aliasTo) {
        return resolveNodeType(nodeBuilders, nodeBuilder.aliasTo);
    }
    else {
        return { nodeBuilder: nodeBuilder, nodeType };
    }
};
/**
 * Takes an object string arg which might contain dollars, and returns the resolved version.
 * e.g. : [table $0-ARRAY] inside a patch with ID 1887 would resolve to [table 1887-ARRAY]
 */
const resolveDollarArg = (arg, patch) => {
    // Since we have string patch ids and Pd uses int, we parse
    // patch id back to int. This is useful for example so that
    // [float $0] would work.
    const patchIdInt = parseInt(patch.id);
    if (isNaN(patchIdInt)) {
        throw new Error(`Invalid patch id`);
    }
    const patchArgs = [patchIdInt, ...patch.args];
    const dollarVarRegex = new RegExp(DOLLAR_VAR_REGEXP, 'g');
    let matchDollar;
    while ((matchDollar = dollarVarRegex.exec(arg))) {
        const index = parseInt(matchDollar[1], 10);
        const isWithinRange = 0 <= index && index < patchArgs.length;
        if (matchDollar[0] === arg) {
            return isWithinRange ? patchArgs[index] : undefined;
        }
        else {
            if (isWithinRange) {
                arg = arg.replace(matchDollar[0], patchArgs[index].toString());
            }
        }
    }
    return arg;
};
const resolveArrayDollarArgs = (rootPatch, args) => {
    const name = resolveDollarArg(args[0], rootPatch);
    const size = typeof args[1] === 'string'
        ? resolveDollarArg(args[1], rootPatch)
        : args[1];
    return [
        (name === undefined ? '' : name).toString(),
        size === undefined ? 0 : size,
        args[2],
    ];
};
const resolvePdNodeDollarArgs = (rootPatch, args) => args.map((arg) => typeof arg === 'string' ? resolveDollarArg(arg, rootPatch) : arg);

/**
 * Goes through a pd object, resolves and instantiates abstractions, turning
 * them into standard subpatches.
 * @returns A new PdJson.Pd object, which contains all patches and arrays
 * from the resolved abstraction as well as those from the pd object passed as argument.
 * The second value returned is the main root patch to be used for further processing.
 */
var instantiateAbstractions = async (pd, nodeBuilders, abstractionLoader) => {
    const [namemap, pdWithReassignedIds] = _reassignUniquePdGlobalIds({ patches: {}, arrays: {}, rootPatchId: pd.rootPatchId }, pd);
    const compilation = {
        pd: pdWithReassignedIds,
        nodeBuilders,
        abstractions: {},
        errors: {},
        warnings: {},
        abstractionLoader,
    };
    const rootPatch = _resolveRootPatch$1(compilation.pd);
    Object.values(compilation.pd.arrays).forEach((array) => (array.args = resolveArrayDollarArgs(rootPatch, array.args)));
    await _instantiateAbstractionsRecurs(compilation, rootPatch, rootPatch, namemap);
    const hasErrors = Object.keys(compilation.errors).length;
    if (hasErrors) {
        return {
            status: 1,
            pd: compilation.pd,
            errors: compilation.errors,
            warnings: compilation.warnings,
        };
    }
    else {
        return {
            status: 0,
            pd: compilation.pd,
            abstractions: compilation.abstractions,
            warnings: compilation.warnings,
        };
    }
};
const _instantiateAbstractionsRecurs = async (compilation, rootPatch, patch, namemap) => {
    const { pd, abstractionLoader, errors, warnings } = compilation;
    patch.nodes = { ...patch.nodes };
    for (let pdNode of Object.values(patch.nodes)) {
        if (errors.hasOwnProperty(pdNode.type)) {
            continue;
        }
        // 1. If subpatch, resolve its `patchId` according to the namemap,
        // and continue recursively by entering inside the subpatch
        if (pdNode.nodeClass === 'subpatch') {
            pdNode = patch.nodes[pdNode.id] = {
                ...pdNode,
                patchId: _resolveIdNamemap(namemap.patches, pdNode.patchId),
            };
            await _instantiateAbstractionsRecurs(compilation, rootPatch, resolvePatch(pd, pdNode.patchId), namemap);
            continue;
            // 2. If array, resolve its `arrayId` according to the namemap.
        }
        else if (pdNode.nodeClass === 'array') {
            pdNode = patch.nodes[pdNode.id] = {
                ...pdNode,
                arrayId: _resolveIdNamemap(namemap.arrays, pdNode.arrayId),
            };
            continue;
        }
        // 3. If normal node, whose type resolves from the `nodeBuilders`,
        // we do nothing.
        if (resolveNodeType(compilation.nodeBuilders, pdNode.type) !== null) {
            continue;
        }
        // 4. Otherwise, if node type could not be resolved, we load as an abstraction.
        const resolutionResult = await _resolveAbstraction(compilation, pdNode.type, abstractionLoader);
        if (resolutionResult.parsingWarnings) {
            warnings[pdNode.type] = resolutionResult.parsingWarnings;
        }
        if (resolutionResult.status === 1) {
            const { status, parsingWarnings, ...abstractionErrors } = resolutionResult;
            errors[pdNode.type] = abstractionErrors;
            continue;
        }
        // Since the abstraction is loaded as an independant PdJson.Pd object,
        // the global ids of its patches and arrays, might clash with the ids
        // in our `pd` object. Therefore, we need to reassign these ids.
        const [newNamemap, abstractionInstance] = _reassignUniquePdGlobalIds(pd, resolutionResult.pd);
        const newRootPatch = _resolveRootPatch$1(abstractionInstance);
        // Replace the abstraction node by a subpatch node, so that the abstraction
        // can be dealt with the same way a subpatch is handled.
        pdNode = patch.nodes[pdNode.id] = {
            ...pdNode,
            args: resolvePdNodeDollarArgs(rootPatch, pdNode.args),
            nodeClass: 'subpatch',
            patchId: newRootPatch.id,
            type: 'pd',
        };
        // Prepare the new root patch, resolve arrays args, because it won't be done
        // further down in the code.
        newRootPatch.args = pdNode.args;
        Object.values(abstractionInstance.arrays).forEach((array) => (array.args = resolveArrayDollarArgs(newRootPatch, array.args)));
        // Finally, combine the abstraction patches and arrays with the ones in `pd`.
        // At this stage ids should not collide, and references saved in `namemap`,
        // so we can recurse to deal with nodes inside the abstraction.
        pd.patches = {
            ...pd.patches,
            ...abstractionInstance.patches,
        };
        pd.arrays = {
            ...pd.arrays,
            ...abstractionInstance.arrays,
        };
        await _instantiateAbstractionsRecurs(compilation, newRootPatch, newRootPatch, newNamemap);
    }
};
const _resolveRootPatch$1 = (pd) => {
    const rootPatch = pd.patches[pd.rootPatchId];
    if (!rootPatch) {
        throw new Error(`Could not resolve root patch`);
    }
    return rootPatch;
};
const _resolveAbstraction = async (compilation, nodeType, abstractionLoader) => {
    if (!compilation.abstractions[nodeType]) {
        const result = await abstractionLoader(nodeType);
        if (result.status === 0) {
            compilation.abstractions[nodeType] = result.pd;
        }
        return result;
    }
    return {
        status: 0,
        pd: compilation.abstractions[nodeType],
    };
};
const _resolveIdNamemap = (map, objectId) => {
    const newObjectId = map.get(objectId);
    if (newObjectId === undefined) {
        throw new Error(`Could not resolve ${objectId}`);
    }
    return newObjectId;
};
const _reassignUniquePdGlobalIds = (pdToMergeInto, pdToReassign) => {
    const pdWithReassignedIds = {
        patches: {},
        arrays: {},
        rootPatchId: pdToReassign.rootPatchId,
    };
    const namemap = {
        patches: new Map(),
        arrays: new Map(),
    };
    let patchesIds = Object.keys(pdToMergeInto.patches);
    patchesIds = patchesIds.length ? patchesIds : ['-1'];
    let arraysIds = Object.keys(pdToMergeInto.arrays);
    arraysIds = arraysIds.length ? arraysIds : ['-1'];
    let patchesIdCounter = Math.max(...patchesIds.map((id) => parseInt(id))) + 1;
    let arraysIdCounter = Math.max(...arraysIds.map((id) => parseInt(id))) + 1;
    Object.entries(pdToReassign.patches).forEach(([oldId, patch]) => {
        const newId = `${patchesIdCounter++}`;
        namemap.patches.set(oldId, newId);
        pdWithReassignedIds.patches[newId] = {
            ...patch,
            id: newId,
        };
    });
    Object.entries(pdToReassign.arrays).forEach(([oldId, array]) => {
        const newId = `${arraysIdCounter++}`;
        namemap.arrays.set(oldId, newId);
        pdWithReassignedIds.arrays[newId] = {
            ...array,
            id: newId,
        };
    });
    pdWithReassignedIds.rootPatchId = _resolveIdNamemap(namemap.patches, pdWithReassignedIds.rootPatchId);
    return [namemap, pdWithReassignedIds];
};

const emptyBuilder = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: {},
    }),
};
const nodeBuilders = {
    pd: emptyBuilder,
    inlet: emptyBuilder,
    outlet: emptyBuilder,
    'inlet~': emptyBuilder,
    'outlet~': emptyBuilder,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$Q = {
    translateArgs: (pdNode) => ({
        channelCount: assertNumber(pdNode.args[0]),
    }),
    build: (nodeArgs) => ({
        inlets: mapArray(countTo$1(nodeArgs.channelCount), (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]),
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
};
// ------------------------------- node implementation ------------------------------ //
const nodeImplementation$I = {
    inlineLoop: ({ node, ins }) => ast$1 `${Object.keys(node.inlets)
        .map((inletId) => ins[inletId])
        .join(' + ')}`
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const coldFloatInlet = (storageName) => {
    return AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${storageName} = msg_readFloatToken(m, 0)
            return
        }
    `;
};
const coldStringInlet = (storageName) => {
    return AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isMatching(m, [MSG_STRING_TOKEN])) {
            ${storageName} = msg_readStringToken(m, 0)
            return
        }
    `;
};
const coldFloatInletWithSetter = (setterName, state) => {
    return AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${setterName}(${state}, msg_readFloatToken(m, 0))
            return
        }
    `;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const generateVariableNamesNodeType = (nodeType, functionNames) => createNamespace(nodeType, {
    stateClass: `n_State_${nodeType}`,
    ...mapArray(functionNames || [], (name) => [
        name,
        `n_${nodeType}_${name}`,
    ]),
});

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$P = {
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
// ------------------------------- node implementation ------------------------------ //
const variableNames$C = generateVariableNamesNodeType('sig_t');
const nodeImplementation$H = {
    initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$C.stateClass, state, `{
                currentValue: ${args.initValue}
            }`)}
        `,
    inlineLoop: ({ state }) => ast$1 `${state}.currentValue`,
    messageReceivers: ({ state }) => ({
        '0': coldFloatInlet(`${state}.currentValue`),
    }),
    dependencies: [
        () => Sequence$1([
            Class$1(variableNames$C.stateClass, [
                Var$1('Float', 'currentValue')
            ]),
        ]),
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$O = {
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
// ------------------------------- node implementation ------------------------------ //
const nodeImplementation$G = {
    messageReceivers: ({ snds }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${snds.$0}(m)
                return
            } else {
                ${snds.$1}(m)
                return
            }
        `,
    }),
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const endpointsEqual = (a1, a2) => a1.portletId === a2.portletId && a1.nodeId === a2.nodeId;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const addNode = (graph, node) => {
    if (!graph[node.id]) {
        graph[node.id] = node;
    }
    else {
        throw new Error(`Node "${node.id}" already exists`);
    }
    return graph[node.id];
};
const connect = (graph, source, sink) => {
    const sinkNode = getNode(graph, sink.nodeId);
    const sourceNode = getNode(graph, source.nodeId);
    const otherSources = getSources(sinkNode, sink.portletId);
    const otherSinks = getSinks(sourceNode, source.portletId);
    const outlet = getOutlet(sourceNode, source.portletId);
    const inlet = getInlet(sinkNode, sink.portletId);
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
        throw new Error(`Incompatible portlets types ${source.nodeId} | ${source.portletId} (${outlet.type}) -> ${sink.nodeId} | ${sink.portletId} (${inlet.type})`);
    }
    if (inlet.type === 'signal' && otherSources.length) {
        throw new Error(`Signal inlets can have only one connection`);
    }
    _ensureConnectionEndpointArray(sinkNode.sources, sink.portletId).push(source);
    _ensureConnectionEndpointArray(sourceNode.sinks, source.portletId).push(sink);
};
/** Remove all existing connections from `sourceNodeId` to `sinkNodeId`. */
const disconnectNodes = (graph, sourceNodeId, sinkNodeId) => {
    const sourceNode = getNode(graph, sourceNodeId);
    const sinkNode = getNode(graph, sinkNodeId);
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const IMPLICIT_NODE_TYPES = {
    MIXER: '_mixer~',
    ROUTE_MSG: '_routemsg',
    CONSTANT_SIGNAL: 'sig~',
};
var IdNamespaces;
(function (IdNamespaces) {
    IdNamespaces["PD"] = "n";
    /** Node added for enabling translation from pd to dp graph  */
    IdNamespaces["IMPLICIT_NODE"] = "m";
})(IdNamespaces || (IdNamespaces = {}));
const buildGraphNodeId = (patchId, nodeLocalId) => {
    return `${IdNamespaces.PD}_${patchId}_${nodeLocalId}`;
};
const buildGraphPortletId = (pdPortletId) => pdPortletId.toString(10);
/** Node id for nodes added while converting from PdJson */
const buildImplicitGraphNodeId = (sink, nodeType) => {
    nodeType = nodeType.replaceAll(/[^a-zA-Z0-9_]/g, '');
    return `${IdNamespaces.IMPLICIT_NODE}_${sink.nodeId}_${sink.portletId}_${nodeType}`;
};
// ================================== MAIN ================================== //
var toDspGraph = async (pd, nodeBuilders$1, abstractionLoader = async (nodeType) => ({
    status: 1,
    unknownNodeType: nodeType,
})) => {
    const abstractionsResult = await instantiateAbstractions(pd, nodeBuilders$1, abstractionLoader);
    const hasWarnings = Object.keys(abstractionsResult.warnings);
    if (abstractionsResult.status === 1) {
        return {
            status: 1,
            abstractionsLoadingErrors: abstractionsResult.errors,
            abstractionsLoadingWarnings: hasWarnings
                ? abstractionsResult.warnings
                : undefined,
        };
    }
    const { pd: pdWithResolvedAbstractions } = abstractionsResult;
    const compilation = {
        pd: pdWithResolvedAbstractions,
        nodeBuilders: nodeBuilders$1,
        graph: {},
    };
    const rootPatch = _resolveRootPatch(pdWithResolvedAbstractions);
    _traversePatches(compilation, [rootPatch], _buildNodes);
    _buildConnections(compilation, [rootPatch]);
    Object.values(compilation.graph).forEach((node) => {
        if (Object.keys(nodeBuilders).includes(node.type)) {
            deleteNode(compilation.graph, node.id);
        }
    });
    const arrays = Object.values(compilation.pd.arrays).reduce((arrays, array) => {
        arrays[array.args[0]] = array.data
            ? new Float32Array(array.data)
            : new Float32Array(array.args[1]);
        return arrays;
    }, {});
    return {
        status: 0,
        graph: compilation.graph,
        pd: compilation.pd,
        arrays,
        abstractionsLoadingWarnings: hasWarnings
            ? abstractionsResult.warnings
            : undefined,
    };
};
// ================================== DSP GRAPH NODES ================================== //
const _buildNodes = (compilation, patchPath) => {
    const patch = _currentPatch(patchPath);
    const rootPatch = _rootPatch(patchPath);
    Object.values(patch.nodes).forEach((pdNode) => {
        const nodeId = buildGraphNodeId(patch.id, pdNode.id);
        _buildNode(compilation, rootPatch, patch, pdNode, nodeId);
    });
};
const _buildNode = (compilation, rootPatch, patch, pdNode, nodeId) => {
    const nodeTypeResolution = resolveNodeType(compilation.nodeBuilders, pdNode.type);
    if (nodeTypeResolution === null) {
        throw new Error(`unknown node type ${pdNode.type}`);
    }
    const { nodeBuilder, nodeType } = nodeTypeResolution;
    if (nodeBuilder.isNoop === true) {
        return null;
    }
    if (!nodeBuilder.skipDollarArgsResolution) {
        pdNode = {
            ...pdNode,
            args: resolvePdNodeDollarArgs(rootPatch, pdNode.args),
        };
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
// ==================================  DSP GRAPH CONNECTIONS ================================== //
const _buildConnections = (compilation, rootPatchPath) => {
    const { graph } = compilation;
    let pdConnections = [];
    // 1. Get recursively through the patches and collect all pd connections
    // in one single array. In the process, we also resolve subpatch's portlets.
    _traversePatches(compilation, rootPatchPath, (compilation, patchPath) => {
        _resolveSubpatches(compilation, patchPath, pdConnections);
    });
    // 2. Convert connections from PdJson to DspGraph, and group them by source
    const groupedGraphConnections = _groupAndResolveGraphConnections(compilation, pdConnections);
    // 3. Finally, we iterate over the grouped sources and build the graph connections.
    Object.values(graph).forEach((node) => {
        Object.values(node.inlets).forEach((inlet) => {
            const graphSink = {
                nodeId: node.id,
                portletId: inlet.id,
            };
            const graphSources = (groupedGraphConnections[node.id]
                ? groupedGraphConnections[node.id][inlet.id]
                : undefined) || { signalSources: [], messageSources: [] };
            if (inlet.type === 'signal') {
                const { nodeBuilder: sinkNodeBuilder } = resolveNodeType(compilation.nodeBuilders, node.type);
                const messageToSignalConfig = sinkNodeBuilder.configureMessageToSignalConnection
                    ? sinkNodeBuilder.configureMessageToSignalConnection(graphSink.portletId, node.args)
                    : undefined;
                _buildConnectionToSignalSink(graph, graphSources.signalSources, graphSources.messageSources, graphSink, messageToSignalConfig);
            }
            else {
                if (graphSources.signalSources.length !== 0) {
                    throw new Error(`Unexpected signal connection to node id ${graphSink.nodeId}, inlet ${graphSink.portletId}`);
                }
                _buildConnectionToMessageSink(graph, graphSources.messageSources, graphSink);
            }
        });
    });
};
const _buildConnectionToMessageSink = (graph, sources, sink) => sources.forEach((source) => {
    connect(graph, source, sink);
});
/**
 * Build a graph connection. Add nodes that are implicit in Pd, and that we want explicitely
 * declared in our graph.
 *
 * Implicit Pd behavior made explicit by this compilation :
 * - Multiple DSP inputs mixed into one
 *
 * ```
 * [ signal1~ ]   [ signal2~ ]
 *           \      /
 *         [ _mixer~ ]
 *           |
 *         [ someNode~ ]
 *
 * ```
 *
 * - When messages to DSP input, automatically turned into a signal
 *
 * ```
 *    [ sig~ ]
 *      |
 *    [  someNode~ ]
 * ```
 *
 * - Re-route messages from signal inlet to a message inlet
 *
 * ```
 *    [ message1 ]
 *      |
 *    [ _routemsg ]     ( on the left inlet float messages, on the the right inlet, the rest. )
 *      |       \
 *    [ sig~ ]   |
 *      |        |
 *    [  someNode~ ]
 * ```
 *
 * - Initial value of DSP input
 *
 *
 */
const _buildConnectionToSignalSink = (graph, signalSources, messageSources, sink, messageToSignalConfig) => {
    let implicitSigNode = null;
    // 1. SIGNAL SOURCES
    // 1.1. if single signal source, we just put a normal connection
    if (signalSources.length === 1) {
        connect(graph, signalSources[0], sink);
        // 1.2. if several signal sources, we put a mixer node in between.
    }
    else if (signalSources.length > 1) {
        const mixerNodeArgs = {
            channelCount: signalSources.length,
        };
        const implicitMixerNode = addNode(graph, {
            id: buildImplicitGraphNodeId(sink, IMPLICIT_NODE_TYPES.MIXER),
            type: IMPLICIT_NODE_TYPES.MIXER,
            args: mixerNodeArgs,
            sources: {},
            sinks: {},
            ...builder$Q.build(mixerNodeArgs),
        });
        connect(graph, {
            nodeId: implicitMixerNode.id,
            portletId: '0',
        }, sink);
        signalSources.forEach((source, i) => {
            connect(graph, source, {
                nodeId: implicitMixerNode.id,
                portletId: buildGraphPortletId(i),
            });
        });
        // 1.3. if no signal source, we need to simulate one by plugging a sig node to the inlet
    }
    else {
        const sigNodeArgs = {
            initValue: messageToSignalConfig
                ? messageToSignalConfig.initialSignalValue
                : 0,
        };
        implicitSigNode = addNode(graph, {
            id: buildImplicitGraphNodeId(sink, IMPLICIT_NODE_TYPES.CONSTANT_SIGNAL),
            type: IMPLICIT_NODE_TYPES.CONSTANT_SIGNAL,
            args: sigNodeArgs,
            sources: {},
            sinks: {},
            ...builder$P.build(sigNodeArgs),
        });
        connect(graph, {
            nodeId: implicitSigNode.id,
            portletId: '0',
        }, sink);
    }
    // 2. MESSAGE SOURCES
    // If message sources, we split the incoming message flow in 2 using `_routemsg`.
    // - outlet 0 : float messages are proxied to the sig~ if present, so they set its value
    // - outlet 1 : other messages must be proxied to a different sink (cause here we are dealing
    // with a signal sink which can't accept messages).
    if (messageSources.length) {
        const routeMsgArgs = {};
        const implicitRouteMsgNode = addNode(graph, {
            id: buildImplicitGraphNodeId(sink, IMPLICIT_NODE_TYPES.ROUTE_MSG),
            type: IMPLICIT_NODE_TYPES.ROUTE_MSG,
            args: routeMsgArgs,
            sources: {},
            sinks: {},
            ...builder$O.build(routeMsgArgs),
        });
        let isMsgSortNodeConnected = false;
        if (implicitSigNode) {
            connect(graph, { nodeId: implicitRouteMsgNode.id, portletId: '0' }, { nodeId: implicitSigNode.id, portletId: '0' });
            isMsgSortNodeConnected = true;
        }
        if (messageToSignalConfig &&
            messageToSignalConfig.reroutedMessageInletId !== undefined) {
            connect(graph, { nodeId: implicitRouteMsgNode.id, portletId: '1' }, {
                nodeId: sink.nodeId,
                portletId: messageToSignalConfig.reroutedMessageInletId,
            });
            isMsgSortNodeConnected = true;
        }
        if (isMsgSortNodeConnected) {
            messageSources.forEach((graphMessageSource) => {
                connect(graph, graphMessageSource, {
                    nodeId: implicitRouteMsgNode.id,
                    portletId: '0',
                });
            });
        }
    }
};
/**
 * Take an array of global PdJson connections and :
 * - group them by sink
 * - convert them to graph connections
 * - split them into signal and message connections
 */
const _groupAndResolveGraphConnections = (compilation, pdConnections) => {
    const { graph } = compilation;
    const groupedGraphConnections = {};
    pdConnections.forEach((connection) => {
        const [_, pdGlobSink] = connection;
        // Resolve the graph sink corresponding with the connection,
        // if already handled, we move on.
        const [patchPath, pdSink] = pdGlobSink;
        const graphNodeId = buildGraphNodeId(_currentPatch(patchPath).id, pdSink.nodeId);
        groupedGraphConnections[graphNodeId] = groupedGraphConnections[graphNodeId] || {};
        const graphPortletId = buildGraphPortletId(pdSink.portletId);
        if (groupedGraphConnections[graphNodeId][graphPortletId]) {
            return;
        }
        // Collect all sources for `pdGlobSink`
        let pdGlobSources = [];
        pdConnections.forEach((connection) => {
            const [pdGlobSource, otherPdGlobSink] = connection;
            if (_arePdGlobEndpointsEqual(pdGlobSink, otherPdGlobSink)) {
                pdGlobSources.push(pdGlobSource);
            }
        });
        // For each source, resolve it to a graph source, and split between
        // signal and message sources.
        const graphSignalSources = [];
        const graphMessageSources = [];
        pdGlobSources.forEach(([sourcePatchPath, pdSource]) => {
            const sourcePatch = _currentPatch(sourcePatchPath);
            const graphSource = {
                nodeId: buildGraphNodeId(sourcePatch.id, pdSource.nodeId),
                portletId: buildGraphPortletId(pdSource.portletId),
            };
            const sourceNode = getNode(graph, graphSource.nodeId);
            const outlet = getOutlet(sourceNode, graphSource.portletId);
            if (outlet.type === 'signal') {
                graphSignalSources.push(graphSource);
            }
            else {
                graphMessageSources.push(graphSource);
            }
        });
        groupedGraphConnections[graphNodeId][graphPortletId] = {
            signalSources: graphSignalSources,
            messageSources: graphMessageSources,
        };
    });
    return groupedGraphConnections;
};
/**
 * Traverse the graph recursively and collect all connections in a flat list,
 * by navigating inside and outside subpatches through their portlets.
 */
const _resolveSubpatches = (compilation, patchPath, pdConnections) => {
    const { graph } = compilation;
    const patch = _currentPatch(patchPath);
    // First we remove connections for pd nodes that have been removed
    // from the graph.
    const connections = patch.connections.filter(({ source, sink }) => {
        const sourceNodeId = buildGraphNodeId(patch.id, source.nodeId);
        const sinkNodeId = buildGraphNodeId(patch.id, sink.nodeId);
        if (graph[sourceNodeId] && graph[sinkNodeId]) {
            return true;
        }
        return false;
    });
    connections.forEach(({ source, sink }) => {
        const resolvedSources = _resolveSource(compilation, [patchPath, source]);
        const resolvedSinks = _resolveSink(compilation, patchPath, sink);
        resolvedSources.forEach((pdGSource) => resolvedSinks.forEach((pdGSink) => {
            const alreadyExists = pdConnections.some(([otherPdGSource, otherPdGSink]) => {
                return (_arePdGlobEndpointsEqual(pdGSource, otherPdGSource) && _arePdGlobEndpointsEqual(pdGSink, otherPdGSink));
            });
            if (!alreadyExists) {
                pdConnections.push([pdGSource, pdGSink]);
            }
        }));
    });
};
const _resolveSource = (compilation, [patchPath, source]) => {
    const { pd } = compilation;
    const patch = _currentPatch(patchPath);
    const pdSourceNode = resolvePdNode(patch, source.nodeId);
    // 1. If inlet, we lookup in parent patch for the sources of the
    // corresponding inlets, then continue the resolution recursively.
    if (pdSourceNode.type === 'inlet' || pdSourceNode.type === 'inlet~') {
        const parentPatch = _parentPatch(patchPath);
        // When we load an abstraction as main patch, it will have
        // inlets / outlets which are not connected
        if (!parentPatch) {
            return [];
        }
        const subpatchNode = _resolveSubpatchNode(parentPatch, patch.id);
        const subpatchNodePortletId = _resolveSubpatchPortletId(patch.inlets, pdSourceNode.id);
        return parentPatch.connections
            .filter(({ sink }) => sink.nodeId === subpatchNode.id &&
            sink.portletId === subpatchNodePortletId)
            .flatMap(({ source }) => _resolveSource(compilation, [
            [...patchPath.slice(0, -1)],
            source,
        ]));
        // 2. If subpatch, we enter the subpatch and lookup for the
        // sources of the corresponding outlet, then continue the
        // resolution recursively.
    }
    else if (pdSourceNode.nodeClass === 'subpatch') {
        const subpatch = resolvePatch(pd, pdSourceNode.patchId);
        const outletPdNodeId = _resolveSubpatchPortletNode(subpatch.outlets, source.portletId);
        return subpatch.connections
            .filter(({ sink }) => sink.nodeId === outletPdNodeId && sink.portletId === 0)
            .flatMap(({ source }) => _resolveSource(compilation, [[...patchPath, subpatch], source]));
        // 3. This is the general case for all other nodes which are not
        // subpatch related.
    }
    else {
        return [[patchPath, source]];
    }
};
const _resolveSink = (compilation, patchPath, pdSink) => {
    const { pd } = compilation;
    const patch = _currentPatch(patchPath);
    const pdSinkNode = resolvePdNode(patch, pdSink.nodeId);
    // 1. If outlet, we lookup in parent patch for the sinks of the
    // corresponding outlets, then continue the resolution recursively.
    if (pdSinkNode.type === 'outlet' || pdSinkNode.type === 'outlet~') {
        const parentPatch = _parentPatch(patchPath);
        // When we load an abstraction as main patch, it will have
        // inlets / outlets which are not connected
        if (!parentPatch) {
            return [];
        }
        const subpatchNode = _resolveSubpatchNode(parentPatch, patch.id);
        const subpatchNodePortletId = _resolveSubpatchPortletId(patch.outlets, pdSinkNode.id);
        return parentPatch.connections
            .filter(({ source }) => source.nodeId === subpatchNode.id &&
            source.portletId === subpatchNodePortletId)
            .flatMap(({ sink }) => _resolveSink(compilation, [...patchPath.slice(0, -1)], sink));
        // 2. If subpatch, we enter the subpatch and lookup for the
        // sinks of the corresponding inlet, then continue the
        // resolution recursively.
    }
    else if (pdSinkNode.nodeClass === 'subpatch') {
        const subpatch = resolvePatch(pd, pdSinkNode.patchId);
        const inletPdNodeId = _resolveSubpatchPortletNode(subpatch.inlets, pdSink.portletId);
        return subpatch.connections
            .filter(({ source }) => source.nodeId === inletPdNodeId && source.portletId === 0)
            .flatMap(({ sink }) => _resolveSink(compilation, [...patchPath, subpatch], sink));
        // 3. This is the general case for all other nodes which are not
        // subpatch related.
    }
    else {
        return [[patchPath, pdSink]];
    }
};
// ================================== HELPERS ================================== //
const _traversePatches = (compilation, patchPath, func) => {
    const patch = _currentPatch(patchPath);
    func(compilation, patchPath);
    Object.values(patch.nodes).forEach((pdNode) => {
        if (pdNode.nodeClass === 'subpatch') {
            const subpatch = resolvePatch(compilation.pd, pdNode.patchId);
            _traversePatches(compilation, [...patchPath, subpatch], func);
        }
    });
};
const _currentPatch = (patchPath) => {
    const patch = patchPath.slice(-1)[0];
    if (!patch) {
        throw new Error(`patchPath empty !`);
    }
    return patch;
};
const _parentPatch = (patchPath) => {
    if (patchPath.length < 2) {
        return null;
    }
    return patchPath.slice(-2)[0];
};
const _rootPatch = (patchPath) => {
    const firstRootPatch = patchPath
        .slice(0)
        .reverse()
        .find((patch) => patch.isRoot);
    if (!firstRootPatch) {
        throw new Error(`Could not resolve root patch from path`);
    }
    return firstRootPatch;
};
const _resolveRootPatch = (pd) => {
    const rootPatch = pd.patches[pd.rootPatchId];
    if (!rootPatch) {
        throw new Error(`Could not resolve root patch`);
    }
    return rootPatch;
};
const _resolveSubpatchPortletNode = (portletNodeIds, portletId) => {
    const pdNodeId = portletNodeIds[portletId];
    if (pdNodeId === undefined) {
        throw new Error(`Portlet ${portletId} is undefined in patch.outlets/patch.inlets`);
    }
    return pdNodeId;
};
const _resolveSubpatchPortletId = (portletNodeIds, pdNodeId) => portletNodeIds.findIndex((portletId) => portletId === pdNodeId);
const _resolveSubpatchNode = (patch, patchId) => {
    const subpatchNode = Object.values(patch.nodes).find((pdNode) => pdNode.nodeClass === 'subpatch' && pdNode.patchId === patchId);
    if (subpatchNode === undefined) {
        throw new Error(`could not find subpatch node with patchId=${patchId} inside patch ${patch.id}`);
    }
    return subpatchNode;
};
const _arePdGlobEndpointsEqual = ([pp1, ep1], [pp2, ep2]) => _currentPatch(pp1).id === _currentPatch(pp2).id &&
    ep1.nodeId === ep2.nodeId &&
    ep1.portletId === ep2.portletId;

const EMPTY_BUS_NAME = 'empty';
const build = () => ({
    inlets: {
        '0': { type: 'message', id: '0' },
    },
    outlets: {
        '0': { type: 'message', id: '0' },
    },
    // This is always true, because the object can receive 
    // messages through message bus
    isPushingMessages: true
});
// TODO : move to global code
const controlsCoreVariableNames = generateVariableNamesNodeType('control', [
    'setReceiveBusName',
    'setSendReceiveFromMessage',
    'defaultMessageHandler',
]);
const controlsCore = () => Sequence$1([
    Class$1(controlsCoreVariableNames.stateClass, [
        Var$1('Float', 'minValue'),
        Var$1('Float', 'maxValue'),
        Var$1('Float', 'valueFloat'),
        Var$1('Message', 'value'),
        Var$1('string', 'receiveBusName'),
        Var$1('string', 'sendBusName'),
        Var$1('(m: Message) => void', 'messageReceiver'),
        Var$1('(m: Message) => void', 'messageSender'),
    ]),
    Func$1(controlsCoreVariableNames.setReceiveBusName, [
        Var$1(controlsCoreVariableNames.stateClass, 'state'),
        Var$1('string', 'busName'),
    ], 'void') `
        if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
            msgBusUnsubscribe(state.receiveBusName, state.messageReceiver)
        }
        state.receiveBusName = busName
        if (state.receiveBusName !== "${EMPTY_BUS_NAME}") {
            msgBusSubscribe(state.receiveBusName, state.messageReceiver)
        }
    `,
    Func$1(controlsCoreVariableNames.setSendReceiveFromMessage, [
        Var$1(controlsCoreVariableNames.stateClass, 'state'),
        Var$1('Message', 'm'),
    ], 'boolean') `
        if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'receive'
        ) {
            ${controlsCoreVariableNames.setReceiveBusName}(state, msg_readStringToken(m, 1))
            return true

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'send'
        ) {
            state.sendBusName = msg_readStringToken(m, 1)
            return true
        }
        return false
    `,
    Func$1(controlsCoreVariableNames.defaultMessageHandler, [Var$1('Message', 'm')], 'void') ``,
]);

// TODO : unit tests
const signalBuses = () => Sequence$1([
    ConstVar$1('Map<string, Float>', 'SIGNAL_BUSES', 'new Map()'),
    `SIGNAL_BUSES.set('', 0)`,
    Func$1('addAssignSignalBus', [
        Var$1('string', 'busName'),
        Var$1('Float', 'value')
    ], 'Float') `
            ${ConstVar$1('Float', 'newValue', 'SIGNAL_BUSES.get(busName) + value')}
            SIGNAL_BUSES.set(
                busName,
                newValue,
            )
            return newValue
        `,
    Func$1('setSignalBus', [
        Var$1('string', 'busName'),
        Var$1('Float', 'value'),
    ], 'void') `
            SIGNAL_BUSES.set(
                busName,
                value,
            )
        `,
    Func$1('resetSignalBus', [
        Var$1('string', 'busName')
    ], 'void') `
            SIGNAL_BUSES.set(busName, 0)
        `,
    Func$1('readSignalBus', [Var$1('string', 'busName')], 'Float') `
            return SIGNAL_BUSES.get(busName)
        `
]);
// TODO : unit tests
const messageBuses = {
    codeGenerator: () => Sequence$1([
        ConstVar$1('Map<string, Array<(m: Message) => void>>', 'MSG_BUSES', 'new Map()'),
        Func$1('msgBusPublish', [Var$1('string', 'busName'), Var$1('Message', 'message')], 'void') `
            ${Var$1('Int', 'i', '0')}
            ${ConstVar$1('Array<(m: Message) => void>', 'callbacks', 'MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []')}
            for (i = 0; i < callbacks.length; i++) {
                callbacks[i](message)
            }
        `,
        Func$1('msgBusSubscribe', [Var$1('string', 'busName'), Var$1('(m: Message) => void', 'callback')], 'void') `
            if (!MSG_BUSES.has(busName)) {
                MSG_BUSES.set(busName, [])
            }
            MSG_BUSES.get(busName).push(callback)
        `,
        Func$1('msgBusUnsubscribe', [Var$1('string', 'busName'), Var$1('(m: Message) => void', 'callback')], 'void') `
            if (!MSG_BUSES.has(busName)) {
                return
            }
            ${ConstVar$1('Array<(m: Message) => void>', 'callbacks', 'MSG_BUSES.get(busName)')}
            ${ConstVar$1('Int', 'found', 'callbacks.indexOf(callback) !== -1')}
            if (found !== -1) {
                callbacks.splice(found, 1)
            }
        `
    ]),
    dependencies: [msg$1],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const bangUtils = {
    codeGenerator: () => Sequence$1([
        Func$1('msg_isBang', [Var$1('Message', 'message')], 'boolean') `
            return (
                msg_isStringToken(message, 0) 
                && msg_readStringToken(message, 0) === 'bang'
            )
        `,
        Func$1('msg_bang', [], 'Message') `
            ${ConstVar$1('Message', 'message', 'msg_create([MSG_STRING_TOKEN, 4])')}
            msg_writeStringToken(message, 0, 'bang')
            return message
        `,
        Func$1('msg_emptyToBang', [Var$1('Message', 'message')], 'Message') `
            if (msg_getLength(message) === 0) {
                return msg_bang()
            } else {
                return message
            }
        `,
    ]),
    dependencies: [msg$1],
};
const msgUtils = {
    codeGenerator: () => Sequence$1([
        Func$1('msg_copyTemplate', [Var$1('Message', 'src'), Var$1('Int', 'start'), Var$1('Int', 'end')], 'MessageTemplate') `
            ${ConstVar$1('MessageTemplate', 'template', '[]')}
            for (${Var$1('Int', 'i', 'start')}; i < end; i++) {
                ${ConstVar$1('Int', 'tokenType', 'msg_getTokenType(src, i)')}
                template.push(tokenType)
                if (tokenType === MSG_STRING_TOKEN) {
                    template.push(msg_readStringToken(src, i).length)
                }
            }
            return template
        `,
        Func$1('msg_copyMessage', [
            Var$1('Message', 'src'),
            Var$1('Message', 'dest'),
            Var$1('Int', 'srcStart'),
            Var$1('Int', 'srcEnd'),
            Var$1('Int', 'destStart'),
        ], 'void') `
            ${Var$1('Int', 'i', 'srcStart')}
            ${Var$1('Int', 'j', 'destStart')}
            for (i, j; i < srcEnd; i++, j++) {
                if (msg_getTokenType(src, i) === MSG_STRING_TOKEN) {
                    msg_writeStringToken(dest, j, msg_readStringToken(src, i))
                } else {
                    msg_writeFloatToken(dest, j, msg_readFloatToken(src, i))
                }
            }
        `,
        Func$1('msg_slice', [Var$1('Message', 'message'), Var$1('Int', 'start'), Var$1('Int', 'end')], 'Message') `
            if (msg_getLength(message) <= start) {
                throw new Error('message empty')
            }
            ${ConstVar$1('MessageTemplate', 'template', 'msg_copyTemplate(message, start, end)')}
            ${ConstVar$1('Message', 'newMessage', 'msg_create(template)')}
            msg_copyMessage(message, newMessage, start, end, 0)
            return newMessage
        `,
        Func$1('msg_concat', [Var$1('Message', 'message1'), Var$1('Message', 'message2')], 'Message') `
            ${ConstVar$1('Message', 'newMessage', 'msg_create(msg_copyTemplate(message1, 0, msg_getLength(message1)).concat(msg_copyTemplate(message2, 0, msg_getLength(message2))))')}
            msg_copyMessage(message1, newMessage, 0, msg_getLength(message1), 0)
            msg_copyMessage(message2, newMessage, 0, msg_getLength(message2), msg_getLength(message1))
            return newMessage
        `,
        Func$1('msg_shift', [Var$1('Message', 'message')], 'Message') `
            switch (msg_getLength(message)) {
                case 0:
                    throw new Error('message empty')
                case 1:
                    return msg_create([])
                default:
                    return msg_slice(message, 1, msg_getLength(message))
            }
        `
    ]),
    dependencies: [msg$1],
};
const stringMsgUtils = {
    codeGenerator: () => Sequence$1([
        Func$1('msg_isAction', [Var$1('Message', 'message'), Var$1('string', 'action')], 'boolean') `
            return msg_isMatching(message, [MSG_STRING_TOKEN])
                && msg_readStringToken(message, 0) === action
        `
    ]),
    dependencies: [msg$1],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builderWithInit = {
    translateArgs: ({ args: [minValue, maxValue, init, initValue, receive, send], }) => ({
        minValue: assertNumber(minValue),
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
};
const builderWithoutMin = {
    translateArgs: ({ args: [maxValue, init, initValue, receive, send], }) => ({
        minValue: 0,
        maxValue: assertNumber(maxValue),
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
        initValue: init === 1 ? assertNumber(initValue) : 0,
        outputOnLoad: !!init,
    }),
    build,
};
// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation$8 = ({ prepareStoreValue, prepareStoreValueBang, name }) => {
    const variableNames = generateVariableNamesNodeType(name, ['receiveMessage']);
    return {
        initialization: ({ state, snds, node: { args }, }) => 
        // There is a circular dependency problem between the state and snds.$0 so we can actually
        // only use snds.$0 inside the callback of `commons_waitEngineConfigure`.
        ast$1 `
                ${ConstVar$1(controlsCoreVariableNames.stateClass, state, ast$1 `{
                    minValue: ${args.minValue},
                    maxValue: ${args.maxValue},
                    valueFloat: ${args.initValue},
                    value: msg_create([]),
                    receiveBusName: "${args.receiveBusName}",
                    sendBusName: "${args.sendBusName}",
                    messageReceiver: ${controlsCoreVariableNames.defaultMessageHandler},
                    messageSender: ${controlsCoreVariableNames.defaultMessageHandler},
                }`)}
    
                commons_waitEngineConfigure(() => {
                    ${state}.messageReceiver = ${AnonFunc$1([Var$1('Message', 'm')]) `
                        ${variableNames.receiveMessage}(${state}, m)
                    `}
                    ${state}.messageSender = ${snds.$0}
                    ${controlsCoreVariableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
                })
    
                ${args.outputOnLoad ?
            `commons_waitFrame(0, () => ${snds.$0}(msg_floats([${state}.valueFloat])))` : null}
            `,
        messageReceivers: ({ state, }) => ({
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                ${variableNames.receiveMessage}(${state}, m)
                return
            `
        }),
        dependencies: [
            bangUtils,
            messageBuses,
            commonsWaitEngineConfigure,
            commonsWaitFrame,
            controlsCore,
            () => Sequence$1([
                Func$1(variableNames.receiveMessage, [
                    Var$1(controlsCoreVariableNames.stateClass, 'state'),
                    Var$1('Message', 'm'),
                ], 'void') `
                    if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                        ${prepareStoreValue ?
                    `state.valueFloat = ${prepareStoreValue(`msg_readFloatToken(m, 0)`)}`
                    : `state.valueFloat = msg_readFloatToken(m, 0)`}
                        ${ConstVar$1('Message', 'outMessage', `msg_floats([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (msg_isBang(m)) {
                        ${prepareStoreValueBang ?
                    `state.valueFloat = ${prepareStoreValueBang(`state.valueFloat`)}`
                    : null}
                        ${ConstVar$1('Message', 'outMessage', `msg_floats([state.valueFloat])`)}
                        state.messageSender(outMessage)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, outMessage)
                        }
                        return
        
                    } else if (
                        msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                        && msg_readStringToken(m, 0) === 'set'
                    ) {
                        ${prepareStoreValue ?
                    `state.valueFloat = ${prepareStoreValue(`msg_readFloatToken(m, 1)`)}`
                    : `state.valueFloat = msg_readFloatToken(m, 1)`}
                        return
                    
                    } else if (${controlsCoreVariableNames.setSendReceiveFromMessage}(state, m) === true) {
                        return
                    }
                `
            ]),
        ],
    };
};
// ------------------------------------------------------------------- //
const nodeImplementations$e = {
    'tgl': makeNodeImplementation$8({
        name: 'tgl',
        prepareStoreValueBang: (valueCode) => `${valueCode} === 0 ? state.maxValue: 0`
    }),
    'nbx': makeNodeImplementation$8({
        name: 'nbx',
        prepareStoreValue: (valueCode) => `Math.min(Math.max(${valueCode},state.minValue),state.maxValue)`
    }),
    'hsl': makeNodeImplementation$8({ name: 'sl' }),
    'hradio': makeNodeImplementation$8({ name: 'radio' }),
};
nodeImplementations$e['vsl'] = nodeImplementations$e['hsl'];
nodeImplementations$e['vradio'] = nodeImplementations$e['hradio'];
const builders$e = {
    'tgl': builderWithoutMin,
    'nbx': builderWithInit,
    'hsl': builderWithInit,
    'vsl': builderWithInit,
    'hradio': builderWithoutMin,
    'vradio': builderWithoutMin,
};

const FLOAT_CONTROL_TYPES = [...Object.keys(builders$e), 'floatatom'];
const collectIoMessageReceiversFromSendNodes = (pdJson, graph) => {
    const rootPatch = pdJson.patches[pdJson.rootPatchId];
    const messageReceivers = {};
    Object.values(rootPatch.nodes).forEach((pdNode) => {
        const nodeId = buildGraphNodeId(rootPatch.id, pdNode.id);
        const node = graph[nodeId];
        if (pdNode.type === 'send' &&
            // Important because some nodes are deleted at dsp-graph compilation.
            // and if we declare messageReceivers for them it will cause error.
            // TODO : maybe the compiler should detect this instead of doing it here ?
            !!node) {
            if (!messageReceivers[nodeId]) {
                const layout = pdNode.layout || {};
                const metadata = {
                    group: 'send',
                    name: node.args.busName,
                    position: layout.x !== undefined && layout.y !== undefined
                        ? [layout.x, layout.y]
                        : undefined,
                };
                messageReceivers[nodeId] = {
                    portletIds: [],
                    metadata: metadata,
                };
            }
            messageReceivers[nodeId].portletIds.push('0');
        }
    });
    return messageReceivers;
};
const collectIoMessageReceiversFromGui = (controls, graph) => {
    const messageReceivers = {};
    traverseGuiControls(controls, (control) => {
        const portletId = '0';
        const nodeId = buildGraphNodeId(control.patch.id, control.node.id);
        if (!messageReceivers[nodeId]) {
            const node = graph[nodeId];
            // Important because some nodes are deleted at dsp-graph compilation.
            // and if we declare messageReceivers for them it will cause error.
            // TODO : maybe the compiler should detect this instead of doing it here ?
            if (!node) {
                return;
            }
            const layout = control.node.layout || {};
            let metadata = {
                group: 'control',
                type: control.node.type,
                label: layout.label,
                position: layout.x !== undefined && layout.y !== undefined
                    ? [layout.x, layout.y]
                    : undefined,
            };
            if (FLOAT_CONTROL_TYPES.includes(control.node.type)) {
                metadata = {
                    ...metadata,
                    group: 'control:float',
                    initValue: node.args.initValue,
                    minValue: node.args.minValue,
                    maxValue: node.args.maxValue,
                };
            }
            messageReceivers[nodeId] = {
                portletIds: [],
                metadata: metadata,
            };
        }
        messageReceivers[nodeId].portletIds.push(portletId);
    });
    return messageReceivers;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// NOTE : not necessarily the most logical place to put this function, but we need it here
// cause it's imported by the bindings.
const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;
/** Helper to create a Module by wrapping a RawModule with Bindings */
const createModule = (rawModule, bindings) => 
// Use empty object on proxy cause proxy cannot redefine access of member of its target,
// which causes issues for example for WebAssembly exports.
// See : https://stackoverflow.com/questions/75148897/get-on-proxy-property-items-is-a-read-only-and-non-configurable-data-proper
new Proxy({}, {
    get: (_, k) => {
        if (bindings.hasOwnProperty(k)) {
            const key = String(k);
            const bindingSpec = bindings[key];
            switch (bindingSpec.type) {
                case 'raw':
                    // Cannot use hasOwnProperty here cause not defined in wasm exports object
                    if (k in rawModule) {
                        return rawModule[key];
                    }
                    else {
                        throw new Error(`Key ${String(key)} doesn't exist in raw module`);
                    }
                case 'proxy':
                case 'callback':
                    return bindingSpec.value;
            }
            // We need to return undefined here for compatibility with various APIs
            // which inspect object's attributes.
        }
        else {
            return undefined;
        }
    },
    set: (_, k, newValue) => {
        if (bindings.hasOwnProperty(String(k))) {
            const key = String(k);
            const bindingSpec = bindings[key];
            if (bindingSpec.type === 'callback') {
                bindingSpec.value = newValue;
            }
            else {
                throw new Error(`Binding key ${String(key)} is read-only`);
            }
        }
        else {
            throw new Error(`Key ${String(k)} is not defined in bindings`);
        }
        return true;
    },
});

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/** @copyright Assemblyscript ESM bindings */
const liftString = (wasmExports, pointer) => {
    if (!pointer)
        return null;
    pointer = pointer >>> 0;
    const end = (pointer +
        new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>
        1;
    const memoryU16 = new Uint16Array(wasmExports.memory.buffer);
    let start = pointer >>> 1;
    let string = '';
    while (end - start > 1024) {
        string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));
    }
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
};
/** @copyright Assemblyscript ESM bindings */
const lowerString = (wasmExports, value) => {
    if (value == null)
        return 0;
    const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);
    for (let i = 0; i < length; ++i)
        memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);
    return pointer;
};
/**
 * @returns A typed array which shares buffer with the wasm module,
 * thus allowing direct read / write between the module and the host environment.
 *
 * @copyright Assemblyscript ESM bindings `liftTypedArray`
 */
const readTypedArray = (wasmExports, constructor, pointer) => {
    if (!pointer)
        return null;
    const memoryU32 = new Uint32Array(wasmExports.memory.buffer);
    return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);
};
/** @param bitDepth : Must be the same value as what was used to compile the engine. */
const lowerFloatArray = (wasmExports, bitDepth, data) => {
    const arrayType = getFloatArrayType(bitDepth);
    const arrayPointer = wasmExports.createFloatArray(data.length);
    const array = readTypedArray(wasmExports, arrayType, arrayPointer);
    array.set(data);
    return { array, arrayPointer };
};
/** @param bitDepth : Must be the same value as what was used to compile the engine. */
const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {
    const arraysPointer = wasmExports.x_core_createListOfArrays();
    data.forEach((array) => {
        const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);
        wasmExports.x_core_pushToListOfArrays(arraysPointer, arrayPointer);
    });
    return arraysPointer;
};
/** @param bitDepth : Must be the same value as what was used to compile the engine. */
const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {
    const listLength = wasmExports.x_core_getListOfArraysLength(listOfArraysPointer);
    const arrays = [];
    const arrayType = getFloatArrayType(bitDepth);
    for (let i = 0; i < listLength; i++) {
        const arrayPointer = wasmExports.x_core_getListOfArraysElem(listOfArraysPointer, i);
        arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));
    }
    return arrays;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const liftMessage = (wasmExports, messagePointer) => {
    const messageTokenTypesPointer = wasmExports.x_msg_getTokenTypes(messagePointer);
    const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);
    const message = [];
    messageTokenTypes.forEach((tokenType, tokenIndex) => {
        if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {
            message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));
        }
        else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {
            const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);
            message.push(liftString(wasmExports, stringPointer));
        }
    });
    return message;
};
const lowerMessage = (wasmExports, message) => {
    const template = message.reduce((template, value) => {
        if (typeof value === 'number') {
            template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());
        }
        else if (typeof value === 'string') {
            template.push(wasmExports.MSG_STRING_TOKEN.valueOf());
            template.push(value.length);
        }
        else {
            throw new Error(`invalid message value ${value}`);
        }
        return template;
    }, []);
    // Here we should ideally pass an array of Int, but I am not sure how
    // to lower a typed array in a generic manner, so using the available bindings from `commons`.
    const templateArrayPointer = wasmExports.x_msg_createTemplate(template.length);
    const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);
    loweredTemplateArray.set(template);
    const messagePointer = wasmExports.x_msg_create(templateArrayPointer);
    message.forEach((value, index) => {
        if (typeof value === 'number') {
            wasmExports.msg_writeFloatToken(messagePointer, index, value);
        }
        else if (typeof value === 'string') {
            const stringPointer = lowerString(wasmExports, value);
            wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);
        }
    });
    return messagePointer;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// REF : Assemblyscript ESM bindings
const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {
    const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {
        env: {
            abort: (messagePointer, 
            // filename, not useful because we compile everything to a single string
            _, lineNumber, columnNumber) => {
                const message = liftString(wasmExports, messagePointer);
                lineNumber = lineNumber;
                columnNumber = columnNumber;
                (() => {
                    // @external.js
                    throw Error(`${message} at ${lineNumber}:${columnNumber}`);
                })();
            },
            seed: () => {
                return (() => {
                    return Date.now() * Math.random();
                })();
            },
            'console.log': (textPointer) => {
                console.log(liftString(wasmExports, textPointer));
            },
        },
        ...wasmImports,
    });
    const wasmExports = instanceAndModule.instance
        .exports;
    return instanceAndModule.instance;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// This must be called again when doing something on the wasm module
// which could cause memory grow (lowerString, lowerMessage,
//      lowerBuffer, lowerMessage) :
// https://github.com/emscripten-core/emscripten/issues/6747
const updateWasmInOuts = (rawModule, engineData) => {
    engineData.wasmOutput = readTypedArray(rawModule, engineData.arrayType, rawModule.getOutput());
    engineData.wasmInput = readTypedArray(rawModule, engineData.arrayType, rawModule.getInput());
};
const createEngineLifecycleBindings = (rawModule, engineData) => {
    return {
        configure: {
            type: 'proxy',
            value: (sampleRate, blockSize) => {
                engineData.metadata.audioSettings.blockSize = blockSize;
                engineData.metadata.audioSettings.sampleRate = sampleRate;
                engineData.blockSize = blockSize;
                rawModule.configure(sampleRate, blockSize);
                updateWasmInOuts(rawModule, engineData);
            },
        },
        loop: {
            type: 'proxy',
            value: (input, output) => {
                for (let channel = 0; channel < input.length; channel++) {
                    engineData.wasmInput.set(input[channel], channel * engineData.blockSize);
                }
                updateWasmInOuts(rawModule, engineData);
                rawModule.loop();
                updateWasmInOuts(rawModule, engineData);
                for (let channel = 0; channel < output.length; channel++) {
                    output[channel].set(engineData.wasmOutput.subarray(engineData.blockSize * channel, engineData.blockSize * (channel + 1)));
                }
            },
        },
    };
};
const createIoMessageReceiversBindings = (rawModule, engineData) => mapObject(engineData.metadata.compilation.io.messageReceivers, (spec, nodeId) => ({
    type: 'proxy',
    value: mapArray(spec.portletIds, (inletId) => [
        inletId,
        (message) => {
            const messagePointer = lowerMessage(rawModule, message);
            rawModule[engineData.metadata.compilation.variableNamesIndex.io
                .messageReceivers[nodeId][inletId]](messagePointer);
        },
    ]),
}));
const createIoMessageSendersBindings = (_, engineData) => mapObject(engineData.metadata.compilation.io.messageSenders, (spec) => ({
    type: 'proxy',
    value: mapArray(spec.portletIds, (outletId) => [
        outletId,
        {
            onMessage: () => undefined,
        },
    ]),
}));
const ioMsgSendersImports = (forwardReferences, metadata) => {
    const wasmImports = {};
    const { variableNamesIndex } = metadata.compilation;
    Object.entries(metadata.compilation.io.messageSenders).forEach(([nodeId, spec]) => {
        spec.portletIds.forEach((outletId) => {
            const listenerName = variableNamesIndex.io.messageSenders[nodeId][outletId];
            wasmImports[listenerName] = (messagePointer) => {
                const message = liftMessage(forwardReferences.rawModule, messagePointer);
                forwardReferences.modules.io.messageSenders[nodeId][outletId].onMessage(message);
            };
        });
    });
    return wasmImports;
};
const readMetadata = async (wasmBuffer) => {
    // In order to read metadata, we need to introspect the module to get the imports
    const inputImports = {};
    const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));
    // Then we generate dummy functions to be able to instantiate the module
    wasmModule
        .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')
        .forEach((imprt) => (inputImports[imprt.name] = () => undefined));
    const wasmInstance = await instantiateWasmModule(wasmBuffer, {
        input: inputImports,
    });
    // Finally, once the module instantiated, we read the metadata
    const wasmExports = wasmInstance.exports;
    const stringPointer = wasmExports.metadata.valueOf();
    const metadataJSON = liftString(wasmExports, stringPointer);
    return JSON.parse(metadataJSON);
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const createFsBindings = (rawModule, engineData) => ({
    sendReadSoundFileResponse: {
        type: 'proxy',
        value: (operationId, status, sound) => {
            let soundPointer = 0;
            if (sound) {
                soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);
            }
            rawModule.x_fs_onReadSoundFileResponse(operationId, status, soundPointer);
            updateWasmInOuts(rawModule, engineData);
        },
    },
    sendWriteSoundFileResponse: {
        type: 'proxy',
        value: rawModule.x_fs_onWriteSoundFileResponse,
    },
    sendSoundStreamData: {
        type: 'proxy',
        value: (operationId, sound) => {
            const soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);
            const writtenFrameCount = rawModule.x_fs_onSoundStreamData(operationId, soundPointer);
            updateWasmInOuts(rawModule, engineData);
            return writtenFrameCount;
        },
    },
    closeSoundStream: {
        type: 'proxy',
        value: rawModule.x_fs_onCloseSoundStream,
    },
    onReadSoundFile: { type: 'callback', value: () => undefined },
    onWriteSoundFile: { type: 'callback', value: () => undefined },
    onOpenSoundReadStream: { type: 'callback', value: () => undefined },
    onOpenSoundWriteStream: { type: 'callback', value: () => undefined },
    onSoundStreamData: { type: 'callback', value: () => undefined },
    onCloseSoundStream: { type: 'callback', value: () => undefined },
});
const createFsImports = (forwardReferences) => {
    let wasmImports = {
        i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {
            const url = liftString(forwardReferences.rawModule, urlPointer);
            const info = liftMessage(forwardReferences.rawModule, infoPointer);
            forwardReferences.modules.fs.onReadSoundFile(operationId, url, info);
        },
        i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {
            const sound = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, soundPointer);
            const url = liftString(forwardReferences.rawModule, urlPointer);
            const info = liftMessage(forwardReferences.rawModule, infoPointer);
            forwardReferences.modules.fs.onWriteSoundFile(operationId, sound, url, info);
        },
        i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {
            const url = liftString(forwardReferences.rawModule, urlPointer);
            const info = liftMessage(forwardReferences.rawModule, infoPointer);
            // Called here because this call means that some sound buffers were allocated
            // inside the wasm module.
            updateWasmInOuts(forwardReferences.rawModule, forwardReferences.engineData);
            forwardReferences.modules.fs.onOpenSoundReadStream(operationId, url, info);
        },
        i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {
            const url = liftString(forwardReferences.rawModule, urlPointer);
            const info = liftMessage(forwardReferences.rawModule, infoPointer);
            forwardReferences.modules.fs.onOpenSoundWriteStream(operationId, url, info);
        },
        i_fs_sendSoundStreamData: (operationId, blockPointer) => {
            const block = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, blockPointer);
            forwardReferences.modules.fs.onSoundStreamData(operationId, block);
        },
        i_fs_closeSoundStream: (...args) => forwardReferences.modules.fs.onCloseSoundStream(...args),
    };
    return wasmImports;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const createCommonsBindings = (rawModule, engineData) => ({
    getArray: {
        type: 'proxy',
        value: (arrayName) => {
            const arrayNamePointer = lowerString(rawModule, arrayName);
            const arrayPointer = rawModule.commons_getArray(arrayNamePointer);
            return readTypedArray(rawModule, engineData.arrayType, arrayPointer);
        },
    },
    setArray: {
        type: 'proxy',
        value: (arrayName, array) => {
            const stringPointer = lowerString(rawModule, arrayName);
            const { arrayPointer } = lowerFloatArray(rawModule, engineData.bitDepth, array);
            rawModule.commons_setArray(stringPointer, arrayPointer);
            updateWasmInOuts(rawModule, engineData);
        },
    },
});

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const createEngine$2 = async (wasmBuffer) => {
    const { rawModule, engineData, forwardReferences } = await createRawModule$1(wasmBuffer);
    const engineBindings = await createBindings$1(rawModule, engineData, forwardReferences);
    return createModule(rawModule, engineBindings);
};
const createRawModule$1 = async (wasmBuffer) => {
    // We need to read metadata before everything, because it is used by other initialization functions
    const metadata = await readMetadata(wasmBuffer);
    const forwardReferences = { modules: {} };
    const wasmImports = {
        ...createFsImports(forwardReferences),
        ...ioMsgSendersImports(forwardReferences, metadata),
    };
    const bitDepth = metadata.audioSettings.bitDepth;
    const arrayType = getFloatArrayType(bitDepth);
    const engineData = {
        metadata,
        wasmOutput: new arrayType(0),
        wasmInput: new arrayType(0),
        arrayType,
        bitDepth,
        blockSize: 0,
    };
    const wasmInstance = await instantiateWasmModule(wasmBuffer, {
        input: wasmImports,
    });
    const rawModule = wasmInstance.exports;
    return { rawModule, engineData, forwardReferences };
};
const createBindings$1 = async (rawModule, engineData, forwardReferences) => {
    // Create bindings for core modules
    const commons = createModule(rawModule, createCommonsBindings(rawModule, engineData));
    const fs = createModule(rawModule, createFsBindings(rawModule, engineData));
    const io = {
        messageReceivers: createModule(rawModule, createIoMessageReceiversBindings(rawModule, engineData)),
        messageSenders: createModule(rawModule, createIoMessageSendersBindings(rawModule, engineData)),
    };
    // Update forward refs for use in Wasm imports
    forwardReferences.modules.fs = fs;
    forwardReferences.modules.io = io;
    forwardReferences.engineData = engineData;
    forwardReferences.rawModule = rawModule;
    // Build the full module
    return {
        ...createEngineLifecycleBindings(rawModule, engineData),
        metadata: { type: 'proxy', value: engineData.metadata },
        commons: { type: 'proxy', value: commons },
        fs: { type: 'proxy', value: fs },
        io: { type: 'proxy', value: io },
    };
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const createRawModule = (code) => new Function(`
        ${code}
        return exports
    `)();
const createBindings = (rawModule) => ({
    fs: { type: 'proxy', value: createFsModule(rawModule) },
    metadata: { type: 'raw' },
    configure: { type: 'raw' },
    loop: { type: 'raw' },
    io: { type: 'raw' },
    commons: {
        type: 'proxy',
        value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),
    },
});
const createEngine$1 = (code) => {
    const rawModule = createRawModule(code);
    return createModule(rawModule, createBindings(rawModule));
};
const createFsModule = (rawModule) => {
    const fs = createModule(rawModule, {
        onReadSoundFile: { type: 'callback', value: () => undefined },
        onWriteSoundFile: { type: 'callback', value: () => undefined },
        onOpenSoundReadStream: { type: 'callback', value: () => undefined },
        onOpenSoundWriteStream: { type: 'callback', value: () => undefined },
        onSoundStreamData: { type: 'callback', value: () => undefined },
        onCloseSoundStream: { type: 'callback', value: () => undefined },
        sendReadSoundFileResponse: {
            type: 'proxy',
            value: rawModule.x_fs_onReadSoundFileResponse,
        },
        sendWriteSoundFileResponse: {
            type: 'proxy',
            value: rawModule.x_fs_onWriteSoundFileResponse,
        },
        sendSoundStreamData: {
            type: 'proxy',
            value: rawModule.x_fs_onSoundStreamData,
        },
        closeSoundStream: {
            type: 'proxy',
            value: rawModule.x_fs_onCloseSoundStream,
        },
    });
    rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);
    rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);
    rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);
    rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);
    rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);
    rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);
    return fs;
};
const createCommonsModule = (rawModule, bitDepth) => {
    const floatArrayType = getFloatArrayType(bitDepth);
    return createModule(rawModule, {
        getArray: { type: 'proxy', value: rawModule.commons_getArray },
        setArray: {
            type: 'proxy',
            value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),
        },
    });
};

/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 * Copyright (c) 2017 Brett Zamir, 2012 Niklas von Hertzen
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode a byte buffer as a base64 string.
 * @param {!Uint8Array} bytes The buffer.
 * @return {string} A .wav file as a DataURI.
 */
function encode$3(bytes) {
  /** @type {string} */
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[(bytes[i] & 3) << 4 | bytes[i + 1] >> 4];
    base64 += chars[(bytes[i + 1] & 15) << 2 | bytes[i + 2] >> 6];
    base64 += chars[bytes[i + 2] & 63];
  }
  if (bytes.length % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1) + '=';
  } else if (bytes.length % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2) + '==';
  }
  return base64;
}

/**
 * Decode a base64 string as a byte as buffer.
 * @param {string} base64 A .wav file as a DataURI.
 * @return {!Uint8Array} A .wav file as a DataURI.
 */
function decode$3(base64) {
  /** @type {!Uint8Array} */
  let lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  /** @type {number} */
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }
  /** @type {!Uint8Array} */
  let bytes = new Uint8Array(bufferLength);
  for (let i = 0, j = 0; i < base64.length; i += 4) {
    /** @type {number} */
    let encoded1 = lookup[base64.charCodeAt(i)];
    /** @type {number} */
    let encoded2 = lookup[base64.charCodeAt(i + 1)];
    /** @type {number} */
    let encoded3 = lookup[base64.charCodeAt(i + 2)];
    /** @type {number} */
    let encoded4 = lookup[base64.charCodeAt(i + 3)];
    bytes[j++] = encoded1 << 2 | encoded2 >> 4;
    bytes[j++] = (encoded2 & 15) << 4 | encoded3 >> 2;
    bytes[j++] = (encoded3 & 3) << 6 | encoded4 & 63;
  }
  return bytes;
}

/*
 * Copyright (c) 2017-2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview A module to change the bit depth of PCM samples.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/rochars/bitdepth
 */

/**
 * Change the bit depth of PCM samples.
 * @param {!Array|!TypedArray} samples The original samples.
 * @param {string} bithDepth The original bit depth.
 * @param {!TypedArray} newSamples The output array.
 * @param {string} targetBitDepth The target bit depth.
 * @throws {Error} If original or target bit depths are not valid.
 */
function changeBitDepth(samples, bithDepth, newSamples, targetBitDepth) {
  // float to float, just copy the values
  if (["32f","64"].indexOf(bithDepth) > -1 &&
    ["32f","64"].indexOf(targetBitDepth) > -1) {
    newSamples.set(samples);
    return;
  }
  validateBitDepth_(bithDepth);
  validateBitDepth_(targetBitDepth);
  /** @type {!Function} */
  let toFunction = getBitDepthFunction_(bithDepth, targetBitDepth);
  /** @type {!Object<string, number>} */
  let options = {
    oldMin: Math.pow(2, parseInt(bithDepth, 10)) / 2,
    newMin: Math.pow(2, parseInt(targetBitDepth, 10)) / 2,
    oldMax: (Math.pow(2, parseInt(bithDepth, 10)) / 2) - 1,
    newMax: (Math.pow(2, parseInt(targetBitDepth, 10)) / 2) - 1,
  };
  // sign the samples if original is 8-bit
  sign8Bit_(bithDepth, samples, true);
  // change the resolution of the samples
  for (let i = 0, len = samples.length; i < len; i++) {        
    newSamples[i] = toFunction(samples[i], options);
  }
  // unsign the samples if target is 8-bit
  sign8Bit_(targetBitDepth, newSamples, false);
}

/**
 * Change the bit depth from int to int.
 * @param {number} sample The sample.
 * @param {!Object<string, number>} args Data about the bit depths.
 * @return {number}
 * @private
 */
function intToInt_(sample, args) {
  if (sample > 0) {
    sample = parseInt((sample / args.oldMax) * args.newMax, 10);
  } else {
    sample = parseInt((sample / args.oldMin) * args.newMin, 10);
  }
  return sample;
}

/**
 * Change the bit depth from float to int.
 * @param {number} sample The sample.
 * @param {!Object<string, number>} args Data about the bit depths.
 * @return {number}
 * @private
 */
function floatToInt_(sample, args) {
  return parseInt(
    sample > 0 ? sample * args.newMax : sample * args.newMin, 10);
}

/**
 * Change the bit depth from int to float.
 * @param {number} sample The sample.
 * @param {!Object<string, number>} args Data about the bit depths.
 * @return {number}
 * @private
 */
function intToFloat_(sample, args) {
  return sample > 0 ? sample / args.oldMax : sample / args.oldMin;
}

/**
 * Return the function to change the bit depth of a sample.
 * @param {string} original The original bit depth of the data.
 * @param {string} target The new bit depth of the data.
 * @return {!Function}
 * @private
 */
function getBitDepthFunction_(original, target) {
  /** @type {!Function} */
  let func = function(x) {return x;};
  if (original != target) {
    if (["32f", "64"].includes(original)) {
      func = floatToInt_;
    } else {
      if (["32f", "64"].includes(target)) {
        func = intToFloat_;
      } else {
        func = intToInt_;
      }
    }
  }
  return func;
}

/**
 * Validate the bit depth.
 * @param {string} bitDepth The original bit depth.
 * @throws {Error} If bit depth is not valid.
 * @private
 */
function validateBitDepth_(bitDepth) {
  if ((bitDepth != "32f" && bitDepth != "64") &&
      (parseInt(bitDepth, 10) < "8" || parseInt(bitDepth, 10) > "53")) {
    throw new Error("Invalid bit depth.");
  }
}

/**
 * Sign samples if they are 8-bit.
 * @param {string} bitDepth The bit depth code.
 * @param {!Array|!TypedArray} samples The samples.
 * @param {boolean} sign True to sign, false to unsign.
 * @private
 */
function sign8Bit_(bitDepth, samples, sign) {
  if (bitDepth == "8") {
    let factor = sign ? -128 : 128;
    for (let i = 0, len = samples.length; i < len; i++) {
      samples[i] = samples[i] += factor;
    }
  }
}

/*
 * imaadpcm: IMA ADPCM codec in JavaScript.
 * Copyright (c) 2018-2019 Rafael da Silva Rocha.
 * Copyright (c) 2016 acida. MIT License.  
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview IMA ADPCM codec.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/rochars/imaadpcm
 */

/**
 * @type {!Array<number>}
 * @private
 */
const INDEX_TABLE = [
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8];
/**
 * @type {!Array<number>}
 * @private
 */
const STEP_TABLE = [
    7, 8, 9, 10, 11, 12, 13, 14,
    16, 17, 19, 21, 23, 25, 28, 31,
    34, 37, 41, 45, 50, 55, 60, 66,
    73, 80, 88, 97, 107, 118, 130, 143,
    157, 173, 190, 209, 230, 253, 279, 307,
    337, 371, 408, 449, 494, 544, 598, 658,
    724, 796, 876, 963, 1060, 1166, 1282, 1411,
    1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024,
    3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484,
    7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
    15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
    32767];

/**
 * Encode 16-bit PCM samples into 4-bit IMA ADPCM samples.
 * @param {!Int16Array} samples A array of samples.
 * @return {!Uint8Array}
 */
function encode$2(samples) {
  /** @type {!Object} */
  let state = {
    index: 0,
    predicted: 0,
    step: 7
  };
  /** @type {!Uint8Array} */
  let adpcmSamples = new Uint8Array((samples.length));
  /** @type {!Array<number>} */
  let block = [];
  /** @type {number} */
  let fileIndex = 0;
  /** @type {number} */
  let blockCount = 0;
  for (let i = 0, len = samples.length; i < len; i++) {
    if ((i % 505 == 0 && i != 0)) {
      adpcmSamples.set(encodeBlock(block, state), fileIndex);
      fileIndex += 256;
      block = [];
      blockCount++;
    }
    block.push(samples[i]);
  }
  let samplesLength = samples.length / 2;
  if (samplesLength % 2) {
    samplesLength++;
  }
  return adpcmSamples.slice(0, samplesLength + 512 + blockCount * 4);
}

/**
 * Decode IMA ADPCM samples into 16-bit PCM samples.
 * @param {!Uint8Array} adpcmSamples A array of ADPCM samples.
 * @param {number} blockAlign The block size.
 * @return {!Int16Array}
 */
function decode$2(adpcmSamples, blockAlign=256) {
  /** @type {!Object} */
  let state = {
    index: 0,
    predicted: 0,
    step: 7
  };
  /** @type {!Int16Array} */
  let samples = new Int16Array(adpcmSamples.length * 2);
  /** @type {!Array<number>} */
  let block = [];
  /** @type {number} */
  let fileIndex = 0;
  for (let i = 0, len = adpcmSamples.length; i < len; i++) {
    if (i % blockAlign == 0 && i != 0) {            
      let decoded = decodeBlock(block, state);
      samples.set(decoded, fileIndex);
      fileIndex += decoded.length;
      block = [];
    }
    block.push(adpcmSamples[i]);
  }
  return samples;
}

/**
 * Encode a block of 505 16-bit samples as 4-bit ADPCM samples.
 * @param {!Array<number>} block A sample block of 505 samples.
 * @param {!Object} state The encoder state.
 * @return {!Array<number>}
 */
function encodeBlock(block, state) {
  /** @type {!Array<number>} */
  let adpcmSamples = blockHead_(block[0], state);
  for (let i = 3, len = block.length; i < len; i+=2) {
    /** @type {number} */
    let sample2 = encodeSample_(block[i], state);
    /** @type {number} */
    let sample = encodeSample_(block[i + 1], state);
    adpcmSamples.push((sample << 4) | sample2);
  }
  return adpcmSamples;
}

/**
 * Decode a block of ADPCM samples into 16-bit PCM samples.
 * @param {!Array<number>} block A adpcm sample block.
 * @param {!Object} state The decoder state.
 * @return {!Array<number>}
 */
function decodeBlock(block, state) {
  state.predicted = sign_((block[1] << 8) | block[0]);
  state.index = block[2];
  state.step = STEP_TABLE[state.index];
  /** @type {!Array<number>} */
  let result = [
      state.predicted,
      state.predicted
    ];
  for (let i = 4, len = block.length; i < len; i++) {
    /** @type {number} */
    let original_sample = block[i];
    /** @type {number} */
    let second_sample = original_sample >> 4;
    /** @type {number} */
    let first_sample = (second_sample << 4) ^ original_sample;
    result.push(decodeSample_(first_sample, state));
    result.push(decodeSample_(second_sample, state));
  }
  return result;
}

/**
 * Sign a 16-bit integer.
 * @param {number} num A 16-bit integer.
 * @return {number}
 * @private
 */
function sign_(num) {
  return num > 32768 ? num - 65536 : num;
}

/**
 * Compress a 16-bit PCM sample into a 4-bit ADPCM sample.
 * @param {number} sample The sample.
 * @param {!Object} state The encoder state.
 * @return {number}
 * @private
 */
function encodeSample_(sample, state) {
  /** @type {number} */
  let delta = sample - state.predicted;
  /** @type {number} */
  let value = 0;
  if (delta >= 0) {
    value = 0;
  } else {
    value = 8;
    delta = -delta;
  }
  /** @type {number} */
  let step = STEP_TABLE[state.index];
  /** @type {number} */
  let diff = step >> 3;
  if (delta > step) {
    value |= 4;
    delta -= step;
    diff += step;
  }
  step >>= 1;
  if (delta > step) {
    value |= 2;
    delta -= step;
    diff += step;
  }
  step >>= 1;
  if (delta > step) {
    value |= 1;
    diff += step;
  }
  updateEncoder_(value, diff, state);
  return value;
}

/**
 * Set the value for encoderPredicted_ and encoderIndex_
 * after each sample is compressed.
 * @param {number} value The compressed ADPCM sample
 * @param {number} diff The calculated difference
 * @param {!Object} state The encoder state.
 * @private
 */
function updateEncoder_(value, diff, state) {
  if (value & 8) {
    state.predicted -= diff;
  } else {
    state.predicted += diff;
  }
  if (state.predicted < -0x8000) {
    state.predicted = -0x8000;
  } else if (state.predicted > 0x7fff) {
    state.predicted = 0x7fff;
  }
  state.index += INDEX_TABLE[value & 7];
  if (state.index < 0) {
    state.index = 0;
  } else if (state.index > 88) {
    state.index = 88;
  }
}

/**
 * Decode a 4-bit ADPCM sample into a 16-bit PCM sample.
 * @param {number} nibble A 4-bit adpcm sample.
 * @param {!Object} state The decoder state.
 * @return {number}
 * @private
 */
function decodeSample_(nibble, state) {
  /** @type {number} */
  let difference = 0;
  if (nibble & 4) {
    difference += state.step;
  }
  if (nibble & 2) {
    difference += state.step >> 1;
  }
  if (nibble & 1) {
    difference += state.step >> 2;
  }
  difference += state.step >> 3;
  if (nibble & 8) {
    difference = -difference;
  }
  state.predicted += difference;
  if (state.predicted > 32767) {
    state.predicted = 32767;
  } else if (state.predicted < -32767) {
    state.predicted = -32767;
  }
  updateDecoder_(nibble, state);
  return state.predicted;
}

/**
 * Update the index and step after decoding a sample.
 * @param {number} nibble A 4-bit adpcm sample.
 * @param {!Object} state The decoder state.
 * @private
 */
function updateDecoder_(nibble, state) {
  state.index += INDEX_TABLE[nibble];
  if (state.index < 0) {
    state.index = 0;
  } else if (state.index > 88) {
    state.index = 88;
  }
  state.step = STEP_TABLE[state.index];
}

/**
 * Return the head of a ADPCM sample block.
 * @param {number} sample The first sample of the block.
 * @param {!Object} state The encoder state.
 * @return {!Array<number>}
 * @private
 */
function blockHead_(sample, state) {
  encodeSample_(sample, state);
  /** @type {!Array<number>} */
  let adpcmSamples = [];
  adpcmSamples.push(sample & 0xFF);
  adpcmSamples.push((sample >> 8) & 0xFF);
  adpcmSamples.push(state.index);
  adpcmSamples.push(0);
  return adpcmSamples;
}

/*
 * alawmulaw: A-Law and mu-Law codecs in JavaScript.
 * https://github.com/rochars/alawmulaw
 *
 * Copyright (c) 2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview A-Law codec.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/rochars/alawmulaw
 */

/** @type {!Array<number>} */
const LOG_TABLE = [
  1,1,2,2,3,3,3,3,4,4,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5, 
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6, 
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7, 
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7 
];

/**
 * Encode a 16-bit linear PCM sample as 8-bit A-Law.
 * @param {number} sample A 16-bit PCM sample
 * @return {number}
 */
function encodeSample$1(sample) {
  /** @type {number} */
  let compandedValue; 
  sample = (sample ==-32768) ? -32767 : sample;
  /** @type {number} */
  let sign = ((~sample) >> 8) & 0x80; 
  if (!sign) {
    sample = sample * -1; 
  }
  if (sample > 32635) {
    sample = 32635; 
  }
  if (sample >= 256)  {
    /** @type {number} */
    let exponent = LOG_TABLE[(sample >> 8) & 0x7F];
    /** @type {number} */
    let mantissa = (sample >> (exponent + 3) ) & 0x0F; 
    compandedValue = ((exponent << 4) | mantissa); 
  } else {
    compandedValue = sample >> 4; 
  } 
  return compandedValue ^ (sign ^ 0x55);
}

/**
 * Decode a 8-bit A-Law sample as 16-bit PCM.
 * @param {number} aLawSample The 8-bit A-Law sample
 * @return {number}
 */
function decodeSample$1(aLawSample) {
  /** @type {number} */
  let sign = 0;
  aLawSample ^= 0x55;
  if ((aLawSample & 0x80) !== 0) {
    aLawSample &= ~(1 << 7);
    sign = -1;
  }
  /** @type {number} */
  let position = ((aLawSample & 0xF0) >> 4) + 4;
  /** @type {number} */
  let decoded = 0;
  if (position != 4) {
    decoded = ((1 << position) |
      ((aLawSample & 0x0F) << (position - 4)) |
      (1 << (position - 5)));
  } else {
    decoded = (aLawSample << 1)|1;
  }
  decoded = (sign === 0) ? (decoded) : (-decoded);
  return (decoded * 8) * -1;
}

/**
 * Encode 16-bit linear PCM samples as 8-bit A-Law samples.
 * @param {!Int16Array} samples A array of 16-bit PCM samples.
 * @return {!Uint8Array}
 */
function encode$1(samples) {
  /** @type {!Uint8Array} */
  let aLawSamples = new Uint8Array(samples.length);
  for (let i = 0, len = samples.length; i < len; i++) {
    aLawSamples[i] = encodeSample$1(samples[i]);
  }
  return aLawSamples;
}

/**
 * Decode 8-bit A-Law samples into 16-bit linear PCM samples.
 * @param {!Uint8Array} samples A array of 8-bit A-Law samples.
 * @return {!Int16Array}
 */
function decode$1(samples) {
  /** @type {!Int16Array} */
  let pcmSamples = new Int16Array(samples.length);
  for (let i = 0, len = samples.length; i < len; i++) {
    pcmSamples[i] = decodeSample$1(samples[i]);
  }
  return pcmSamples;
}

/*
 * alawmulaw: A-Law and mu-Law codecs in JavaScript.
 * https://github.com/rochars/alawmulaw
 *
 * Copyright (c) 2018-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview mu-Law codec.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/rochars/alawmulaw
 */

/**
 * @type {number}
 * @private
 */
const BIAS = 0x84;
/**
 * @type {number}
 * @private
 */
const CLIP = 32635;
/**
 * @type {Array<number>}
 * @private
 */
const encodeTable = [
    0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
    4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
    7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7];
/**
 * @type {Array<number>}
 * @private
 */
const decodeTable = [0,132,396,924,1980,4092,8316,16764];

/**
 * Encode a 16-bit linear PCM sample as 8-bit mu-Law.
 * @param {number} sample A 16-bit PCM sample
 * @return {number}
 */
function encodeSample(sample) {
  /** @type {number} */
  let sign;
  /** @type {number} */
  let exponent;
  /** @type {number} */
  let mantissa;
  /** @type {number} */
  let muLawSample;
  /** get the sample into sign-magnitude **/
  sign = (sample >> 8) & 0x80;
  if (sign != 0) sample = -sample;
  /** convert from 16 bit linear to ulaw **/
  sample = sample + BIAS;
  if (sample > CLIP) sample = CLIP;
  exponent = encodeTable[(sample>>7) & 0xFF];
  mantissa = (sample >> (exponent+3)) & 0x0F;
  muLawSample = ~(sign | (exponent << 4) | mantissa);
  /** return the result **/
  return muLawSample;
}

/**
 * Decode a 8-bit mu-Law sample as 16-bit PCM.
 * @param {number} muLawSample The 8-bit mu-Law sample
 * @return {number}
 */
function decodeSample(muLawSample) {
  /** @type {number} */
  let sign;
  /** @type {number} */
  let exponent;
  /** @type {number} */
  let mantissa;
  /** @type {number} */
  let sample;
  muLawSample = ~muLawSample;
  sign = (muLawSample & 0x80);
  exponent = (muLawSample >> 4) & 0x07;
  mantissa = muLawSample & 0x0F;
  sample = decodeTable[exponent] + (mantissa << (exponent+3));
  if (sign != 0) sample = -sample;
  return sample;
}

/**
 * Encode 16-bit linear PCM samples into 8-bit mu-Law samples.
 * @param {!Int16Array} samples A array of 16-bit PCM samples.
 * @return {!Uint8Array}
 */
function encode(samples) {
  /** @type {!Uint8Array} */
  let muLawSamples = new Uint8Array(samples.length);
  for (let i = 0, len = samples.length; i < len; i++) {
    muLawSamples[i] = encodeSample(samples[i]);
  }
  return muLawSamples;
}

/**
 * Decode 8-bit mu-Law samples into 16-bit PCM samples.
 * @param {!Uint8Array} samples A array of 8-bit mu-Law samples.
 * @return {!Int16Array}
 */
function decode(samples) {
  /** @type {!Int16Array} */
  let pcmSamples = new Int16Array(samples.length);
  for (let i = 0, len = samples.length; i < len; i++) {
    pcmSamples[i] = decodeSample(samples[i]);
  }
  return pcmSamples;
}

/*
 * Copyright (c) 2017-2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview A function to swap endianness in byte buffers.
 * @see https://github.com/rochars/byte-data
 * @see https://github.com/rochars/wavefile
 */

/**
 * Swap the byte ordering in a buffer. The buffer is modified in place.
 * @param {!(Array<number>|Uint8Array)} bytes The bytes.
 * @param {number} offset The byte offset.
 * @param {number=} [start=0] The start index.
 * @param {number=} [end=bytes.length] The end index.
 */
function endianness(bytes, offset, start=0, end=bytes.length) {
  for (let index = start; index < end; index += offset) {
    swap_(bytes, offset, index);
  }
}

/**
 * Swap the byte order of a value in a buffer. The buffer is modified in place.
 * @param {!(Array<number>|Uint8Array)} bytes The bytes.
 * @param {number} offset The byte offset.
 * @param {number} index The start index.
 * @private
 */
function swap_(bytes, offset, index) {
  offset--;
  for(let x = 0; x < offset; x++) {
    /** @type {number} */
    let theByte = bytes[index + x];
    bytes[index + x] = bytes[index + offset];
    bytes[index + offset] = theByte;
    offset--;
  }
}

/*
 * Copyright (c) 2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview Encode and decode UTF8 strings to and from byte buffers.
 * @see https://github.com/rochars/byte-data
 * @see https://github.com/rochars/wavefile
 * @see https://encoding.spec.whatwg.org/#the-encoding
 * @see https://encoding.spec.whatwg.org/#utf-8-encoder
 */

/**
 * Read a string of UTF-8 characters from a byte buffer.
 * Invalid characters are replaced with 'REPLACEMENT CHARACTER' (U+FFFD).
 * @see https://encoding.spec.whatwg.org/#the-encoding
 * @see https://stackoverflow.com/a/34926911
 * @param {!Uint8Array|!Array<number>} buffer A byte buffer.
 * @param {number} [start=0] The buffer index to start reading.
 * @param {number} [end=0] The buffer index to stop reading.
 *   Assumes the buffer length if undefined.
 * @return {string}
 */
function unpack$1(buffer, start=0, end=buffer.length) {
  /** @type {string} */
  let str = '';
  for(let index = start; index < end;) {
    /** @type {number} */
    let lowerBoundary = 0x80;
    /** @type {number} */
    let upperBoundary = 0xBF;
    /** @type {boolean} */
    let replace = false;
    /** @type {number} */
    let charCode = buffer[index++];
    if (charCode >= 0x00 && charCode <= 0x7F) {
      str += String.fromCharCode(charCode);
    } else {
      /** @type {number} */
      let count = 0;
      if (charCode >= 0xC2 && charCode <= 0xDF) {
        count = 1;
      } else if (charCode >= 0xE0 && charCode <= 0xEF ) {
        count = 2;
        if (buffer[index] === 0xE0) {
          lowerBoundary = 0xA0;
        }
        if (buffer[index] === 0xED) {
          upperBoundary = 0x9F;
        }
      } else if (charCode >= 0xF0 && charCode <= 0xF4 ) {
        count = 3;
        if (buffer[index] === 0xF0) {
          lowerBoundary = 0x90;
        }
        if (buffer[index] === 0xF4) {
          upperBoundary = 0x8F;
        }
      } else {
        replace = true;
      }
      charCode = charCode & (1 << (8 - count - 1)) - 1;
      for (let i = 0; i < count; i++) {
        if (buffer[index] < lowerBoundary || buffer[index] > upperBoundary) {
          replace = true;
        }
        charCode = (charCode << 6) | (buffer[index] & 0x3f);
        index++;
      }
      if (replace) {
        str += String.fromCharCode(0xFFFD);
      } 
      else if (charCode <= 0xffff) {
        str += String.fromCharCode(charCode);
      } else {
        charCode -= 0x10000;
        str += String.fromCharCode(
          ((charCode >> 10) & 0x3ff) + 0xd800,
          (charCode & 0x3ff) + 0xdc00);
      }
    }
  }
  return str;
}

/**
 * Write a string of UTF-8 characters to a byte buffer.
 * @see https://encoding.spec.whatwg.org/#utf-8-encoder
 * @param {string} str The string to pack.
 * @param {!Uint8Array|!Array<number>} buffer The buffer to pack the string to.
 * @param {number=} index The buffer index to start writing.
 * @return {number} The next index to write in the buffer.
 */
function pack$1(str, buffer, index=0) {
  /** @type {number} */
  let i = 0;
  /** @type {number} */
  let len = str.length;
  while (i < len) {
    /** @type {number} */
    let codePoint = str.codePointAt(i);
    if (codePoint < 128) {
      buffer[index] = codePoint;
      index++;
    } else {
      /** @type {number} */
      let count = 0;
      /** @type {number} */
      let offset = 0;
      if (codePoint <= 0x07FF) {
        count = 1;
        offset = 0xC0;
      } else if(codePoint <= 0xFFFF) {
        count = 2;
        offset = 0xE0;
      } else if(codePoint <= 0x10FFFF) {
        count = 3;
        offset = 0xF0;
        i++;
      }
      buffer[index] = (codePoint >> (6 * count)) + offset;
      index++;
      while (count > 0) {
        buffer[index] = 0x80 | (codePoint >> (6 * (count - 1)) & 0x3F);
        index++;
        count--;
      }
    }
    i++;
  }
  return index;
}

/*
 * Copyright (c) 2017-2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview Encode and decode int numbers to and from byte buffers.
 * @see https://github.com/rochars/byte-data
 * @see https://github.com/rochars/wavefile
 */

/**
 * A class to write and read integer numbers to and from byte buffers.
 */
class IntParser {
  
  /**
   * @param {number} bits The number of bits used by the integer.
   * @param {boolean} [signed=false] True for signed, false otherwise.
   */
  constructor(bits, signed=false) {
    /**
     * The number of bits used by one number.
     * @type {number}
     */
    this.bits = bits;
    /**
     * The number of bytes used by one number.
     * @type {number}
     */
    this.offset = Math.ceil(bits / 8);
    /**
     * @type {number}
     * @protected
     */
    this.max = Math.pow(2, bits) - 1;
    /**
     * @type {number}
     * @protected
     */
    this.min = 0;
    /**
     * @type {Function}
     */
    this.unpack = this.unpack_;
    if (signed) {
      this.max = Math.pow(2, bits) / 2 - 1;
      this.min = -this.max - 1;
      this.unpack = this.unpackSigned_;
    }
  }

  /**
   * Write one unsigned integer to a byte buffer.
   * @param {!(Uint8Array|Array<number>)} buffer An array of bytes.
   * @param {number} num The number. Overflows are truncated.
   * @param {number} [index=0] The index being written in the byte buffer.
   * @return {number} The next index to write on the byte buffer.
   */
  pack(buffer, num, index=0) {
    num = this.clamp_(Math.round(num));
    for (let i = 0, len = this.offset; i < len; i++) {
      buffer[index] = Math.floor(num / Math.pow(2, i * 8)) & 255;
      index++;
    }
    return index;
  }

  /**
   * Read one unsigned integer from a byte buffer.
   * Does not check for overflows.
   * @param {!(Uint8Array|Array<number>)} buffer An array of bytes.
   * @param {number} [index=0] The index to read.
   * @return {number}
   * @private
   */
  unpack_(buffer, index=0) {
    /** @type {number} */
    let num = 0;
    for(let x = 0; x < this.offset; x++) {
      num += buffer[index + x] * Math.pow(256, x);
    }
    return num;
  }

  /**
   * Read one two's complement signed integer from a byte buffer.
   * @param {!(Uint8Array|Array<number>)} buffer An array of bytes.
   * @param {number} [index=0] The index to read.
   * @return {number}
   * @private
   */
  unpackSigned_(buffer, index=0) {
    return this.sign_(this.unpack_(buffer, index));
  }

  /**
   * Clamp values on overflow.
   * @param {number} num The number.
   * @private
   */
  clamp_(num) {
    if (num > this.max) {
      return this.max;
    } else if (num < this.min) {
      return this.min;
    }
    return num;
  }

  /**
   * Sign a number.
   * @param {number} num The number.
   * @return {number}
   * @private
   */
  sign_(num) {
    if (num > this.max) {
      num -= (this.max * 2) + 2;
    }
    return num;
  }
}

/*
 * Copyright (c) 2018-2019 Rafael da Silva Rocha.
 * Copyright (c) 2013 DeNA Co., Ltd.
 * Copyright (c) 2010, Linden Research, Inc
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview Encode and decode IEEE 754 floating point numbers.
 * @see https://github.com/rochars/byte-data
 * @see https://github.com/rochars/wavefile
 * @see https://bitbucket.org/lindenlab/llsd/raw/7d2646cd3f9b4c806e73aebc4b32bd81e4047fdc/js/typedarray.js
 * @see https://github.com/kazuho/ieee754.js/blob/master/ieee754.js
 */

/**
 * A class to encode and decode IEEE 754 floating-point numbers.
 */
class FloatParser {

  /**
   * Pack a IEEE 754 floating point number.
   * @param {number} ebits The exponent bits.
   * @param {number} fbits The fraction bits.
   */
  constructor(ebits, fbits) {
    /**
     * @type {number}
     */
    this.offset = Math.ceil((ebits + fbits) / 8);
    /**
     * @type {number}
     * @private
     */
    this.ebits = ebits;
    /**
     * @type {number}
     * @private
     */
    this.fbits = fbits;
    /**
     * @type {number}
     * @private
     */
    this.bias = (1 << (ebits - 1)) - 1;
    /**
     * @type {number}
     * @private
     */
    this.biasP2 = Math.pow(2, this.bias + 1);
    /**
     * @type {number}
     * @private
     */
    this.ebitsFbits = (ebits + fbits);
    /**
     * @type {number}
     * @private
     */
    this.fbias = Math.pow(2, -(8 * this.offset - 1 - ebits));
  }

  /**
   * Pack a IEEE 754 floating point number.
   * @param {!Uint8Array|!Array<number>} buffer The buffer.
   * @param {number} num The number.
   * @param {number} index The index to write on the buffer.
   * @return {number} The next index to write on the buffer.
   */
  pack(buffer, num, index) {
    // Round overflows
    if (Math.abs(num) > this.biasP2 - (this.ebitsFbits * 2)) {
      num = num < 0 ? -Infinity : Infinity;
    }
    /**
     * sign, need this to handle negative zero
     * @see http://cwestblog.com/2014/02/25/javascript-testing-for-negative-zero/
     * @type {number}
     */
    let sign = (((num = +num) || 1 / num) < 0) ? 1 : num < 0 ? 1 : 0;
    num = Math.abs(num);
    /** @type {number} */
    let exp = Math.min(Math.floor(Math.log(num) / Math.LN2), 1023);
    /** @type {number} */
    let fraction = roundToEven(num / Math.pow(2, exp) * Math.pow(2, this.fbits));
    // NaN
    if (num !== num) {
      fraction = Math.pow(2, this.fbits - 1);
      exp = (1 << this.ebits) - 1;
    // Number
    } else if (num !== 0) {
      if (num >= Math.pow(2, 1 - this.bias)) {
        if (fraction / Math.pow(2, this.fbits) >= 2) {
          exp = exp + 1;
          fraction = 1;
        }
        // Overflow
        if (exp > this.bias) {
          exp = (1 << this.ebits) - 1;
          fraction = 0;
        } else {
          exp = exp + this.bias;
          fraction = roundToEven(fraction) - Math.pow(2, this.fbits);
        }
      } else {
        fraction = roundToEven(num / Math.pow(2, 1 - this.bias - this.fbits));
        exp = 0;
      } 
    }
    return this.packFloatBits_(buffer, index, sign, exp, fraction);
  }

  /**
   * Unpack a IEEE 754 floating point number.
   * Derived from IEEE754 by DeNA Co., Ltd., MIT License. 
   * Adapted to handle NaN. Should port the solution to the original repo.
   * @param {!Uint8Array|!Array<number>} buffer The buffer.
   * @param {number} index The index to read from the buffer.
   * @return {number} The floating point number.
   */
  unpack(buffer, index) {
    /** @type {number} */
    let eMax = (1 << this.ebits) - 1;
    /** @type {number} */
    let significand;
    /** @type {string} */
    let leftBits = "";
    for (let i = this.offset - 1; i >= 0 ; i--) {
      /** @type {string} */
      let t = buffer[i + index].toString(2);
      leftBits += "00000000".substring(t.length) + t;
    }
    /** @type {number} */
    let sign = leftBits.charAt(0) == "1" ? -1 : 1;
    leftBits = leftBits.substring(1);
    /** @type {number} */
    let exponent = parseInt(leftBits.substring(0, this.ebits), 2);
    leftBits = leftBits.substring(this.ebits);
    if (exponent == eMax) {
      if (parseInt(leftBits, 2) !== 0) {
        return NaN;
      }
      return sign * Infinity;  
    } else if (exponent === 0) {
      exponent += 1;
      significand = parseInt(leftBits, 2);
    } else {
      significand = parseInt("1" + leftBits, 2);
    }
    return sign * significand * this.fbias * Math.pow(2, exponent - this.bias);
  }

  /**
   * Pack a IEEE754 from its sign, exponent and fraction bits
   * and place it in a byte buffer.
   * @param {!Uint8Array|!Array<number>} buffer The byte buffer to write to.
   * @param {number} index The buffer index to write.
   * @param {number} sign The sign.
   * @param {number} exp the exponent.
   * @param {number} fraction The fraction.
   * @return {number}
   * @private
   */
  packFloatBits_(buffer, index, sign, exp, fraction) {
    /** @type {!Array<number>} */
    let bits = [];
    // the sign
    bits.push(sign);
    // the exponent
    for (let i = this.ebits; i > 0; i -= 1) {
      bits[i] = (exp % 2 ? 1 : 0);
      exp = Math.floor(exp / 2);
    }
    // the fraction
    let len = bits.length;
    for (let i = this.fbits; i > 0; i -= 1) {
      bits[len + i] = (fraction % 2 ? 1 : 0);
      fraction = Math.floor(fraction / 2);
    }
    // pack as bytes
    /** @type {string} */
    let str = bits.join('');
    /** @type {number} */
    let offset = this.offset + index - 1;
    /** @type {number} */
    let k = index;
    while (offset >= index) {
      buffer[offset] = parseInt(str.substring(0, 8), 2);
      str = str.substring(8);
      offset--;
      k++;
    }
    return k;
  }
}

/**
 * Round a number to its nearest even value.
 * @param {number} n The number.
 * @return {number}
 * @private
 */
function roundToEven(n) {
  /** @type {number} */
  let w = Math.floor(n);
  let f = n - w;
  if (f < 0.5) {
    return w;
  }
  if (f > 0.5) {
    return w + 1;
  }
  return w % 2 ? w + 1 : w;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * Read a string of UTF-8 characters from a byte buffer.
 * @param {!(Uint8Array|Array<number>)} buffer A byte buffer.
 * @param {number} [index=0] The buffer index to start reading.
 * @param {number} [end=buffer.length] The index to stop reading, non inclusive.
 * @return {string}
 */
function unpackString(buffer, index=0, end=buffer.length) {
  return unpack$1(buffer, index, end);
}

/**
 * Write a string of UTF-8 characters as a byte buffer.
 * @param {string} str The string to pack.
 * @return {!Array<number>} The UTF-8 string bytes.
 */
function packString(str) {
  /** @type {!Array<number>} */
  let buffer = [];
  pack$1(str, buffer);
  return buffer;
}

/**
 * Write a string of UTF-8 characters to a byte buffer.
 * @param {string} str The string to pack.
 * @param {!(Uint8Array|Array<number>)} buffer The output buffer.
 * @param {number} [index=0] The buffer index to start writing.
 * @return {number} The next index to write in the buffer.
 */
function packStringTo(str, buffer, index=0) {
  return pack$1(str, buffer, index);
}

// Numbers
/**
 * Pack a array of numbers to a byte buffer.
 * All other packing functions are interfaces to this function.
 * @param {!(Array<number>|TypedArray)} values The values to pack.
 * @param {!{bits:number,
 *   fp: (boolean|undefined),
 *   signed: (boolean|undefined),
 *   be: (boolean|undefined)}} theType The type definition.
 * @param {!(Uint8Array|Array<number>)} buffer The buffer to write on.
 * @param {number} [index=0] The buffer index to start writing.
 * @return {number} The next index to write.
 * @throws {Error} If the type definition is not valid.
 */
function packArrayTo(values, theType, buffer, index=0) {
  theType = theType || {};
  /** @type {!Object} */
  let packer = getParser_(theType.bits, theType.fp, theType.signed);
  /** @type {number} */
  let offset = Math.ceil(theType.bits / 8);
  /** @type {number} */
  let i = 0;
  /** @type {number} */
  let start = index;
  for (let valuesLen = values.length; i < valuesLen; i++) {
    index = packer.pack(buffer, values[i], index);
  }
  if (theType.be) {
    endianness(buffer, offset, start, index);
  }
  return index;
}

/**
 * Unpack a array of numbers from a byte buffer to a array or a typed array.
 * All other unpacking functions are interfaces to this function.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer.
 * @param {!{bits:number,
 *   fp: (boolean|undefined),
 *   signed: (boolean|undefined),
 *   be: (boolean|undefined)}} theType The type definition.
 * @param {!(TypedArray|Array<number>)} output The output array or typed array.
 * @param {number} [start=0] The buffer index to start reading.
 * @param {number} [end=buffer.length] The buffer index to stop reading.
 * @throws {Error} If the type definition is not valid.
 */
function unpackArrayTo(
    buffer, theType, output, start=0, end=buffer.length) {
  theType = theType || {};
  /** @type {!Object} */
  let parser = getParser_(theType.bits, theType.fp, theType.signed);
  // getUnpackLen_ will adjust the end index according to the size
  // of the input buffer and the byte offset or throw a error on bad
  // end index if safe=true
  end = getUnpackLen_(buffer, start, end, parser.offset);
  if (theType.be) {
    /** @type {!(Uint8Array|Array<number>)} */
    let readBuffer = copyBuffer_(buffer);
    if (theType.be) {
      endianness(readBuffer, parser.offset, start, end);
    }
    unpack_(readBuffer, output, start, end, parser);
  } else {
    unpack_(buffer, output, start, end, parser);
  }
}

/**
 * Pack a number to a byte buffer.
 * @param {number} value The value.
 * @param {!{bits:number,
 *   fp: (boolean|undefined),
 *   signed: (boolean|undefined),
 *   be: (boolean|undefined)}} theType The type definition.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer to write on.
 * @param {number} [index=0] The buffer index to write.
 * @return {number} The next index to write.
 * @throws {Error} If the type definition is not valid.
 */
function packTo(value, theType, buffer, index=0) {
  return packArrayTo([value], theType, buffer, index);
}

/**
 * Pack a number as a array of bytes.
 * @param {number} value The number to pack.
 * @param {!{bits:number,
 *   fp: (boolean|undefined),
 *   signed: (boolean|undefined),
 *   be: (boolean|undefined)}} theType The type definition.
 * @return {!Array<number>} The packed value.
 * @throws {Error} If the type definition is not valid.
 */
function pack(value, theType) {
  /** @type {!Array<number>} */
  let output = [];
  packTo(value, theType, output, 0);
  return output;
}

/**
 * Unpack a number from a byte buffer.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer.
 * @param {!{bits:number,
 *   fp: (boolean|undefined),
 *   signed: (boolean|undefined),
 *   be: (boolean|undefined)}} theType The type definition.
 * @param {number} [index=0] The buffer index to read.
 * @return {number}
 * @throws {Error} If the type definition is not valid.
 */
function unpack(buffer, theType, index=0) {
  let output = [];
  unpackArrayTo(buffer, theType, output,
    index, index + Math.ceil(theType.bits / 8));
  return output[0];
}

/**
 * Unpack a array of numbers from a byte buffer to a array or a typed array.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer.
 * @param {!(TypedArray|Array<number>)} output The output array or typed array.
 * @param {number} start The buffer index to start reading.
 * @param {number} end The buffer index to stop reading.
 * @param {!Object} parser The parser.
 * @private
 */
function unpack_(buffer, output, start, end, parser) {
  /** @type {number} */
  let offset = parser.offset;
  for (let index = 0, j = start; j < end; j += offset, index++) {
    output[index] = parser.unpack(buffer, j);
  }
}

/**
 * Copy a byte buffer as a Array or Uint8Array.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer.
 * @return {!(Uint8Array|Array<number>)}
 * @private
 */
function copyBuffer_(buffer) {
  return new Uint8Array(buffer);
}

/**
 * Adjust the end index according to the input buffer length and the
 * type offset.
 * @param {!(Uint8Array|Array<number>)} buffer The byte buffer.
 * @param {number} start The buffer index to start reading.
 * @param {number} end The buffer index to stop reading.
 * @param {number} offset The number of bytes used by the type.
 * @private
 */
function getUnpackLen_(buffer, start, end, offset) {
  /** @type {number} */
  let extra = (end - start) % offset;
  return end - extra;
}

/**
 * Return a parser for int, uint or fp numbers.
 * @param {number} bits The number of bits.
 * @param {boolean|undefined} fp True for fp numbers, false otherwise.
 * @param {boolean|undefined} signed True for signed ints, false otherwise.
 * @return {!Object}
 * @private
 */
function getParser_(bits, fp, signed) {
  if (fp && bits == 32) {
    return new FloatParser(8, 23);
  } else if(fp && bits == 64) {
    return new FloatParser(11, 52);
  }
  return new IntParser(bits, signed);
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to perform low-level reading of RIFF/RIFX files.
 */
class RIFFFile {

  constructor() {
    /**
     * The container identifier.
     * 'RIFF', 'RIFX' and 'RF64' are supported.
     * @type {string}
     */
    this.container = '';
    /**
     * @type {number}
     */
    this.chunkSize = 0;
    /**
     * The format.
     * @type {string}
     */
    this.format = '';
    /**
     * A object defining the start and end of all chunks in a wav buffer.
     * @type {Object}
     */
    this.signature = null;
    /**
     * @type {number}
     * @protected
     */
    this.head = 0;
    /**
     * @type {!{bits: number, be: boolean}}
     * @protected
     */
    this.uInt32 = {bits: 32, be: false};
    /**
     * The list of supported containers.
     * Any format different from RIFX will be treated as RIFF.
     * @type {!Array<string>}
     * @protected
     */
    this.supported_containers = ['RIFF', 'RIFX'];
  }

  /**
   * Read the signature of the chunks in a RIFF/RIFX file.
   * @param {!Uint8Array} buffer The file bytes.
   * @protected
   */
  setSignature(buffer) {
    this.head = 0;
    this.container = this.readString(buffer, 4);
    if (this.supported_containers.indexOf(this.container) === -1) {
      throw Error('Not a supported format.');
    }
    this.uInt32.be = this.container === 'RIFX';
    this.chunkSize = this.readUInt32(buffer);
    this.format = this.readString(buffer, 4);
    // The RIFF file signature
    this.signature = {
      chunkId: this.container,
      chunkSize: this.chunkSize,
      format: this.format,
      subChunks: this.getSubChunksIndex_(buffer)
    };
  }

  /**
    * Find a chunk by its fourCC_ in a array of RIFF chunks.
    * @param {string} chunkId The chunk fourCC_.
    * @param {boolean} [multiple=false] True if there may be multiple chunks
    *    with the same chunkId.
    * @return {Object}
    * @protected
    */
  findChunk(chunkId, multiple=false) {
    /** @type {!Array<Object>} */
    let chunks = this.signature.subChunks;
    /** @type {!Array<Object>} */
    let chunk = [];
    for (let i=0; i<chunks.length; i++) {
      if (chunks[i].chunkId == chunkId) {
        if (multiple) {
          chunk.push(chunks[i]);
        } else {
          return chunks[i];
        }
      }
    }
    if (chunkId == 'LIST') {
      return chunk.length ? chunk : null;
    }
    return null;
  }

  /**
   * Read bytes as a string from a RIFF chunk.
   * @param {!Uint8Array} bytes The bytes.
   * @param {number} maxSize the max size of the string.
   * @return {string} The string.
   * @protected
   */
  readString(bytes, maxSize) {
    /** @type {string} */
    let str = '';
    str = unpackString(bytes, this.head, this.head + maxSize);
    this.head += maxSize;
    return str;
  }

  /**
   * Read a number from a chunk.
   * @param {!Uint8Array} bytes The chunk bytes.
   * @return {number} The number.
   * @protected
   */
  readUInt32(bytes) {
    /** @type {number} */
    let value = unpack(bytes, this.uInt32, this.head);
    this.head += 4;
    return value;
  }

  /**
   * Return the sub chunks of a RIFF file.
   * @param {!Uint8Array} buffer the RIFF file bytes.
   * @return {!Array<Object>} The subchunks of a RIFF/RIFX or LIST chunk.
   * @private
   */
  getSubChunksIndex_(buffer) {
    /** @type {!Array<!Object>} */
    let chunks = [];
    /** @type {number} */
    let i = this.head;
    while(i <= buffer.length - 8) {
      chunks.push(this.getSubChunkIndex_(buffer, i));
      i += 8 + chunks[chunks.length - 1].chunkSize;
      i = i % 2 ? i + 1 : i;
    }
    return chunks;
  }

  /**
   * Return a sub chunk from a RIFF file.
   * @param {!Uint8Array} buffer the RIFF file bytes.
   * @param {number} index The start index of the chunk.
   * @return {!Object} A subchunk of a RIFF/RIFX or LIST chunk.
   * @private
   */
  getSubChunkIndex_(buffer, index) {
    /** @type {!Object} */
    let chunk = {
      chunkId: this.getChunkId_(buffer, index),
      chunkSize: this.getChunkSize_(buffer, index),
    };
    if (chunk.chunkId == 'LIST') {
      chunk.format = unpackString(buffer, index + 8, index + 12);
      this.head += 4;
      chunk.subChunks = this.getSubChunksIndex_(buffer);
    } else {
      /** @type {number} */
      let realChunkSize = chunk.chunkSize % 2 ?
        chunk.chunkSize + 1 : chunk.chunkSize;
      this.head = index + 8 + realChunkSize;
      chunk.chunkData = {
        start: index + 8,
        end: this.head
      };
    }
    return chunk;
  }

  /**
   * Return the fourCC_ of a chunk.
   * @param {!Uint8Array} buffer the RIFF file bytes.
   * @param {number} index The start index of the chunk.
   * @return {string} The id of the chunk.
   * @private
   */
  getChunkId_(buffer, index) {
    this.head += 4;
    return unpackString(buffer, index, index + 4);
  }

  /**
   * Return the size of a chunk.
   * @param {!Uint8Array} buffer the RIFF file bytes.
   * @param {number} index The start index of the chunk.
   * @return {number} The size of the chunk without the id and size fields.
   * @private
   */
  getChunkSize_(buffer, index) {
    this.head += 4;
    return unpack(buffer, this.uInt32, index + 4);
  }
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to read wav files.
 * @extends RIFFFile
 */
class WaveFileReader extends RIFFFile {

  constructor() {
    super();
    // Include 'RF64' as a supported container format
    this.supported_containers.push('RF64');
    /**
     * The data of the 'fmt' chunk.
     * @type {!Object<string, *>}
     */
    this.fmt = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {number} */
      audioFormat: 0,
      /** @type {number} */
      numChannels: 0,
      /** @type {number} */
      sampleRate: 0,
      /** @type {number} */
      byteRate: 0,
      /** @type {number} */
      blockAlign: 0,
      /** @type {number} */
      bitsPerSample: 0,
      /** @type {number} */
      cbSize: 0,
      /** @type {number} */
      validBitsPerSample: 0,
      /** @type {number} */
      dwChannelMask: 0,
      /**
       * 4 32-bit values representing a 128-bit ID
       * @type {!Array<number>}
       */
      subformat: []
    };
    /**
     * The data of the 'fact' chunk.
     * @type {!Object<string, *>}
     */
    this.fact = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {number} */
      dwSampleLength: 0
    };
    /**
     * The data of the 'cue ' chunk.
     * @type {!Object<string, *>}
     */
    this.cue = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {number} */
      dwCuePoints: 0,
      /** @type {!Array<!Object>} */
      points: [],
    };
    /**
     * The data of the 'smpl' chunk.
     * @type {!Object<string, *>}
     */
    this.smpl = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {number} */
      dwManufacturer: 0,
      /** @type {number} */
      dwProduct: 0,
      /** @type {number} */
      dwSamplePeriod: 0,
      /** @type {number} */
      dwMIDIUnityNote: 0,
      /** @type {number} */
      dwMIDIPitchFraction: 0,
      /** @type {number} */
      dwSMPTEFormat: 0,
      /** @type {number} */
      dwSMPTEOffset: 0,
      /** @type {number} */
      dwNumSampleLoops: 0,
      /** @type {number} */
      dwSamplerData: 0,
      /** @type {!Array<!Object>} */
      loops: []
    };
    /**
     * The data of the 'bext' chunk.
     * @type {!Object<string, *>}
     */
    this.bext = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {string} */
      description: '', //256
      /** @type {string} */
      originator: '', //32
      /** @type {string} */
      originatorReference: '', //32
      /** @type {string} */
      originationDate: '', //10
      /** @type {string} */
      originationTime: '', //8
      /**
       * 2 32-bit values, timeReference high and low
       * @type {!Array<number>}
       */
      timeReference: [0, 0],
      /** @type {number} */
      version: 0, //WORD
      /** @type {string} */
      UMID: '', // 64 chars
      /** @type {number} */
      loudnessValue: 0, //WORD
      /** @type {number} */
      loudnessRange: 0, //WORD
      /** @type {number} */
      maxTruePeakLevel: 0, //WORD
      /** @type {number} */
      maxMomentaryLoudness: 0, //WORD
      /** @type {number} */
      maxShortTermLoudness: 0, //WORD
      /** @type {string} */
      reserved: '', //180
      /** @type {string} */
      codingHistory: '' // string, unlimited
    };
    /**
     * The data of the 'iXML' chunk.
     * @type {!Object<string, *>}
     */
    this.iXML = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {string} */
      value: ''
    };
    /**
     * The data of the 'ds64' chunk.
     * Used only with RF64 files.
     * @type {!Object<string, *>}
     */
    this.ds64 = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {number} */
      riffSizeHigh: 0, // DWORD
      /** @type {number} */
      riffSizeLow: 0, // DWORD
      /** @type {number} */
      dataSizeHigh: 0, // DWORD
      /** @type {number} */
      dataSizeLow: 0, // DWORD
      /** @type {number} */
      originationTime: 0, // DWORD
      /** @type {number} */
      sampleCountHigh: 0, // DWORD
      /** @type {number} */
      sampleCountLow: 0 // DWORD
      /** @type {number} */
      //'tableLength': 0, // DWORD
      /** @type {!Array<number>} */
      //'table': []
    };
    /**
     * The data of the 'data' chunk.
     * @type {!Object<string, *>}
     */
    this.data = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {!Uint8Array} */
      samples: new Uint8Array(0)
    };
    /**
     * The data of the 'LIST' chunks.
     * Each item in this list look like this:
     *  {
     *      chunkId: '',
     *      chunkSize: 0,
     *      format: '',
     *      subChunks: []
     *   }
     * @type {!Array<!Object>}
     */
    this.LIST = [];
    /**
     * The data of the 'junk' chunk.
     * @type {!Object<string, *>}
     */
    this.junk = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {!Array<number>} */
      chunkData: []
    };
    /**
     * The data of the '_PMX' chunk.
     * @type {!Object<string, *>}
     */
    this._PMX = {
      /** @type {string} */
      chunkId: '',
      /** @type {number} */
      chunkSize: 0,
      /** @type {string} */
      value: ''
    };
    /**
     * @type {{be: boolean, bits: number, fp: boolean, signed: boolean}}
     * @protected
     */
    this.uInt16 = {bits: 16, be: false, signed: false, fp: false};
  }

  /**
   * Set up the WaveFileReader object from a byte buffer.
   * @param {!Uint8Array} wavBuffer The buffer.
   * @param {boolean=} [samples=true] True if the samples should be loaded.
   * @throws {Error} If container is not RIFF, RIFX or RF64.
   * @throws {Error} If format is not WAVE.
   * @throws {Error} If no 'fmt ' chunk is found.
   * @throws {Error} If no 'data' chunk is found.
   */
  fromBuffer(wavBuffer, samples=true) {
    // Always should reset the chunks when reading from a buffer
    this.clearHeaders();
    this.setSignature(wavBuffer);
    this.uInt16.be = this.uInt32.be;
    if (this.format != 'WAVE') {
      throw Error('Could not find the "WAVE" format identifier');
    }
    this.readDs64Chunk_(wavBuffer);
    this.readFmtChunk_(wavBuffer);
    this.readFactChunk_(wavBuffer);
    this.readBextChunk_(wavBuffer);
    this.readiXMLChunk_(wavBuffer);
    this.readCueChunk_(wavBuffer);
    this.readSmplChunk_(wavBuffer);
    this.readDataChunk_(wavBuffer, samples);
    this.readJunkChunk_(wavBuffer);
    this.readLISTChunk_(wavBuffer);
    this.read_PMXChunk_(wavBuffer);
  }

  /**
   * Reset the chunks of the WaveFileReader instance.
   * @protected
   * @ignore
   */
  clearHeaders() {
    /** @type {!Object} */
    let tmpWav = new WaveFileReader();
    Object.assign(this.fmt, tmpWav.fmt);
    Object.assign(this.fact, tmpWav.fact);
    Object.assign(this.cue, tmpWav.cue);
    Object.assign(this.smpl, tmpWav.smpl);
    Object.assign(this.bext, tmpWav.bext);
    Object.assign(this.iXML, tmpWav.iXML);
    Object.assign(this.ds64, tmpWav.ds64);
    Object.assign(this.data, tmpWav.data);
    this.LIST = [];
    Object.assign(this.junk, tmpWav.junk);
    Object.assign(this._PMX, tmpWav._PMX);
  }
  
  /**
   * Read the 'fmt ' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @throws {Error} If no 'fmt ' chunk is found.
   * @private
   */
  readFmtChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('fmt ');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.fmt.chunkId = chunk.chunkId;
      this.fmt.chunkSize = chunk.chunkSize;
      this.fmt.audioFormat = this.readUInt16_(buffer);
      this.fmt.numChannels = this.readUInt16_(buffer);
      this.fmt.sampleRate = this.readUInt32(buffer);
      this.fmt.byteRate = this.readUInt32(buffer);
      this.fmt.blockAlign = this.readUInt16_(buffer);
      this.fmt.bitsPerSample = this.readUInt16_(buffer);
      this.readFmtExtension_(buffer);
    } else {
      throw Error('Could not find the "fmt " chunk');
    }
  }

  /**
   * Read the 'fmt ' chunk extension.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readFmtExtension_(buffer) {
    if (this.fmt.chunkSize > 16) {
      this.fmt.cbSize = this.readUInt16_(buffer);
      if (this.fmt.chunkSize > 18) {
        this.fmt.validBitsPerSample = this.readUInt16_(buffer);
        if (this.fmt.chunkSize > 20) {
          this.fmt.dwChannelMask = this.readUInt32(buffer);
          this.fmt.subformat = [
            this.readUInt32(buffer),
            this.readUInt32(buffer),
            this.readUInt32(buffer),
            this.readUInt32(buffer)];
        }
      }
    }
  }

  /**
   * Read the 'fact' chunk of a wav file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readFactChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('fact');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.fact.chunkId = chunk.chunkId;
      this.fact.chunkSize = chunk.chunkSize;
      this.fact.dwSampleLength = this.readUInt32(buffer);
    }
  }

  /**
   * Read the 'cue ' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readCueChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('cue ');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.cue.chunkId = chunk.chunkId;
      this.cue.chunkSize = chunk.chunkSize;
      this.cue.dwCuePoints = this.readUInt32(buffer);
      for (let i = 0; i < this.cue.dwCuePoints; i++) {
        this.cue.points.push({
          dwName: this.readUInt32(buffer),
          dwPosition: this.readUInt32(buffer),
          fccChunk: this.readString(buffer, 4),
          dwChunkStart: this.readUInt32(buffer),
          dwBlockStart: this.readUInt32(buffer),
          dwSampleOffset: this.readUInt32(buffer),
        });
      }
    }
  }

  /**
   * Read the 'smpl' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readSmplChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('smpl');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.smpl.chunkId = chunk.chunkId;
      this.smpl.chunkSize = chunk.chunkSize;
      this.smpl.dwManufacturer = this.readUInt32(buffer);
      this.smpl.dwProduct = this.readUInt32(buffer);
      this.smpl.dwSamplePeriod = this.readUInt32(buffer);
      this.smpl.dwMIDIUnityNote = this.readUInt32(buffer);
      this.smpl.dwMIDIPitchFraction = this.readUInt32(buffer);
      this.smpl.dwSMPTEFormat = this.readUInt32(buffer);
      this.smpl.dwSMPTEOffset = this.readUInt32(buffer);
      this.smpl.dwNumSampleLoops = this.readUInt32(buffer);
      this.smpl.dwSamplerData = this.readUInt32(buffer);
      for (let i = 0; i < this.smpl.dwNumSampleLoops; i++) {
        this.smpl.loops.push({
          dwName: this.readUInt32(buffer),
          dwType: this.readUInt32(buffer),
          dwStart: this.readUInt32(buffer),
          dwEnd: this.readUInt32(buffer),
          dwFraction: this.readUInt32(buffer),
          dwPlayCount: this.readUInt32(buffer),
        });
      }
    }
  }

  /**
   * Read the 'data' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @param {boolean} samples True if the samples should be loaded.
   * @throws {Error} If no 'data' chunk is found.
   * @private
   */
  readDataChunk_(buffer, samples) {
    /** @type {?Object} */
    let chunk = this.findChunk('data');
    if (chunk) {
      this.data.chunkId = 'data';
      this.data.chunkSize = chunk.chunkSize;
      if (samples) {
        this.data.samples = buffer.slice(
          chunk.chunkData.start,
          chunk.chunkData.end);
      }
    } else {
      throw Error('Could not find the "data" chunk');
    }
  }

  /**
   * Read the 'bext' chunk of a wav file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readBextChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('bext');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.bext.chunkId = chunk.chunkId;
      this.bext.chunkSize = chunk.chunkSize;
      this.bext.description = this.readString(buffer, 256);
      this.bext.originator = this.readString(buffer, 32);
      this.bext.originatorReference = this.readString(buffer, 32);
      this.bext.originationDate = this.readString(buffer, 10);
      this.bext.originationTime = this.readString(buffer, 8);
      this.bext.timeReference = [
        this.readUInt32(buffer),
        this.readUInt32(buffer)];
      this.bext.version = this.readUInt16_(buffer);
      this.bext.UMID = this.readString(buffer, 64);
      this.bext.loudnessValue = this.readUInt16_(buffer);
      this.bext.loudnessRange = this.readUInt16_(buffer);
      this.bext.maxTruePeakLevel = this.readUInt16_(buffer);
      this.bext.maxMomentaryLoudness = this.readUInt16_(buffer);
      this.bext.maxShortTermLoudness = this.readUInt16_(buffer);
      this.bext.reserved = this.readString(buffer, 180);
      this.bext.codingHistory = this.readString(
        buffer, this.bext.chunkSize - 602);
    }
  }

  /**
   * Read the 'iXML' chunk of a wav file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readiXMLChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('iXML');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.iXML.chunkId = chunk.chunkId;
      this.iXML.chunkSize = chunk.chunkSize;
      this.iXML.value = unpackString(
        buffer, this.head, this.head + this.iXML.chunkSize);
    }
  }

  /**
   * Read the 'ds64' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @throws {Error} If no 'ds64' chunk is found and the file is RF64.
   * @private
   */
  readDs64Chunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('ds64');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this.ds64.chunkId = chunk.chunkId;
      this.ds64.chunkSize = chunk.chunkSize;
      this.ds64.riffSizeHigh = this.readUInt32(buffer);
      this.ds64.riffSizeLow = this.readUInt32(buffer);
      this.ds64.dataSizeHigh = this.readUInt32(buffer);
      this.ds64.dataSizeLow = this.readUInt32(buffer);
      this.ds64.originationTime = this.readUInt32(buffer);
      this.ds64.sampleCountHigh = this.readUInt32(buffer);
      this.ds64.sampleCountLow = this.readUInt32(buffer);
      //if (wav.ds64.chunkSize > 28) {
      //  wav.ds64.tableLength = unpack(
      //    chunkData.slice(28, 32), uInt32_);
      //  wav.ds64.table = chunkData.slice(
      //     32, 32 + wav.ds64.tableLength);
      //}
    } else {
      if (this.container == 'RF64') {
        throw Error('Could not find the "ds64" chunk');
      }
    }
  }

  /**
   * Read the 'LIST' chunks of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readLISTChunk_(buffer) {
    /** @type {?Object} */
    let listChunks = this.findChunk('LIST', true);
    if (listChunks !== null) {
      for (let j=0; j < listChunks.length; j++) {
        /** @type {!Object} */
        let subChunk = listChunks[j];
        this.LIST.push({
          chunkId: subChunk.chunkId,
          chunkSize: subChunk.chunkSize,
          format: subChunk.format,
          subChunks: []});
        for (let x=0; x<subChunk.subChunks.length; x++) {
          this.readLISTSubChunks_(subChunk.subChunks[x],
            subChunk.format, buffer);
        }
      }
    }
  }

  /**
   * Read the sub chunks of a 'LIST' chunk.
   * @param {!Object} subChunk The 'LIST' subchunks.
   * @param {string} format The 'LIST' format, 'adtl' or 'INFO'.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readLISTSubChunks_(subChunk, format, buffer) {
    if (format == 'adtl') {
      if (['labl', 'note','ltxt'].indexOf(subChunk.chunkId) > -1) {
        this.readLISTadtlSubChunks_(buffer, subChunk);
      }
    // RIFF INFO tags like ICRD, ISFT, ICMT
    } else if(format == 'INFO') {
      this.readLISTINFOSubChunks_(buffer, subChunk);
    }
  }

  /**
   * Read the sub chunks of a 'LIST' chunk of type 'adtl'.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @param {!Object} subChunk The 'LIST' subchunks.
   * @private
   */
  readLISTadtlSubChunks_(buffer, subChunk) {
    this.head = subChunk.chunkData.start;
    /** @type {!Object<string, string|number>} */
    let item = {
      chunkId: subChunk.chunkId,
      chunkSize: subChunk.chunkSize,
      dwName: this.readUInt32(buffer)
    };
    if (subChunk.chunkId == 'ltxt') {
      item.dwSampleLength = this.readUInt32(buffer);
      item.dwPurposeID = this.readUInt32(buffer);
      item.dwCountry = this.readUInt16_(buffer);
      item.dwLanguage = this.readUInt16_(buffer);
      item.dwDialect = this.readUInt16_(buffer);
      item.dwCodePage = this.readUInt16_(buffer);
      item.value = ''; // kept for compatibility
    } else {
      item.value = this.readZSTR_(buffer, this.head);
    }
    this.LIST[this.LIST.length - 1].subChunks.push(item);
  }

  /**
   * Read the sub chunks of a 'LIST' chunk of type 'INFO'.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @param {!Object} subChunk The 'LIST' subchunks.
   * @private
   */
  readLISTINFOSubChunks_(buffer, subChunk) {
    this.head = subChunk.chunkData.start;
    this.LIST[this.LIST.length - 1].subChunks.push({
      chunkId: subChunk.chunkId,
      chunkSize: subChunk.chunkSize,
      value: this.readZSTR_(buffer, this.head)
    });
  }

  /**
   * Read the 'junk' chunk of a wave file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  readJunkChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('junk');
    if (chunk) {
      this.junk = {
        chunkId: chunk.chunkId,
        chunkSize: chunk.chunkSize,
        chunkData: [].slice.call(buffer.slice(
          chunk.chunkData.start,
          chunk.chunkData.end))
      };
    }
  }

  /**
   * Read the '_PMX' chunk of a wav file.
   * @param {!Uint8Array} buffer The wav file buffer.
   * @private
   */
  read_PMXChunk_(buffer) {
    /** @type {?Object} */
    let chunk = this.findChunk('_PMX');
    if (chunk) {
      this.head = chunk.chunkData.start;
      this._PMX.chunkId = chunk.chunkId;
      this._PMX.chunkSize = chunk.chunkSize;
      this._PMX.value = unpackString(
        buffer, this.head, this.head + this._PMX.chunkSize);
    }
  }

  /**
   * Read bytes as a ZSTR string.
   * @param {!Uint8Array} bytes The bytes.
   * @param {number=} [index=0] the index to start reading.
   * @return {string} The string.
   * @private
   */
  readZSTR_(bytes, index=0) {
    for (let i = index; i < bytes.length; i++) {
      this.head++;
      if (bytes[i] === 0) {
        break;
      }
    }
    return unpackString(bytes, index, this.head - 1);
  }

  /**
   * Read a number from a chunk.
   * @param {!Uint8Array} bytes The chunk bytes.
   * @return {number} The number.
   * @private
   */
  readUInt16_(bytes) {
    /** @type {number} */
    let value = unpack(bytes, this.uInt16, this.head);
    this.head += 2;
    return value;
  }
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * Pack a string an array of bytes. If the packed string length is smaller
 * than the desired byte length the output array is filled with 0s.
 * @param {string} str The string to be written as bytes.
 * @param {number} byteLength the size of the string in bytes.
 * @return {!Array<number>} The packed string.
 */
function writeString(str, byteLength) {
  /** @type {!Array<number>} */   
  let packedString = packString(str);
  for (let i = packedString.length; i < byteLength; i++) {
    packedString.push(0);
  }
  return packedString;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to read and write wav files.
 * @extends WaveFileReader
 */
class WaveFileParser extends WaveFileReader {

  /**
   * Return a byte buffer representig the WaveFileParser object as a .wav file.
   * The return value of this method can be written straight to disk.
   * @return {!Uint8Array} A wav file.
   */
  toBuffer() {
    this.uInt16.be = this.container === 'RIFX';
    this.uInt32.be = this.uInt16.be;
    /** @type {!Array<!Array<number>>} */
    let fileBody = [
      this.getJunkBytes_(),
      this.getDs64Bytes_(),
      this.getBextBytes_(),
      this.getiXMLBytes_(),
      this.getFmtBytes_(),
      this.getFactBytes_(),
      packString(this.data.chunkId),
      pack(this.data.samples.length, this.uInt32),
      this.data.samples,
      this.getCueBytes_(),
      this.getSmplBytes_(),
      this.getLISTBytes_(),
      this.get_PMXBytes_()
    ];
    /** @type {number} */
    let fileBodyLength = 0;
    for (let i=0; i<fileBody.length; i++) {
      fileBodyLength += fileBody[i].length;
    }
    /** @type {!Uint8Array} */
    let file = new Uint8Array(fileBodyLength + 12);
    /** @type {number} */
    let index = 0;
    index = packStringTo(this.container, file, index);
    index = packTo(fileBodyLength + 4, this.uInt32, file, index);
    index = packStringTo(this.format, file, index);
    for (let i=0; i<fileBody.length; i++) {
      file.set(fileBody[i], index);
      index += fileBody[i].length;
    }
    return file;
  }

  /**
   * Return the bytes of the 'bext' chunk.
   * @private
   */
  getBextBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    this.enforceBext_();
    if (this.bext.chunkId) {
      this.bext.chunkSize = 602 + this.bext.codingHistory.length;
      bytes = bytes.concat(
        packString(this.bext.chunkId),
        pack(602 + this.bext.codingHistory.length, this.uInt32),
        writeString(this.bext.description, 256),
        writeString(this.bext.originator, 32),
        writeString(this.bext.originatorReference, 32),
        writeString(this.bext.originationDate, 10),
        writeString(this.bext.originationTime, 8),
        pack(this.bext.timeReference[0], this.uInt32),
        pack(this.bext.timeReference[1], this.uInt32),
        pack(this.bext.version, this.uInt16),
        writeString(this.bext.UMID, 64),
        pack(this.bext.loudnessValue, this.uInt16),
        pack(this.bext.loudnessRange, this.uInt16),
        pack(this.bext.maxTruePeakLevel, this.uInt16),
        pack(this.bext.maxMomentaryLoudness, this.uInt16),
        pack(this.bext.maxShortTermLoudness, this.uInt16),
        writeString(this.bext.reserved, 180),
        writeString(
          this.bext.codingHistory, this.bext.codingHistory.length));
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Make sure a 'bext' chunk is created if BWF data was created in a file.
   * @private
   */
  enforceBext_() {
    for (let prop in this.bext) {
      if (this.bext.hasOwnProperty(prop)) {
        if (this.bext[prop] && prop != 'timeReference') {
          this.bext.chunkId = 'bext';
          break;
        }
      }
    }
    if (this.bext.timeReference[0] || this.bext.timeReference[1]) {
      this.bext.chunkId = 'bext';
    }
  }

  /**
   * Return the bytes of the 'iXML' chunk.
   * @return {!Array<number>} The 'iXML' chunk bytes.
   * @private
   */
  getiXMLBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.iXML.chunkId) {
      /** @type {!Array<number>} */
      let iXMLPackedValue = packString(this.iXML.value);
      this.iXML.chunkSize = iXMLPackedValue.length;
      bytes = bytes.concat(
        packString(this.iXML.chunkId),
        pack(this.iXML.chunkSize, this.uInt32),
        iXMLPackedValue);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'ds64' chunk.
   * @return {!Array<number>} The 'ds64' chunk bytes.
   * @private
   */
  getDs64Bytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.ds64.chunkId) {
      bytes = bytes.concat(
        packString(this.ds64.chunkId),
        pack(this.ds64.chunkSize, this.uInt32),
        pack(this.ds64.riffSizeHigh, this.uInt32),
        pack(this.ds64.riffSizeLow, this.uInt32),
        pack(this.ds64.dataSizeHigh, this.uInt32),
        pack(this.ds64.dataSizeLow, this.uInt32),
        pack(this.ds64.originationTime, this.uInt32),
        pack(this.ds64.sampleCountHigh, this.uInt32),
        pack(this.ds64.sampleCountLow, this.uInt32));
    }
    //if (this.ds64.tableLength) {
    //  ds64Bytes = ds64Bytes.concat(
    //    pack(this.ds64.tableLength, this.uInt32),
    //    this.ds64.table);
    //}
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'cue ' chunk.
   * @return {!Array<number>} The 'cue ' chunk bytes.
   * @private
   */
  getCueBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.cue.chunkId) {
      /** @type {!Array<number>} */
      let cuePointsBytes = this.getCuePointsBytes_();
      bytes = bytes.concat(
        packString(this.cue.chunkId),
        pack(cuePointsBytes.length + 4, this.uInt32), // chunkSize
        pack(this.cue.dwCuePoints, this.uInt32),
        cuePointsBytes);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'cue ' points.
   * @return {!Array<number>} The 'cue ' points as an array of bytes.
   * @private
   */
  getCuePointsBytes_() {
    /** @type {!Array<number>} */
    let points = [];
    for (let i=0; i<this.cue.dwCuePoints; i++) {
      points = points.concat(
        pack(this.cue.points[i].dwName, this.uInt32),
        pack(this.cue.points[i].dwPosition, this.uInt32),
        packString(this.cue.points[i].fccChunk),
        pack(this.cue.points[i].dwChunkStart, this.uInt32),
        pack(this.cue.points[i].dwBlockStart, this.uInt32),
        pack(this.cue.points[i].dwSampleOffset, this.uInt32));
    }
    return points;
  }

  /**
   * Return the bytes of the 'smpl' chunk.
   * @return {!Array<number>} The 'smpl' chunk bytes.
   * @private
   */
  getSmplBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.smpl.chunkId) {
      /** @type {!Array<number>} */
      let smplLoopsBytes = this.getSmplLoopsBytes_();
      bytes = bytes.concat(
        packString(this.smpl.chunkId),
        pack(smplLoopsBytes.length + 36, this.uInt32), //chunkSize
        pack(this.smpl.dwManufacturer, this.uInt32),
        pack(this.smpl.dwProduct, this.uInt32),
        pack(this.smpl.dwSamplePeriod, this.uInt32),
        pack(this.smpl.dwMIDIUnityNote, this.uInt32),
        pack(this.smpl.dwMIDIPitchFraction, this.uInt32),
        pack(this.smpl.dwSMPTEFormat, this.uInt32),
        pack(this.smpl.dwSMPTEOffset, this.uInt32),
        pack(this.smpl.dwNumSampleLoops, this.uInt32),
        pack(this.smpl.dwSamplerData, this.uInt32),
        smplLoopsBytes);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'smpl' loops.
   * @return {!Array<number>} The 'smpl' loops as an array of bytes.
   * @private
   */
  getSmplLoopsBytes_() {
    /** @type {!Array<number>} */
    let loops = [];
    for (let i=0; i<this.smpl.dwNumSampleLoops; i++) {
      loops = loops.concat(
        pack(this.smpl.loops[i].dwName, this.uInt32),
        pack(this.smpl.loops[i].dwType, this.uInt32),
        pack(this.smpl.loops[i].dwStart, this.uInt32),
        pack(this.smpl.loops[i].dwEnd, this.uInt32),
        pack(this.smpl.loops[i].dwFraction, this.uInt32),
        pack(this.smpl.loops[i].dwPlayCount, this.uInt32));
    }
    return loops;
  }

  /**
   * Return the bytes of the 'fact' chunk.
   * @return {!Array<number>} The 'fact' chunk bytes.
   * @private
   */
  getFactBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.fact.chunkId) {
      bytes = bytes.concat(
        packString(this.fact.chunkId),
        pack(this.fact.chunkSize, this.uInt32),
        pack(this.fact.dwSampleLength, this.uInt32));
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'fmt ' chunk.
   * @return {!Array<number>} The 'fmt' chunk bytes.
   * @throws {Error} if no 'fmt ' chunk is present.
   * @private
   */
  getFmtBytes_() {
    /** @type {!Array<number>} */
    let fmtBytes = [];
    if (this.fmt.chunkId) {
      /** @type {!Array<number>} */
      let bytes  = fmtBytes.concat(
        packString(this.fmt.chunkId),
        pack(this.fmt.chunkSize, this.uInt32),
        pack(this.fmt.audioFormat, this.uInt16),
        pack(this.fmt.numChannels, this.uInt16),
        pack(this.fmt.sampleRate, this.uInt32),
        pack(this.fmt.byteRate, this.uInt32),
        pack(this.fmt.blockAlign, this.uInt16),
        pack(this.fmt.bitsPerSample, this.uInt16),
        this.getFmtExtensionBytes_());
      this.enforceByteLen_(bytes);
      return bytes;
    }
    throw Error('Could not find the "fmt " chunk');
  }

  /**
   * Return the bytes of the fmt extension fields.
   * @return {!Array<number>} The fmt extension bytes.
   * @private
   */
  getFmtExtensionBytes_() {
    /** @type {!Array<number>} */
    let extension = [];
    if (this.fmt.chunkSize > 16) {
      extension = extension.concat(
        pack(this.fmt.cbSize, this.uInt16));
    }
    if (this.fmt.chunkSize > 18) {
      extension = extension.concat(
        pack(this.fmt.validBitsPerSample, this.uInt16));
    }
    if (this.fmt.chunkSize > 20) {
      extension = extension.concat(
        pack(this.fmt.dwChannelMask, this.uInt32));
    }
    if (this.fmt.chunkSize > 24) {
      extension = extension.concat(
        pack(this.fmt.subformat[0], this.uInt32),
        pack(this.fmt.subformat[1], this.uInt32),
        pack(this.fmt.subformat[2], this.uInt32),
        pack(this.fmt.subformat[3], this.uInt32));
    }
    return extension;
  }

  /**
   * Return the bytes of the 'LIST' chunk.
   * @return {!Array<number>} The 'LIST' chunk bytes.
   * @private
   */
  getLISTBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    for (let i=0; i<this.LIST.length; i++) {
      /** @type {!Array<number>} */
      let subChunksBytes = this.getLISTSubChunksBytes_(
          this.LIST[i].subChunks, this.LIST[i].format);
      bytes = bytes.concat(
        packString(this.LIST[i].chunkId),
        pack(subChunksBytes.length + 4, this.uInt32), //chunkSize
        packString(this.LIST[i].format),
        subChunksBytes);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the sub chunks of a 'LIST' chunk.
   * @param {!Array<!Object>} subChunks The 'LIST' sub chunks.
   * @param {string} format The format of the 'LIST' chunk.
   *    Currently supported values are 'adtl' or 'INFO'.
   * @return {!Array<number>} The sub chunk bytes.
   * @private
   */
  getLISTSubChunksBytes_(subChunks, format) {
    /** @type {!Array<number>} */
    let bytes = [];
    for (let i = 0, len = subChunks.length; i < len; i++) {
      if (format == 'INFO') {
        bytes = bytes.concat(this.getLISTINFOSubChunksBytes_(subChunks[i]));
      } else if (format == 'adtl') {
        bytes = bytes.concat(this.getLISTadtlSubChunksBytes_(subChunks[i]));
      }
      this.enforceByteLen_(bytes);
    }
    return bytes;
  }

  /**
   * Return the bytes of the sub chunks of a 'LIST' chunk of type 'INFO'.
   * @param {!Object} subChunk The 'LIST' sub chunk.
   * @return {!Array<number>}
   * @private
   */
  getLISTINFOSubChunksBytes_(subChunk) {
    /** @type {!Array<number>} */
    let bytes = [];
    /** @type {!Array<number>} */
    let LISTsubChunkValue = writeString(
        subChunk.value, subChunk.value.length);
    bytes = bytes.concat(
      packString(subChunk.chunkId),
      pack(LISTsubChunkValue.length + 1, this.uInt32), //chunkSize
      LISTsubChunkValue);
    bytes.push(0);
    return bytes;
  }

  /**
   * Return the bytes of the sub chunks of a 'LIST' chunk of type 'INFO'.
   * @param {!Object} subChunk The 'LIST' sub chunk.
   * @return {!Array<number>}
   * @private
   */
  getLISTadtlSubChunksBytes_(subChunk) {
    /** @type {!Array<number>} */
    let bytes = [];
    if (['labl', 'note'].indexOf(subChunk.chunkId) > -1) {
      /** @type {!Array<number>} */
      let LISTsubChunkValue = writeString(
          subChunk.value,
          subChunk.value.length);
      bytes = bytes.concat(
        packString(subChunk.chunkId),
        pack(LISTsubChunkValue.length + 4 + 1, this.uInt32), //chunkSize
        pack(subChunk.dwName, this.uInt32),
        LISTsubChunkValue);
      bytes.push(0);
    } else if (subChunk.chunkId == 'ltxt') {
      bytes = bytes.concat(
        this.getLtxtChunkBytes_(subChunk));
    }
    return bytes;
  }

  /**
   * Return the bytes of a 'ltxt' chunk.
   * @param {!Object} ltxt the 'ltxt' chunk.
   * @return {!Array<number>}
   * @private
   */
  getLtxtChunkBytes_(ltxt) {
    return [].concat(
      packString(ltxt.chunkId),
      pack(ltxt.value.length + 20, this.uInt32),
      pack(ltxt.dwName, this.uInt32),
      pack(ltxt.dwSampleLength, this.uInt32),
      pack(ltxt.dwPurposeID, this.uInt32),
      pack(ltxt.dwCountry, this.uInt16),
      pack(ltxt.dwLanguage, this.uInt16),
      pack(ltxt.dwDialect, this.uInt16),
      pack(ltxt.dwCodePage, this.uInt16),
       // should always be a empty string;
       // kept for compatibility
      writeString(ltxt.value, ltxt.value.length));
  }

  /**
   * Return the bytes of the '_PMX' chunk.
   * @return {!Array<number>} The '_PMX' chunk bytes.
   * @private
   */
  get_PMXBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this._PMX.chunkId) {
      /** @type {!Array<number>} */
      let _PMXPackedValue = packString(this._PMX.value);
      this._PMX.chunkSize = _PMXPackedValue.length;
      bytes = bytes.concat(
        packString(this._PMX.chunkId),
        pack(this._PMX.chunkSize, this.uInt32),
        _PMXPackedValue);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Return the bytes of the 'junk' chunk.
   * @private
   */
  getJunkBytes_() {
    /** @type {!Array<number>} */
    let bytes = [];
    if (this.junk.chunkId) {
      return bytes.concat(
        packString(this.junk.chunkId),
        pack(this.junk.chunkData.length, this.uInt32), //chunkSize
        this.junk.chunkData);
    }
    this.enforceByteLen_(bytes);
    return bytes;
  }

  /**
   * Push a null byte into a byte array if
   * the byte count is odd.
   * @param {!Array<number>} bytes The byte array.
   * @private
   */
  enforceByteLen_(bytes) {
    if (bytes.length % 2) {
      bytes.push(0);
    }
  }
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview The interleave function.
 * @see https://github.com/rochars/wavefile
 */

/**
 * Interleave de-interleaved samples.
 * @param {!(Array|TypedArray)} samples The samples.
 * @return {!(Array|TypedArray)}
 */
function interleave(samples) {
  /** @type {!(Array|TypedArray)} */
  let finalSamples = [];
  if (samples.length > 0) {
    if (samples[0].constructor !== Number) {
      finalSamples = new Float64Array(samples[0].length * samples.length);
      for (let i = 0, len = samples[0].length, x = 0; i < len; i++) {
        for (let j = 0, subLen = samples.length; j < subLen; j++, x++) {
          finalSamples[x] = samples[j][i];
        }
      }
    } else {
      finalSamples = samples;
    }
  }
  return finalSamples;
}

/**
 * De-interleave samples into multiple channels.
 * @param {!(Array|TypedArray)} samples The samples.
 * @param {number} numChannels The number of channels to split the samples.
 * @param {Function} [OutputObject=Float64Array] The type of object to
 *   write the de-interleaved samples.
 * @return {!(Array|TypedArray)}
 */
function deInterleave(samples, numChannels, OutputObject=Float64Array) {
  /** @type {!(Array|TypedArray)} */
  let finalSamples = [];
  for (let i = 0; i < numChannels; i++) {
    finalSamples[i] = new OutputObject(samples.length / numChannels);
  }
  for (let i = 0; i < numChannels; i++) {
    for (let j = i, s = 0; j < samples.length; j+= numChannels, s++) {
      finalSamples[i][s] = samples[j];
    }
  }
  return finalSamples;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview The validateNumChannels function.
 * @see https://github.com/rochars/wavefile
 */

/**
 * Validate the number of channels in a wav file according to the
 * bit depth of the audio.
 * @param {number} channels The number of channels in the file.
 * @param {number} bits The number of bits per sample.
 * @return {boolean} True is the number of channels is valid.
 */
function validateNumChannels(channels, bits) {
  /** @type {number} */
  let blockAlign = channels * bits / 8;
  if (channels < 1 || blockAlign > 65535) {
    return false;
  }
  return true;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview The validateSampleRate function.
 * @see https://github.com/rochars/wavefile
 */

/**
 * Validate the sample rate value of a wav file according to the number of
 * channels and the bit depth of the audio.
 * @param {number} channels The number of channels in the file.
 * @param {number} bits The number of bits per sample.
 * @param {number} sampleRate The sample rate to be validated.
 * @return {boolean} True is the sample rate is valid, false otherwise.
 */
function validateSampleRate(channels, bits, sampleRate) {
  /** @type {number} */
  let byteRate = channels * (bits / 8) * sampleRate;
  if (sampleRate < 1 || byteRate > 4294967295) {
    return false;
  }
  return true;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to read, write and create wav files.
 * @extends WaveFileParser
 * @ignore
 */
class WaveFileCreator extends WaveFileParser {

  constructor() {
    super();
    /**
     * The bit depth code according to the samples.
     * @type {string}
     */
    this.bitDepth = '0';
    /**
     * @type {!{bits: number, be: boolean}}
     * @protected
     */
    this.dataType = {bits: 0, be: false};
    /**
     * Audio formats.
     * Formats not listed here should be set to 65534,
     * the code for WAVE_FORMAT_EXTENSIBLE
     * @enum {number}
     * @protected
     */
    this.WAV_AUDIO_FORMATS = {
      '4': 17,
      '8': 1,
      '8a': 6,
      '8m': 7,
      '16': 1,
      '24': 1,
      '32': 1,
      '32f': 3,
      '64': 3
    };
  }

  /**
   * Set up the WaveFileCreator object based on the arguments passed.
   * Existing chunks are reset.
   * @param {number} numChannels The number of channels.
   * @param {number} sampleRate The sample rate.
   *    Integers like 8000, 44100, 48000, 96000, 192000.
   * @param {string} bitDepthCode The audio bit depth code.
   *    One of '4', '8', '8a', '8m', '16', '24', '32', '32f', '64'
   *    or any value between '8' and '32' (like '12').
   * @param {!(Array|TypedArray)} samples The samples.
   * @param {Object=} options Optional. Used to force the container
   *    as RIFX with {'container': 'RIFX'}
   * @throws {Error} If any argument does not meet the criteria.
   */
  fromScratch(numChannels, sampleRate, bitDepthCode, samples, options) {
    options = options || {};
    // reset all chunks
    this.clearHeaders();
    this.newWavFile_(numChannels, sampleRate, bitDepthCode, samples, options);
  }

  /**
   * Set up the WaveFileParser object from a byte buffer.
   * @param {!Uint8Array} wavBuffer The buffer.
   * @param {boolean=} [samples=true] True if the samples should be loaded.
   * @throws {Error} If container is not RIFF, RIFX or RF64.
   * @throws {Error} If format is not WAVE.
   * @throws {Error} If no 'fmt ' chunk is found.
   * @throws {Error} If no 'data' chunk is found.
   */
  fromBuffer(wavBuffer, samples=true) {
    super.fromBuffer(wavBuffer, samples);
    this.bitDepthFromFmt_();
    this.updateDataType_();
  }

  /**
   * Return a byte buffer representig the WaveFileParser object as a .wav file.
   * The return value of this method can be written straight to disk.
   * @return {!Uint8Array} A wav file.
   * @throws {Error} If bit depth is invalid.
   * @throws {Error} If the number of channels is invalid.
   * @throws {Error} If the sample rate is invalid.
   */
  toBuffer() {
    this.validateWavHeader_();
    return super.toBuffer();
  }

  /**
   * Return the samples packed in a Float64Array.
   * @param {boolean=} [interleaved=false] True to return interleaved samples,
   *   false to return the samples de-interleaved.
   * @param {Function=} [OutputObject=Float64Array] The sample container.
   * @return {!(Array|TypedArray)} the samples.
   */
  getSamples(interleaved=false, OutputObject=Float64Array) {
    /**
     * A Float64Array created with a size to match the
     * the length of the samples.
     * @type {!(Array|TypedArray)}
     */
    let samples = new OutputObject(
      this.data.samples.length / (this.dataType.bits / 8));
    // Unpack all the samples
    unpackArrayTo(this.data.samples, this.dataType, samples,
      0, this.data.samples.length);
    if (!interleaved && this.fmt.numChannels > 1) {
      return deInterleave(samples, this.fmt.numChannels, OutputObject);
    }
    return samples;
  }

  /**
   * Return the sample at a given index.
   * @param {number} index The sample index.
   * @return {number} The sample.
   * @throws {Error} If the sample index is off range.
   */
  getSample(index) {
    index = index * (this.dataType.bits / 8);
    if (index + this.dataType.bits / 8 > this.data.samples.length) {
      throw new Error('Range error');
    }
    return unpack(
      this.data.samples.slice(index, index + this.dataType.bits / 8),
      this.dataType);
  }

  /**
   * Set the sample at a given index.
   * @param {number} index The sample index.
   * @param {number} sample The sample.
   * @throws {Error} If the sample index is off range.
   */
  setSample(index, sample) {
    index = index * (this.dataType.bits / 8);
    if (index + this.dataType.bits / 8 > this.data.samples.length) {
      throw new Error('Range error');
    }
    packTo(sample, this.dataType, this.data.samples, index);
  }

  /**
   * Return the value of the iXML chunk.
   * @return {string} The contents of the iXML chunk.
   */
  getiXML() {
    return this.iXML.value;
  }

  /**
   * Set the value of the iXML chunk.
   * @param {string} iXMLValue The value for the iXML chunk.
   * @throws {TypeError} If the value is not a string.
   */
  setiXML(iXMLValue) {
    if (typeof iXMLValue !== 'string') {
      throw new TypeError('iXML value must be a string.');
    }
    this.iXML.value = iXMLValue;
    this.iXML.chunkId = 'iXML';
  }

  /**
   * Get the value of the _PMX chunk.
   * @return {string} The contents of the _PMX chunk.
   */
  get_PMX() {
    return this._PMX.value;
  }

  /**
   * Set the value of the _PMX chunk.
   * @param {string} _PMXValue The value for the _PMX chunk.
   * @throws {TypeError} If the value is not a string.
   */
  set_PMX(_PMXValue) {
    if (typeof _PMXValue !== 'string') {
      throw new TypeError('_PMX value must be a string.');
    }
    this._PMX.value = _PMXValue;
    this._PMX.chunkId = '_PMX';
  }

  /**
   * Set up the WaveFileCreator object based on the arguments passed.
   * @param {number} numChannels The number of channels.
   * @param {number} sampleRate The sample rate.
   *   Integers like 8000, 44100, 48000, 96000, 192000.
   * @param {string} bitDepthCode The audio bit depth code.
   *   One of '4', '8', '8a', '8m', '16', '24', '32', '32f', '64'
   *   or any value between '8' and '32' (like '12').
   * @param {!(Array|TypedArray)} samples The samples.
   * @param {Object} options Used to define the container.
   * @throws {Error} If any argument does not meet the criteria.
   * @private
   */
  newWavFile_(numChannels, sampleRate, bitDepthCode, samples, options) {
    if (!options.container) {
      options.container = 'RIFF';
    }
    this.container = options.container;
    this.bitDepth = bitDepthCode;
    samples = interleave(samples);
    this.updateDataType_();
    /** @type {number} */
    let numBytes = this.dataType.bits / 8;
    this.data.samples = new Uint8Array(samples.length * numBytes);
    packArrayTo(samples, this.dataType, this.data.samples, 0);
    this.makeWavHeader_(
      bitDepthCode, numChannels, sampleRate,
      numBytes, this.data.samples.length, options);
    this.data.chunkId = 'data';
    this.data.chunkSize = this.data.samples.length;
    this.validateWavHeader_();
  }

  /**
   * Define the header of a wav file.
   * @param {string} bitDepthCode The audio bit depth
   * @param {number} numChannels The number of channels
   * @param {number} sampleRate The sample rate.
   * @param {number} numBytes The number of bytes each sample use.
   * @param {number} samplesLength The length of the samples in bytes.
   * @param {!Object} options The extra options, like container defintion.
   * @private
   */
  makeWavHeader_(
    bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options) {
    if (bitDepthCode == '4') {
      this.createADPCMHeader_(
        bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);

    } else if (bitDepthCode == '8a' || bitDepthCode == '8m') {
      this.createALawMulawHeader_(
        bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);

    } else if(Object.keys(this.WAV_AUDIO_FORMATS).indexOf(bitDepthCode) == -1 ||
        numChannels > 2) {
      this.createExtensibleHeader_(
        bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);

    } else {
      this.createPCMHeader_(
        bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);      
    }
  }

  /**
   * Create the header of a linear PCM wave file.
   * @param {string} bitDepthCode The audio bit depth
   * @param {number} numChannels The number of channels
   * @param {number} sampleRate The sample rate.
   * @param {number} numBytes The number of bytes each sample use.
   * @param {number} samplesLength The length of the samples in bytes.
   * @param {!Object} options The extra options, like container defintion.
   * @private
   */
  createPCMHeader_(
    bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options) {
    this.container = options.container;
    this.chunkSize = 36 + samplesLength;
    this.format = 'WAVE';
    this.bitDepth = bitDepthCode;
    this.fmt = {
      chunkId: 'fmt ',
      chunkSize: 16,
      audioFormat: this.WAV_AUDIO_FORMATS[bitDepthCode] || 65534,
      numChannels: numChannels,
      sampleRate: sampleRate,
      byteRate: (numChannels * numBytes) * sampleRate,
      blockAlign: numChannels * numBytes,
      bitsPerSample: parseInt(bitDepthCode, 10),
      cbSize: 0,
      validBitsPerSample: 0,
      dwChannelMask: 0,
      subformat: []
    };
  }

  /**
   * Create the header of a ADPCM wave file.
   * @param {string} bitDepthCode The audio bit depth
   * @param {number} numChannels The number of channels
   * @param {number} sampleRate The sample rate.
   * @param {number} numBytes The number of bytes each sample use.
   * @param {number} samplesLength The length of the samples in bytes.
   * @param {!Object} options The extra options, like container defintion.
   * @private
   */
  createADPCMHeader_(
    bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options) {
    this.createPCMHeader_(
      bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);
    this.chunkSize = 40 + samplesLength;
    this.fmt.chunkSize = 20;
    this.fmt.byteRate = 4055;
    this.fmt.blockAlign = 256;
    this.fmt.bitsPerSample = 4;
    this.fmt.cbSize = 2;
    this.fmt.validBitsPerSample = 505;
    this.fact = {
      chunkId: 'fact',
      chunkSize: 4,
      dwSampleLength: samplesLength * 2
    };
  }

  /**
   * Create the header of WAVE_FORMAT_EXTENSIBLE file.
   * @param {string} bitDepthCode The audio bit depth
   * @param {number} numChannels The number of channels
   * @param {number} sampleRate The sample rate.
   * @param {number} numBytes The number of bytes each sample use.
   * @param {number} samplesLength The length of the samples in bytes.
   * @param {!Object} options The extra options, like container defintion.
   * @private
   */
  createExtensibleHeader_(
      bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options) {
    this.createPCMHeader_(
      bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);
    this.chunkSize = 36 + 24 + samplesLength;
    this.fmt.chunkSize = 40;
    this.fmt.bitsPerSample = ((parseInt(bitDepthCode, 10) - 1) | 7) + 1;
    this.fmt.cbSize = 22;
    this.fmt.validBitsPerSample = parseInt(bitDepthCode, 10);
    this.fmt.dwChannelMask = dwChannelMask_(numChannels);
    // subformat 128-bit GUID as 4 32-bit values
    // only supports uncompressed integer PCM samples
    this.fmt.subformat = [1, 1048576, 2852126848, 1905997824];
  }

  /**
   * Create the header of mu-Law and A-Law wave files.
   * @param {string} bitDepthCode The audio bit depth
   * @param {number} numChannels The number of channels
   * @param {number} sampleRate The sample rate.
   * @param {number} numBytes The number of bytes each sample use.
   * @param {number} samplesLength The length of the samples in bytes.
   * @param {!Object} options The extra options, like container defintion.
   * @private
   */
  createALawMulawHeader_(
      bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options) {
    this.createPCMHeader_(
      bitDepthCode, numChannels, sampleRate, numBytes, samplesLength, options);
    this.chunkSize = 40 + samplesLength;
    this.fmt.chunkSize = 20;
    this.fmt.cbSize = 2;
    this.fmt.validBitsPerSample = 8;
    this.fact = {
      chunkId: 'fact',
      chunkSize: 4,
      dwSampleLength: samplesLength
    };
  }

  /**
   * Set the string code of the bit depth based on the 'fmt ' chunk.
   * @private
   */
  bitDepthFromFmt_() {
    if (this.fmt.audioFormat === 3 && this.fmt.bitsPerSample === 32) {
      this.bitDepth = '32f';
    } else if (this.fmt.audioFormat === 6) {
      this.bitDepth = '8a';
    } else if (this.fmt.audioFormat === 7) {
      this.bitDepth = '8m';
    } else {
      this.bitDepth = this.fmt.bitsPerSample.toString();
    }
  }

  /**
   * Validate the bit depth.
   * @return {boolean} True is the bit depth is valid.
   * @throws {Error} If bit depth is invalid.
   * @private
   */
  validateBitDepth_() {
    if (!this.WAV_AUDIO_FORMATS[this.bitDepth]) {
      if (parseInt(this.bitDepth, 10) > 8 &&
          parseInt(this.bitDepth, 10) < 54) {
        return true;
      }
      throw new Error('Invalid bit depth.');
    }
    return true;
  }

  /**
   * Update the type definition used to read and write the samples.
   * @private
   */
  updateDataType_() {
    this.dataType = {
      bits: ((parseInt(this.bitDepth, 10) - 1) | 7) + 1,
      fp: this.bitDepth == '32f' || this.bitDepth == '64',
      signed: this.bitDepth != '8',
      be: this.container == 'RIFX'
    };
    if (['4', '8a', '8m'].indexOf(this.bitDepth) > -1 ) {
      this.dataType.bits = 8;
      this.dataType.signed = false;
    }
  }

  /**
   * Validate the header of the file.
   * @throws {Error} If bit depth is invalid.
   * @throws {Error} If the number of channels is invalid.
   * @throws {Error} If the sample rate is invalid.
   * @ignore
   * @private
   */
  validateWavHeader_() {
    this.validateBitDepth_();
    if (!validateNumChannels(this.fmt.numChannels, this.fmt.bitsPerSample)) {
      throw new Error('Invalid number of channels.');
    }
    if (!validateSampleRate(
        this.fmt.numChannels, this.fmt.bitsPerSample, this.fmt.sampleRate)) {
      throw new Error('Invalid sample rate.');
    }
  }
}

/**
 * Return the value for dwChannelMask according to the number of channels.
 * @param {number} numChannels the number of channels.
 * @return {number} the dwChannelMask value.
 * @private
 */
function dwChannelMask_(numChannels) {
  /** @type {number} */
  let mask = 0;
  // mono = FC
  if (numChannels === 1) {
    mask = 0x4;
  // stereo = FL, FR
  } else if (numChannels === 2) {
    mask = 0x3;
  // quad = FL, FR, BL, BR
  } else if (numChannels === 4) {
    mask = 0x33;
  // 5.1 = FL, FR, FC, LF, BL, BR
  } else if (numChannels === 6) {
    mask = 0x3F;
  // 7.1 = FL, FR, FC, LF, BL, BR, SL, SR
  } else if (numChannels === 8) {
    mask = 0x63F;
  }
  return mask;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to edit meta information in wav files.
 * @extends WaveFileCreator
 * @ignore
 */
class WaveFileTagEditor extends WaveFileCreator {

  /**
   * Return the value of a RIFF tag in the INFO chunk.
   * @param {string} tag The tag name.
   * @return {?string} The value if the tag is found, null otherwise.
   */
  getTag(tag) {
    /** @type {!Object} */
    let index = this.getTagIndex_(tag);
    if (index.TAG !== null) {
      return this.LIST[index.LIST].subChunks[index.TAG].value;
    }
    return null;
  }

  /**
   * Write a RIFF tag in the INFO chunk. If the tag do not exist,
   * then it is created. It if exists, it is overwritten.
   * @param {string} tag The tag name.
   * @param {string} value The tag value.
   * @throws {Error} If the tag name is not valid.
   */
  setTag(tag, value) {
    tag = fixRIFFTag_(tag);
    /** @type {!Object} */
    let index = this.getTagIndex_(tag);
    if (index.TAG !== null) {
      this.LIST[index.LIST].subChunks[index.TAG].chunkSize =
        value.length + 1;
      this.LIST[index.LIST].subChunks[index.TAG].value = value;
    } else if (index.LIST !== null) {
      this.LIST[index.LIST].subChunks.push({
        chunkId: tag,
        chunkSize: value.length + 1,
        value: value});
    } else {
      this.LIST.push({
        chunkId: 'LIST',
        chunkSize: 8 + value.length + 1,
        format: 'INFO',
        subChunks: []});
      this.LIST[this.LIST.length - 1].subChunks.push({
        chunkId: tag,
        chunkSize: value.length + 1,
        value: value});
    }
  }

  /**
   * Remove a RIFF tag from the INFO chunk.
   * @param {string} tag The tag name.
   * @return {boolean} True if a tag was deleted.
   */
  deleteTag(tag) {
    /** @type {!Object} */
    let index = this.getTagIndex_(tag);
    if (index.TAG !== null) {
      this.LIST[index.LIST].subChunks.splice(index.TAG, 1);
      return true;
    }
    return false;
  }

  /**
   * Return a Object<tag, value> with the RIFF tags in the file.
   * @return {!Object<string, string>} The file tags.
   */
  listTags() {
    /** @type {?number} */
    let index = this.getLISTIndex('INFO');
    /** @type {!Object} */
    let tags = {};
    if (index !== null) {
      for (let i = 0, len = this.LIST[index].subChunks.length; i < len; i++) {
        tags[this.LIST[index].subChunks[i].chunkId] =
          this.LIST[index].subChunks[i].value;
      }
    }
    return tags;
  }

  /**
   * Return the index of a list by its type.
   * @param {string} listType The list type ('adtl', 'INFO')
   * @return {?number}
   * @protected
   */
  getLISTIndex(listType) {
    for (let i = 0, len = this.LIST.length; i < len; i++) {
      if (this.LIST[i].format == listType) {
        return i;
      }
    }
    return null;
  }

  /**
   * Return the index of a tag in a FILE chunk.
   * @param {string} tag The tag name.
   * @return {!Object<string, ?number>}
   *    Object.LIST is the INFO index in LIST
   *    Object.TAG is the tag index in the INFO
   * @private
   */
  getTagIndex_(tag) {
    /** @type {!Object<string, ?number>} */
    let index = {LIST: null, TAG: null};
    for (let i = 0, len = this.LIST.length; i < len; i++) {
      if (this.LIST[i].format == 'INFO') {
        index.LIST = i;
        for (let j=0, subLen = this.LIST[i].subChunks.length; j < subLen; j++) {
          if (this.LIST[i].subChunks[j].chunkId == tag) {
            index.TAG = j;
            break;
          }
        }
        break;
      }
    }
    return index;
  }
}

/**
 * Fix a RIFF tag format if possible, throw an error otherwise.
 * @param {string} tag The tag name.
 * @return {string} The tag name in proper fourCC format.
 * @private
 */
function fixRIFFTag_(tag) {
  if (tag.constructor !== String) {
    throw new Error('Invalid tag name.');
  } else if (tag.length < 4) {
    for (let i = 0, len = 4 - tag.length; i < len; i++) {
      tag += ' ';
    }
  }
  return tag;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to edit meta information in wav files.
 * @extends WaveFileTagEditor
 * @ignore
 */
class WaveFileCueEditor extends WaveFileTagEditor {

  /**
   * Return an array with all cue points in the file, in the order they appear
   * in the file.
   * Objects representing cue points/regions look like this:
   *   {
   *     position: 500, // the position in milliseconds
   *     label: 'cue marker 1',
   *     end: 1500, // the end position in milliseconds
   *     dwName: 1,
   *     dwPosition: 0,
   *     fccChunk: 'data',
   *     dwChunkStart: 0,
   *     dwBlockStart: 0,
   *     dwSampleOffset: 22050, // the position as a sample offset
   *     dwSampleLength: 3646827, // length as a sample count, 0 if not a region
   *     dwPurposeID: 544106354,
   *     dwCountry: 0,
   *     dwLanguage: 0,
   *     dwDialect: 0,
   *     dwCodePage: 0,
   *   }
   * @return {!Array<Object>}
   */
  listCuePoints() {
    /** @type {!Array<!Object>} */
    let points = this.getCuePoints_();
    for (let i = 0, len = points.length; i < len; i++) {

      // Add attrs that should exist in the object
      points[i].position =
        (points[i].dwSampleOffset / this.fmt.sampleRate) * 1000;

      // If it is a region, calc the end
      // position in milliseconds
      if (points[i].dwSampleLength) {
        points[i].end =
          (points[i].dwSampleLength / this.fmt.sampleRate) * 1000;
        points[i].end += points[i].position;
      // If its not a region, end should be null
      } else {
        points[i].end = null;
      }

      // Remove attrs that should not go in the results
      delete points[i].value;
    }
    return points;
  }

  /**
   * Create a cue point in the wave file.
   * @param {!{
   *   position: number,
   *   label: ?string,
   *   end: ?number,
   *   dwPurposeID: ?number,
   *   dwCountry: ?number,
   *   dwLanguage: ?number,
   *   dwDialect: ?number,
   *   dwCodePage: ?number
   * }} pointData A object with the data of the cue point.
   *
   * # Only required attribute to create a cue point:
   * pointData.position: The position of the point in milliseconds
   *
   * # Optional attribute for cue points:
   * pointData.label: A string label for the cue point
   *
   * # Extra data used for regions
   * pointData.end: A number representing the end of the region,
   *   in milliseconds, counting from the start of the file. If
   *   no end attr is specified then no region is created.
   *
   * # You may also specify the following attrs for regions, all optional:
   * pointData.dwPurposeID
   * pointData.dwCountry
   * pointData.dwLanguage
   * pointData.dwDialect
   * pointData.dwCodePage
   */
  setCuePoint(pointData) {
    this.cue.chunkId = 'cue ';

    // label attr should always exist
    if (!pointData.label) {
      pointData.label = '';
    }

    /**
     * Load the existing points before erasing
     * the LIST 'adtl' chunk and the cue attr
     * @type {!Array<!Object>}
     */
    let existingPoints = this.getCuePoints_();

    // Clear any LIST labeled 'adtl'
    // The LIST chunk should be re-written
    // after the new cue point is created
    this.clearLISTadtl_();

    // Erase this.cue so it can be re-written
    // after the point is added
    this.cue.points = [];

    /**
     * Cue position param is informed in milliseconds,
     * here its value is converted to the sample offset
     * @type {number}
     */
    pointData.dwSampleOffset =
      (pointData.position * this.fmt.sampleRate) / 1000;
    /**
     * end param is informed in milliseconds, counting
     * from the start of the file.
     * here its value is converted to the sample length
     * of the region.
     * @type {number}
     */
    pointData.dwSampleLength = 0;
    if (pointData.end) {
      pointData.dwSampleLength = 
        ((pointData.end * this.fmt.sampleRate) / 1000) -
        pointData.dwSampleOffset;
    }

    // If there were no cue points in the file,
    // insert the new cue point as the first
    if (existingPoints.length === 0) {
      this.setCuePoint_(pointData, 1);

    // If the file already had cue points, This new one
    // must be added in the list according to its position.
    } else {
      this.setCuePointInOrder_(existingPoints, pointData);
    }
    this.cue.dwCuePoints = this.cue.points.length;
  }

  /**
   * Remove a cue point from a wave file.
   * @param {number} index the index of the point. First is 1,
   *    second is 2, and so on.
   */
  deleteCuePoint(index) {
    this.cue.chunkId = 'cue ';
    /** @type {!Array<!Object>} */
    let existingPoints = this.getCuePoints_();
    this.clearLISTadtl_();
    /** @type {number} */
    let len = this.cue.points.length;
    this.cue.points = [];
    for (let i = 0; i < len; i++) {
      if (i + 1 !== index) {
        this.setCuePoint_(existingPoints[i], i + 1);
      }
    }
    this.cue.dwCuePoints = this.cue.points.length;
    if (this.cue.dwCuePoints) {
      this.cue.chunkId = 'cue ';
    } else {
      this.cue.chunkId = '';
      this.clearLISTadtl_();
    }
  }

  /**
   * Update the label of a cue point.
   * @param {number} pointIndex The ID of the cue point.
   * @param {string} label The new text for the label.
   */
  updateLabel(pointIndex, label) {
    /** @type {?number} */
    let cIndex = this.getLISTIndex('adtl');
    if (cIndex !== null) {
      for (let i = 0, len = this.LIST[cIndex].subChunks.length; i < len; i++) {
        if (this.LIST[cIndex].subChunks[i].dwName ==
            pointIndex) {
          this.LIST[cIndex].subChunks[i].value = label;
        }
      }
    }
  }

  /**
   * Return an array with all cue points in the file, in the order they appear
   * in the file.
   * @return {!Array<!Object>}
   * @private
   */
  getCuePoints_() {
    /** @type {!Array<!Object>} */
    let points = [];
    for (let i = 0; i < this.cue.points.length; i++) {
      /** @type {!Object} */
      let chunk = this.cue.points[i];
      /** @type {!Object} */
      let pointData = this.getDataForCuePoint_(chunk.dwName);
      pointData.label = pointData.value ? pointData.value : '';
      pointData.dwPosition = chunk.dwPosition;
      pointData.fccChunk = chunk.fccChunk;
      pointData.dwChunkStart = chunk.dwChunkStart;
      pointData.dwBlockStart = chunk.dwBlockStart;
      pointData.dwSampleOffset = chunk.dwSampleOffset;
      points.push(pointData);
    }
    return points;
  }

  /**
   * Return the associated data of a cue point.
   * @param {number} pointDwName The ID of the cue point.
   * @return {!Object}
   * @private
   */
  getDataForCuePoint_(pointDwName) {
    /** @type {?number} */
    let LISTindex = this.getLISTIndex('adtl');
    /** @type {!Object} */
    let pointData = {};
    // If there is a adtl LIST in the file, look for
    // LIST subchunks with data referencing this point
    if (LISTindex !== null) {
      this.getCueDataFromLIST_(pointData, LISTindex, pointDwName);
    }
    return pointData;
  }

  /**
   * Get all data associated to a cue point in a LIST chunk.
   * @param {!Object} pointData A object to hold the point data.
   * @param {number} index The index of the adtl LIST chunk.
   * @param {number} pointDwName The ID of the cue point.
   * @private
   */
  getCueDataFromLIST_(pointData, index, pointDwName) {
    // got through all chunks in the adtl LIST checking
    // for references to this cue point
    for (let i = 0, len = this.LIST[index].subChunks.length; i < len; i++) {
      if (this.LIST[index].subChunks[i].dwName == pointDwName) {
        /** @type {!Object} */
        let chunk = this.LIST[index].subChunks[i];
        // Some chunks may reference the point but
        // have a empty text; this is to ensure that if
        // one chunk that reference the point has a text,
        // this value will be kept as the associated data label
        // for the cue point.
        // If different values are present, the last value found
        // will be considered the label for the cue point.
        pointData.value = chunk.value || pointData.value;
        pointData.dwName = chunk.dwName || 0;
        pointData.dwSampleLength = chunk.dwSampleLength || 0;
        pointData.dwPurposeID = chunk.dwPurposeID || 0;
        pointData.dwCountry = chunk.dwCountry || 0;
        pointData.dwLanguage = chunk.dwLanguage || 0;
        pointData.dwDialect = chunk.dwDialect || 0;
        pointData.dwCodePage = chunk.dwCodePage || 0;
      }
    }
  }

  /**
   * Push a new cue point in this.cue.points.
   * @param {!Object} pointData A object with data of the cue point.
   * @param {number} dwName the dwName of the cue point
   * @private
   */
  setCuePoint_(pointData, dwName) {
    this.cue.points.push({
      dwName: dwName,
      dwPosition: pointData.dwPosition ? pointData.dwPosition : 0,
      fccChunk: pointData.fccChunk ? pointData.fccChunk : 'data',
      dwChunkStart: pointData.dwChunkStart ? pointData.dwChunkStart : 0,
      dwBlockStart: pointData.dwBlockStart ? pointData.dwBlockStart : 0,
      dwSampleOffset: pointData.dwSampleOffset
    });
    this.setLabl_(pointData, dwName);
  }

  /**
   * Push a new cue point in this.cue.points according to existing cue points.
   * @param {!Array} existingPoints Array with the existing points.
   * @param {!Object} pointData A object with data of the cue point.
   * @private
   */
  setCuePointInOrder_(existingPoints, pointData) {
    /** @type {boolean} */
    let hasSet = false;

    // Iterate over the cue points that existed
    // before this one was added
    for (let i = 0; i < existingPoints.length; i++) {

      // If the new point is located before this original point
      // and the new point have not been created, create the
      // new point and then the original point
      if (existingPoints[i].dwSampleOffset > 
        pointData.dwSampleOffset && !hasSet) {
        // create the new point
        this.setCuePoint_(pointData, i + 1);

        // create the original point
        this.setCuePoint_(existingPoints[i], i + 2);
        hasSet = true;

      // Otherwise, re-create the original point
      } else {
        this.setCuePoint_(existingPoints[i], hasSet ? i + 2 : i + 1);
      }
    }
    // If no point was created in the above loop,
    // create the new point as the last one
    if (!hasSet) {
      this.setCuePoint_(pointData, this.cue.points.length + 1);
    }
  }

  /**
   * Clear any LIST chunk labeled as 'adtl'.
   * @private
   */
  clearLISTadtl_() {
    for (let i = 0, len = this.LIST.length; i < len; i++) {
      if (this.LIST[i].format == 'adtl') {
        this.LIST.splice(i);
      }
    }
  }

  /**
   * Create a new 'labl' subchunk in a 'LIST' chunk of type 'adtl'.
   * This method creates a LIST adtl chunk in the file if one
   * is not present.
   * @param {!Object} pointData A object with data of the cue point.
   * @param {number} dwName The ID of the cue point.
   * @private
   */
  setLabl_(pointData, dwName) {
    /**
     * Get the index of the LIST chunk labeled as adtl.
     * A file can have many LIST chunks with unique labels.
     * @type {?number}
     */
    let adtlIndex = this.getLISTIndex('adtl');
    // If there is no adtl LIST, create one
    if (adtlIndex === null) {
      // Include a new item LIST chunk
      this.LIST.push({
        chunkId: 'LIST',
        chunkSize: 4,
        format: 'adtl',
        subChunks: []});
      // Get the index of the new LIST chunk
      adtlIndex = this.LIST.length - 1;
    }
    this.setLabelText_(adtlIndex, pointData, dwName);
    if (pointData.dwSampleLength) {
      this.setLtxtChunk_(adtlIndex, pointData, dwName);
    }
  }

  /**
   * Create a new 'labl' subchunk in a 'LIST' chunk of type 'adtl'.
   * @param {number} adtlIndex The index of the 'adtl' LIST in this.LIST.
   * @param {!Object} pointData A object with data of the cue point.
   * @param {number} dwName The ID of the cue point.
   * @private
   */
  setLabelText_(adtlIndex, pointData, dwName) {
    this.LIST[adtlIndex].subChunks.push({
      chunkId: 'labl',
      chunkSize: 4, // should be 4 + label length in bytes
      dwName: dwName,
      value: pointData.label
    });
    this.LIST[adtlIndex].chunkSize += 12; // should be 4 + label byte length
  }
  /**
   * Create a new 'ltxt' subchunk in a 'LIST' chunk of type 'adtl'.
   * @param {number} adtlIndex The index of the 'adtl' LIST in this.LIST.
   * @param {!Object} pointData A object with data of the cue point.
   * @param {number} dwName The ID of the cue point.
   * @private
   */
  setLtxtChunk_(adtlIndex, pointData, dwName) {
    this.LIST[adtlIndex].subChunks.push({
      chunkId: 'ltxt',
      chunkSize: 20,  // should be 12 + label byte length
      dwName: dwName,
      dwSampleLength: pointData.dwSampleLength,
      dwPurposeID: pointData.dwPurposeID || 0,
      dwCountry: pointData.dwCountry || 0,
      dwLanguage: pointData.dwLanguage || 0,
      dwDialect: pointData.dwDialect || 0,
      dwCodePage: pointData.dwCodePage || 0,
      value: pointData.label // kept for compatibility
    });
    this.LIST[adtlIndex].chunkSize += 28;
  }
}

/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 * Copyright 2012 Spencer Cohen
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview The Interpolator class. Based on Smooth.js by Spencer Cohen.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/osuushi/Smooth.js
 */

/**
 * A class to get scaled values out of arrays.
 * @extends WaveFileReader
 */
class Interpolator {
  
  /**
   * @param {number} scaleFrom the length of the original array.
   * @param {number} scaleTo The length of the new array.
   * @param {!Object} details The extra configuration, if needed.
   */
  constructor(scaleFrom, scaleTo, details) {
    /**
     * The length of the original array.
     * @type {number}
     */
    this.length_ = scaleFrom;
    /**
     * The scaling factor.
     * @type {number}
     */
    this.scaleFactor_ = (scaleFrom - 1) / scaleTo;
    /**
     * The interpolation function.
     * @type {Function}
     */
    this.interpolate = this.sinc;
    if (details.method === 'point') {
    	this.interpolate = this.point;
    } else if(details.method === 'linear') {
    	this.interpolate = this.linear;
    } else if(details.method === 'cubic') {
    	this.interpolate = this.cubic;
    }
    /**
     * The tanget factor for cubic interpolation.
     * @type {number}
     */
    this.tangentFactor_ = 1 - Math.max(0, Math.min(1, details.tension || 0));
    // Configure the kernel for sinc
    /**
     * The sinc filter size.
     * @type {number}
     */
    this.sincFilterSize_ = details.sincFilterSize || 1;
    /**
     * The sinc kernel.
     * @type {Function}
     */
    this.kernel_ = sincKernel_(details.sincWindow || window_);
  }

  /**
   * @param {number} t The index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The interpolated value.
   */
  point(t, samples) {
    return this.getClippedInput_(Math.round(this.scaleFactor_ * t), samples);
  }

  /**
   * @param {number} t The index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The interpolated value.
   */
  linear(t, samples) {
    t = this.scaleFactor_ * t;
    /** @type {number} */
    let k = Math.floor(t);
    t -= k;
    return (1 - t) *
    	this.getClippedInput_(k, samples) + t *
    	this.getClippedInput_(k + 1, samples);
  }

  /**
   * @param {number} t The index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The interpolated value.
   */
  cubic(t, samples) {
    t = this.scaleFactor_ * t;
    /** @type {number} */
    let k = Math.floor(t);
    /** @type {Array<number>} */
    let m = [this.getTangent_(k, samples), this.getTangent_(k + 1, samples)];
    /** @type {Array<number>} */
    let p = [this.getClippedInput_(k, samples),
      this.getClippedInput_(k + 1, samples)];
    t -= k;
    /** @type {number} */
    let t2 = t * t;
    /** @type {number} */
    let t3 = t * t2;
    return (2 * t3 - 3 * t2 + 1) *
      p[0] + (t3 - 2 * t2 + t) *
      m[0] + (-2 * t3 + 3 * t2) *
      p[1] + (t3 - t2) * m[1];
  }

  /**
   * @param {number} t The index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The interpolated value.
   */
  sinc(t, samples) {
    t = this.scaleFactor_ * t;
    /** @type {number} */
    let k = Math.floor(t);
    /** @type {number} */
    let ref = k - this.sincFilterSize_ + 1;
    /** @type {number} */
    let ref1 = k + this.sincFilterSize_;
    /** @type {number} */
    let sum = 0;
    for (let n = ref; n <= ref1; n++) {
      sum += this.kernel_(t - n) * this.getClippedInput_(n, samples);
    }
    return sum;
  }

  /**
   * @param {number} k The scaled index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The tangent.
   * @private
   */
  getTangent_(k, samples) {
    return this.tangentFactor_ *
      (this.getClippedInput_(k + 1, samples) -
        this.getClippedInput_(k - 1, samples)) / 2;
  }

  /**
   * @param {number} t The scaled index to interpolate.
   * @param {Array<number>|TypedArray} samples the original array.
   * @return {number} The interpolated value.
   * @private
   */
  getClippedInput_(t, samples) {
    if ((0 <= t && t < this.length_)) {
      return samples[t];
    }
    return 0;
  }
}

/**
 * The default window function.
 * @param {number} x The sinc signal.
 * @return {number}
 * @private
 */
function window_(x) {
  return Math.exp(-x / 2 * x / 2);
}

/**
 * @param {Function} window The window function.
 * @return {Function}
 * @private
 */
function sincKernel_(window) {
  return function(x) { return sinc_(x) * window(x); };
}

/**
 * @param {number} x The sinc signal.
 * @return {number}
 * @private
 */
function sinc_(x) {
  if (x === 0) {
    return 1;
  }
  return Math.sin(Math.PI * x) / (Math.PI * x);
}

/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 * Copyright (c) 2014 Florian Markert
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview FIR LPF. Based on the FIR LPF from Fili by Florian Markert.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/markert/fili.js
 */

/**
 * A FIR low pass filter.
 */
class FIRLPF {
  
  /**
   * @param {number} order The order of the filter.
   * @param {number} sampleRate The sample rate.
   * @param {number} cutOff The cut off frequency.
   */
  constructor(order, sampleRate, cutOff) {
    /** @type {number} */
    let omega = 2 * Math.PI * cutOff / sampleRate;
    /** @type {number} */
    let dc = 0;
    this.filters = [];
    for (let i = 0; i <= order; i++) {
      if (i - order / 2 === 0) {
        this.filters[i] = omega;
      } else {
        this.filters[i] = Math.sin(omega * (i - order / 2)) / (i - order / 2);
        // Hamming window
        this.filters[i] *= (0.54 - 0.46 * Math.cos(2 * Math.PI * i / order));
      }
      dc = dc + this.filters[i];
    }
    // normalize
    for (let i = 0; i <= order; i++) {
      this.filters[i] /= dc;
    }
    this.z = this.initZ_();
  }

  /**
   * @param {number} sample A sample of a sequence.
   * @return {number}
   */
  filter(sample) {
    this.z.buf[this.z.pointer] = sample;
    /** @type {number} */
    let out = 0;
    for (let i = 0, len = this.z.buf.length; i < len; i++) {
      out += (
        this.filters[i] * this.z.buf[(this.z.pointer + i) % this.z.buf.length]);
    }
    this.z.pointer = (this.z.pointer + 1) % (this.z.buf.length);
    return out;
  }

  /**
   * Reset the filter.
   */
  reset() {
    this.z = this.initZ_();
  }

  /**
   * Return the default value for z.
   * @private
   */
  initZ_() {
    /** @type {!Array} */
    let r = [];
    for (let i = 0; i < this.filters.length - 1; i++) {
      r.push(0);
    }
    return {
      buf: r,
      pointer: 0
    };
  }
}

/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 * Copyright (c) 2014 Florian Markert
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

/**
 * @fileoverview Butterworth LPF. Based on the Butterworth LPF from Fili.js.
 * @see https://github.com/rochars/wavefile
 * @see https://github.com/markert/fili.js
 */

/**
 * Butterworth LPF.
 */
class ButterworthLPF {
  
  /**
   * @param {number} order The order of the filter.
   * @param {number} sampleRate The sample rate.
   * @param {number} cutOff The cut off frequency.
   */
  constructor(order, sampleRate, cutOff) {
    /** @type {!Array} */
    let filters = [];
    for (let i = 0; i < order; i++) {
      filters.push(this.getCoeffs_({
        Fs: sampleRate,
        Fc: cutOff,
        Q: 0.5 / (Math.sin((Math.PI / (order * 2)) * (i + 0.5)))
      }));
    }
    this.stages = [];
    for (let i = 0; i < filters.length; i++) {
      this.stages[i] = {
        b0 : filters[i].b[0],
        b1 : filters[i].b[1],
        b2 : filters[i].b[2],
        a1 : filters[i].a[0],
        a2 : filters[i].a[1],
        k : filters[i].k,
        z : [0, 0]
      };
    }
  }

  /**
   * @param {number} sample A sample of a sequence.
   * @return {number}
   */
  filter(sample) {
    /** @type {number} */
    let out = sample;
    for (let i = 0, len = this.stages.length; i < len; i++) {
      out = this.runStage_(i, out);
    }
    return out;
  }

  /**
   * @param {!Object} params The filter params.
   * @return {!Object}
   */
  getCoeffs_(params) {
    /** @type {!Object} */
    let coeffs = {};
    coeffs.a = [];
    coeffs.b = [];
    /** @type {!Object} */
    let p = this.preCalc_(params, coeffs);
    coeffs.k = 1;
    coeffs.b.push((1 - p.cw) / (2 * p.a0));
    coeffs.b.push(2 * coeffs.b[0]);
    coeffs.b.push(coeffs.b[0]);
    return coeffs;
  }

  /**
   * @param {!Object} params The filter params.
   * @param {!Object} coeffs The coefficients template.
   * @return {!Object}
   */
  preCalc_(params, coeffs) {
    /** @type {!Object} */
    let pre = {};
    /** @type {number} */
    let w = 2 * Math.PI * params.Fc / params.Fs;
    pre.alpha = Math.sin(w) / (2 * params.Q);
    pre.cw = Math.cos(w);
    pre.a0 = 1 + pre.alpha;
    coeffs.a0 = pre.a0;
    coeffs.a.push((-2 * pre.cw) / pre.a0);
    coeffs.k = 1;
    coeffs.a.push((1 - pre.alpha) / pre.a0);
    return pre;
  }
  
  /**
   * @param {number} i The stage index.
   * @param {number} sample The sample.
   * @return {number}
   */
  runStage_(i, sample) {
    /** @type {number} */
    let temp = sample * this.stages[i].k - this.stages[i].a1 *
      this.stages[i].z[0] - this.stages[i].a2 * this.stages[i].z[1];
    /** @type {number} */
    let out = this.stages[i].b0 * temp + this.stages[i].b1 *
      this.stages[i].z[0] + this.stages[i].b2 * this.stages[i].z[1];
    this.stages[i].z[1] = this.stages[i].z[0];
    this.stages[i].z[0] = temp;
    return out;
  }

  /**
   * Reset the filter.
   */
  reset() {
    for (let i = 0; i < this.stages.length; i++) {
      this.stages[i].z = [0, 0];
    }
  }
}

/*
 * Copyright (c) 2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * Default use of LPF for each resampling method.
 * @readonly
 * @enum {boolean}
 * @private
 */
const DEFAULT_LPF_USE = {
  'point': false,
  'linear': false,
  'cubic': true,
  'sinc': true
};

/**
 * Default LPF order for each type of LPF.
 * @readonly
 * @enum {number}
 * @private
 */
const DEFAULT_LPF_ORDER = {
  'IIR': 16,
  'FIR': 71
};

/**
 * Default LPF class for each type of LPF.
 * @readonly
 * @enum {!Function}
 * @private
 */
const DEFAULT_LPF = {
  'IIR': ButterworthLPF,
  'FIR': FIRLPF
};

/**
 * Change the sample rate of the samples to a new sample rate.
 * @param {!Array<number>|!TypedArray} samples The original samples.
 * @param {number} oldSampleRate The original sample rate.
 * @param {number} sampleRate The target sample rate.
 * @param {Object=} options The extra configuration, if needed.
 * @return {!Float64Array} the new samples.
 */
function resample(samples, oldSampleRate, sampleRate, options=null) {
  options = options || {};
  // Make the new sample container
  /** @type {number} */
  let rate = ((sampleRate - oldSampleRate) / oldSampleRate) + 1;
  /** @type {!Float64Array} */
  let newSamples = new Float64Array(samples.length * (rate));
  // Create the interpolator
  options.method = options.method || 'cubic';
  /** @type {!Object} */
  let interpolator = new Interpolator(
    samples.length,
    newSamples.length,
    {
      method: options.method,
      tension: options.tension || 0,
      sincFilterSize: options.sincFilterSize || 6,
      sincWindow: options.sincWindow || undefined,
      clip: options.clip || 'mirror'
    });
  // Resample + LPF
  if (options.LPF === undefined) {
    options.LPF = DEFAULT_LPF_USE[options.method];
  } 
  if (options.LPF) {
    options.LPFType = options.LPFType || 'IIR';
    const LPF = DEFAULT_LPF[options.LPFType];
    // Upsampling
    if (sampleRate > oldSampleRate) {
      /** @type {!Object} */
      let filter = new LPF(
        options.LPForder || DEFAULT_LPF_ORDER[options.LPFType],
        sampleRate,
        (oldSampleRate / 2));
      upsample_(
        samples, newSamples, interpolator, filter);
    // Downsampling
    } else {
      /** @type {!Object} */
      let filter = new LPF(
        options.LPForder || DEFAULT_LPF_ORDER[options.LPFType],
        oldSampleRate,
        sampleRate / 2);
      downsample_(
        samples, newSamples, interpolator, filter);
    }
  // Resample, no LPF
  } else {
    resample_(samples, newSamples, interpolator);
  }
  return newSamples;
}

/**
 * Resample.
 * @param {!Array<number>|!TypedArray} samples The original samples.
 * @param {!Float64Array} newSamples The container for the new samples.
 * @param {Object} interpolator The interpolator.
 * @private
 */
function resample_(samples, newSamples, interpolator) {
  // Resample
  for (let i = 0, len = newSamples.length; i < len; i++) {
    newSamples[i] = interpolator.interpolate(i, samples);
  }
}

/**
 * Upsample with LPF.
 * @param {!Array<number>|!TypedArray} samples The original samples.
 * @param {!Float64Array} newSamples The container for the new samples.
 * @param {Object} interpolator The interpolator.
 * @param {Object} filter The LPF object.
 * @private
 */
function upsample_(samples, newSamples, interpolator, filter) {
  // Resample and filter
  for (let i = 0, len = newSamples.length; i < len; i++) {
    newSamples[i] = filter.filter(interpolator.interpolate(i, samples));
  }
  // Reverse filter
  filter.reset();
  for (let i = newSamples.length - 1; i >= 0; i--) {
    newSamples[i]  = filter.filter(newSamples[i]);
  }
}

/**
 * Downsample with LPF.
 * @param {!Array<number>|!TypedArray} samples The original samples.
 * @param {!Float64Array} newSamples The container for the new samples.
 * @param {Object} interpolator The interpolator.
 * @param {Object} filter The LPF object.
 * @private
 */
function downsample_(samples, newSamples, interpolator, filter) {
  // Filter
  for (let i = 0, len = samples.length; i < len; i++) {
    samples[i]  = filter.filter(samples[i]);
  }
  // Reverse filter
  filter.reset();
  for (let i = samples.length - 1; i >= 0; i--) {
    samples[i]  = filter.filter(samples[i]);
  }
  // Resample
  resample_(samples, newSamples, interpolator);
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to convert wav files to other types of wav files.
 * @extends WaveFileCueEditor
 * @ignore
 */
class WaveFileConverter extends WaveFileCueEditor {

  /**
   * Force a file as RIFF.
   */
  toRIFF() {
    /** @type {!Float64Array} */
    let output = new Float64Array(
      outputSize_(this.data.samples.length, this.dataType.bits / 8));
    unpackArrayTo(this.data.samples, this.dataType, output,
      0, this.data.samples.length);
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      this.bitDepth,
      output,
      {container: 'RIFF'});
  }

  /**
   * Force a file as RIFX.
   */
  toRIFX() {
    /** @type {!Float64Array} */
    let output = new Float64Array(
      outputSize_(this.data.samples.length, this.dataType.bits / 8));
    unpackArrayTo(this.data.samples, this.dataType, output,
      0, this.data.samples.length);
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      this.bitDepth,
      output,
      {container: 'RIFX'});
  }

  /**
   * Encode a 16-bit wave file as 4-bit IMA ADPCM.
   * @throws {Error} If sample rate is not 8000.
   * @throws {Error} If number of channels is not 1.
   */
  toIMAADPCM() {
    if (this.fmt.sampleRate !== 8000) {
      throw new Error(
        'Only 8000 Hz files can be compressed as IMA-ADPCM.');
    } else if (this.fmt.numChannels !== 1) {
      throw new Error(
        'Only mono files can be compressed as IMA-ADPCM.');
    } else {
      this.assure16Bit_();
      /** @type {!Int16Array} */
      let output = new Int16Array(
        outputSize_(this.data.samples.length, 2));
      unpackArrayTo(this.data.samples, this.dataType, output,
        0, this.data.samples.length);
      this.fromExisting_(
        this.fmt.numChannels,
        this.fmt.sampleRate,
        '4',
        encode$2(output),
        {container: this.correctContainer_()});
    }
  }

  /**
   * Decode a 4-bit IMA ADPCM wave file as a 16-bit wave file.
   * @param {string=} [bitDepthCode='16'] The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   */
  fromIMAADPCM(bitDepthCode='16') {
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      decode$2(this.data.samples, this.fmt.blockAlign),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Encode a 16-bit wave file as 8-bit A-Law.
   */
  toALaw() {
    this.assure16Bit_();
    /** @type {!Int16Array} */
    let output = new Int16Array(
      outputSize_(this.data.samples.length, 2));
    unpackArrayTo(this.data.samples, this.dataType, output,
        0, this.data.samples.length);
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '8a',
      encode$1(output),
      {container: this.correctContainer_()});
  }

  /**
   * Decode a 8-bit A-Law wave file into a 16-bit wave file.
   * @param {string=} [bitDepthCode='16'] The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   */
  fromALaw(bitDepthCode='16') {
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      decode$1(this.data.samples),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Encode 16-bit wave file as 8-bit mu-Law.
   */
  toMuLaw() {
    this.assure16Bit_();
    /** @type {!Int16Array} */
    let output = new Int16Array(
      outputSize_(this.data.samples.length, 2));
    unpackArrayTo(this.data.samples, this.dataType, output,
        0, this.data.samples.length);
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '8m',
      encode(output),
      {container: this.correctContainer_()});
  }

  /**
   * Decode a 8-bit mu-Law wave file into a 16-bit wave file.
   * @param {string=} [bitDepthCode='16'] The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats).
   */
  fromMuLaw(bitDepthCode='16') {
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      '16',
      decode(this.data.samples),
      {container: this.correctContainer_()});
    if (bitDepthCode != '16') {
      this.toBitDepth(bitDepthCode);
    }
  }

  /**
   * Change the bit depth of the samples.
   * @param {string} newBitDepth The new bit depth of the samples.
   *    One of '8' ... '32' (integers), '32f' or '64' (floats)
   * @param {boolean=} [changeResolution=true] A boolean indicating if the
   *    resolution of samples should be actually changed or not.
   * @throws {Error} If the bit depth is not valid.
   */
  toBitDepth(newBitDepth, changeResolution=true) {
    /** @type {string} */
    let toBitDepth = newBitDepth;
    /** @type {string} */
    let thisBitDepth = this.bitDepth;
    if (!changeResolution) {
      if (newBitDepth != '32f') {
        toBitDepth = this.dataType.bits.toString();
      }
      thisBitDepth = '' + this.dataType.bits;
    }
    // If the file is compressed, make it
    // PCM before changing the bit depth
    this.assureUncompressed_();
    /**
     * The original samples, interleaved.
     * @type {!(Array|TypedArray)}
     */
    let samples = this.getSamples(true);
    /**
     * The container for the new samples.
     * @type {!Float64Array}
     */
    let newSamples = new Float64Array(samples.length);
    // Change the bit depth
    changeBitDepth(samples, thisBitDepth, newSamples, toBitDepth);
    // Re-create the file
    this.fromExisting_(
      this.fmt.numChannels,
      this.fmt.sampleRate,
      newBitDepth,
      newSamples,
      {container: this.correctContainer_()});
  }

  /**
   * Convert the sample rate of the file.
   * @param {number} sampleRate The target sample rate.
   * @param {Object=} options The extra configuration, if needed.
   */
  toSampleRate(sampleRate, options) {
    this.validateResample_(sampleRate);
    /** @type {!(Array|TypedArray)} */
    let samples = this.getSamples();
    /** @type {!(Array|Float64Array)} */
    let newSamples = [];
    // Mono files
    if (samples.constructor === Float64Array) {
      newSamples = resample(samples, this.fmt.sampleRate, sampleRate, options);
    // Multi-channel files
    } else {
      for (let i = 0; i < samples.length; i++) {
        newSamples.push(resample(
          samples[i], this.fmt.sampleRate, sampleRate, options));
      }
    }
    // Recreate the file
    this.fromExisting_(
      this.fmt.numChannels, sampleRate, this.bitDepth, newSamples,
      {'container': this.correctContainer_()});
  }

  /**
   * Validate the conditions for resampling.
   * @param {number} sampleRate The target sample rate.
   * @throws {Error} If the file cant be resampled.
   * @private
   */
  validateResample_(sampleRate) {
    if (!validateSampleRate(
        this.fmt.numChannels, this.fmt.bitsPerSample, sampleRate)) {
      throw new Error('Invalid sample rate.');
    } else if (['4','8a','8m'].indexOf(this.bitDepth) > -1) {
      throw new Error(
        'wavefile can\'t change the sample rate of compressed files.');
    }
  }

  /**
   * Make the file 16-bit if it is not.
   * @private
   */
  assure16Bit_() {
    this.assureUncompressed_();
    if (this.bitDepth != '16') {
      this.toBitDepth('16');
    }
  }

  /**
   * Uncompress the samples in case of a compressed file.
   * @private
   */
  assureUncompressed_() {
    if (this.bitDepth == '8a') {
      this.fromALaw();
    } else if (this.bitDepth == '8m') {
      this.fromMuLaw();
    } else if (this.bitDepth == '4') {
      this.fromIMAADPCM();
    }
  }

  /**
   * Return 'RIFF' if the container is 'RF64', the current container name
   * otherwise. Used to enforce 'RIFF' when RF64 is not allowed.
   * @return {string}
   * @private
   */
  correctContainer_() {
    return this.container == 'RF64' ? 'RIFF' : this.container;
  }

  /**
   * Set up the WaveFileCreator object based on the arguments passed.
   * This method only reset the fmt , fact, ds64 and data chunks.
   * @param {number} numChannels The number of channels
   *    (Integer numbers: 1 for mono, 2 stereo and so on).
   * @param {number} sampleRate The sample rate.
   *    Integer numbers like 8000, 44100, 48000, 96000, 192000.
   * @param {string} bitDepthCode The audio bit depth code.
   *    One of '4', '8', '8a', '8m', '16', '24', '32', '32f', '64'
   *    or any value between '8' and '32' (like '12').
   * @param {!(Array|TypedArray)} samples
   *    The samples. Must be in the correct range according to the bit depth.
   * @param {Object} options Used to define the container. Uses RIFF by default.
   * @throws {Error} If any argument does not meet the criteria.
   * @private
   */
  fromExisting_(numChannels, sampleRate, bitDepthCode, samples, options) {
    /** @type {!Object} */
    let tmpWav = new WaveFileCueEditor();
    Object.assign(this.fmt, tmpWav.fmt);
    Object.assign(this.fact, tmpWav.fact);
    Object.assign(this.ds64, tmpWav.ds64);
    Object.assign(this.data, tmpWav.data);
    this.newWavFile_(numChannels, sampleRate, bitDepthCode, samples, options);
  }
}

/**
 * Return the size in bytes of the output sample array when applying
 * compression to 16-bit samples.
 * @return {number}
 * @private
 */
function outputSize_(byteLen, byteOffset) {
  /** @type {number} */
  let outputSize = byteLen / byteOffset;
  if (outputSize % 2) {
    outputSize++;
  }
  return outputSize;
}

/*
 * Copyright (c) 2017-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */


/**
 * A class to manipulate wav files.
 * @extends WaveFileConverter
 */
class WaveFile extends WaveFileConverter {

  /**
   * @param {Uint8Array=} wav A wave file buffer.
   * @throws {Error} If container is not RIFF, RIFX or RF64.
   * @throws {Error} If format is not WAVE.
   * @throws {Error} If no 'fmt ' chunk is found.
   * @throws {Error} If no 'data' chunk is found.
   */
  constructor(wav) {
    super();
    if (wav) {
      this.fromBuffer(wav);
    }
  }

  /**
   * Use a .wav file encoded as a base64 string to load the WaveFile object.
   * @param {string} base64String A .wav file as a base64 string.
   * @throws {Error} If any property of the object appears invalid.
   */
  fromBase64(base64String) {
    this.fromBuffer(decode$3(base64String));
  }

  /**
   * Return a base64 string representig the WaveFile object as a .wav file.
   * @return {string} A .wav file as a base64 string.
   * @throws {Error} If any property of the object appears invalid.
   */
  toBase64() {
    return encode$3(this.toBuffer());
  }

  /**
   * Return a DataURI string representig the WaveFile object as a .wav file.
   * The return of this method can be used to load the audio in browsers.
   * @return {string} A .wav file as a DataURI.
   * @throws {Error} If any property of the object appears invalid.
   */
  toDataURI() {
    return 'data:audio/wav;base64,' + this.toBase64();
  }

  /**
   * Use a .wav file encoded as a DataURI to load the WaveFile object.
   * @param {string} dataURI A .wav file as DataURI.
   * @throws {Error} If any property of the object appears invalid.
   */
  fromDataURI(dataURI) {
    this.fromBase64(dataURI.replace('data:audio/wav;base64,', ''));
  }
}

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const renderWav = async (durationSeconds, artefacts, audioSettings) => {
    let target = 'assemblyscript';
    if (!artefacts.wasm && !artefacts.javascript) {
        throw new Error(`Need compiled wasm or compiled js to render wav`);
    }
    if (!artefacts.wasm) {
        target = 'javascript';
    }
    const engine = await createEngine(artefacts, target);
    const audioData = await renderAudioData(engine, durationSeconds, audioSettings);
    return audioDataToWav(audioData, audioSettings.sampleRate);
};
const audioDataToWav = (audioData, sampleRate) => {
    const channelCount = audioData.length;
    let wav = new WaveFile();
    wav.fromScratch(channelCount, sampleRate, '32f', audioData.map((channelData) => channelData.map((v) => v)));
    return wav.toBuffer();
};
const createEngine = async (artefacts, target) => {
    switch (target) {
        case 'javascript':
            return createEngine$1(getArtefact(artefacts, 'javascript'));
        case 'assemblyscript':
            return createEngine$2(getArtefact(artefacts, 'wasm'));
    }
};
const renderAudioData = (engine, durationSeconds, audioSettings) => {
    const { channelCount, sampleRate, blockSize } = audioSettings;
    const durationSamples = Math.round(durationSeconds * sampleRate);
    const blockInput = _makeBlock('in', audioSettings);
    const blockOutput = _makeBlock('out', audioSettings);
    const output = _makeBlock('out', audioSettings, durationSamples);
    engine.configure(sampleRate, blockSize);
    let frame = 0;
    while (frame < durationSamples) {
        engine.loop(blockInput, blockOutput);
        for (let channel = 0; channel < channelCount.out; channel++) {
            output[channel].set(blockOutput[channel].slice(0, Math.min(blockSize, durationSamples - frame)), frame);
        }
        frame += blockSize;
    }
    return output;
};
const _makeBlock = (inOrOut, audioSettings, blockSize) => {
    const { channelCount, blockSize: defaultBlockSize, bitDepth, } = audioSettings;
    if (blockSize === undefined) {
        blockSize = defaultBlockSize;
    }
    const floatArrayType = getFloatArrayType(bitDepth);
    const block = [];
    for (let channel = 0; channel < channelCount[inOrOut]; channel++) {
        block.push(new floatArrayType(Math.round(blockSize)));
    }
    return block;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : set message not supported
// ------------------------------- node builder ------------------------------ //
const builder$N = {
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
// ------------------------------- node implementation ------------------------------ //
const nodeImplementation$F = {
    loop: ({ ins, globs, node, compilation: { settings: { audio }, target }, }) => Sequence$1([
        node.args.channelMapping
            // Save the original index
            .map((destination, i) => [destination, i])
            // Ignore channels that are out of bounds
            .filter(([destination]) => 0 <= destination && destination < audio.channelCount.out)
            .map(([destination, i]) => target === 'javascript'
            ? `${globs.output}[${destination}][${globs.iterFrame}] = ${ins[`${i}`]}`
            : `${globs.output}[${globs.iterFrame} + ${globs.blockSize} * ${destination}] = ${ins[`${i}`]}`)
    ])
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : set message not supported
// ------------------------------- node builder ------------------------------ //
const builder$M = {
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
// ------------------------------- node implementation ------------------------------ //
const nodeImplementation$E = {
    loop: ({ outs, globs, node, compilation: { settings: { audio }, target }, }) => Sequence$1([
        node.args.channelMapping
            // Save the original index 
            .map((source, i) => [source, i])
            // Ignore channels that are out of bounds
            .filter(([source]) => 0 <= source && source < audio.channelCount.in)
            .map(([source, i]) => target === 'javascript'
            ? `${outs[`${i}`]} = ${globs.input}[${source}][${globs.iterFrame}]`
            : `${outs[`${i}`]} = ${globs.input}[${globs.iterFrame} + ${globs.blockSize} * ${source}]`)
    ])
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$L = {
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
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$r = ({ globs, snds }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) { 
            ${snds.$0}(msg_floats([${globs.sampleRate}])) 
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$D = {
    messageReceivers: messageReceivers$r,
    dependencies: [bangUtils]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$K = {
    translateArgs: (pdNode) => ({
        frequency: assertOptionalNumber(pdNode.args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { frequency }) => {
        if (inletId === '0') {
            return { initialSignalValue: frequency };
        }
        return undefined;
    },
};
const makeNodeImplementation$7 = ({ name, coeff, generateOperation, }) => {
    // ------------------------------ generateDeclarations ------------------------------ //
    const variableNames = generateVariableNamesNodeType(name, [
        'setPhase'
    ]);
    const nodeCore = () => Sequence$1([
        Class$1(variableNames.stateClass, [
            Var$1('Float', 'phase'),
            Var$1('Float', 'J'),
        ]),
        Func$1(variableNames.setPhase, [
            Var$1(variableNames.stateClass, 'state'),
            Var$1('Float', 'phase'),
        ], 'void') `
            state.phase = phase % 1.0${coeff ? ` * ${coeff}` : ''}
        `
    ]);
    const initialization = ({ globs, state }) => ast$1 `
            ${ConstVar$1(variableNames.stateClass, state, `{
                phase: 0,
                J: 0,
            }`)}
            
            commons_waitEngineConfigure(() => {
                ${state}.J = ${coeff ? `${coeff}` : '1'} / ${globs.sampleRate}
            })
        `;
    // ------------------------------- loop ------------------------------ //
    const loop = ({ ins, state, outs }) => ast$1 `
        ${outs.$0} = ${generateOperation(`${state}.phase`)}
        ${state}.phase += (${state}.J * ${ins.$0})
    `;
    // ------------------------------- messageReceivers ------------------------------ //
    const messageReceivers = ({ globs, state }) => ({
        '1': coldFloatInletWithSetter(variableNames.setPhase, state),
    });
    return {
        initialization: initialization,
        messageReceivers: messageReceivers,
        loop: loop,
        dependencies: [
            commonsWaitEngineConfigure,
            nodeCore
        ]
    };
};
// ------------------------------------------------------------------- //
const nodeImplementations$d = {
    'osc~': makeNodeImplementation$7({
        name: 'osc_t',
        coeff: '2 * Math.PI',
        generateOperation: (phase) => `Math.cos(${phase})`
    }),
    'phasor~': makeNodeImplementation$7({
        name: 'phasor_t',
        generateOperation: (phase) => `${phase} % 1`
    }),
};
const builders$d = {
    'osc~': builder$K,
    'phasor~': builder$K,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$J = {
    translateArgs: ({ args }) => ({
        minValue: assertOptionalNumber(args[0]) || 0,
        maxValue: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'message', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    })
};
// ------------------------------- node implementation ------------------------------ //
const variableNames$B = generateVariableNamesNodeType('clip_t');
const nodeImplementation$C = {
    initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$B.stateClass, state, `{
                minValue: ${args.minValue},
                maxValue: ${args.maxValue},
            }`)}
        `,
    inlineLoop: ({ ins, state }) => ast$1 `Math.max(Math.min(${state}.maxValue, ${ins.$0}), ${state}.minValue)`,
    messageReceivers: ({ state }) => ({
        '1': coldFloatInlet(`${state}.minValue`),
        '2': coldFloatInlet(`${state}.maxValue`),
    }),
    dependencies: [
        () => Sequence$1([
            Class$1(variableNames$B.stateClass, [
                Var$1('Float', 'minValue'),
                Var$1('Float', 'maxValue'),
            ]),
        ])
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$I = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$A = generateVariableNamesNodeType('samphold_t');
const nodeCore$q = () => Sequence$1([
    Class$1(variableNames$A.stateClass, [
        Var$1('Float', 'signalMemory'),
        Var$1('Float', 'controlMemory'),
    ]),
]);
const initialization$p = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$A.stateClass, state, `{
            signalMemory: 0,
            controlMemory: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$8 = ({ ins, outs, state }) => ast$1 `
    ${state}.signalMemory = ${outs.$0} = ${ins.$1} < ${state}.controlMemory ? ${ins.$0}: ${state}.signalMemory
    ${state}.controlMemory = ${ins.$1}
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$q = ({ state, globs }) => ({
    '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
        if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'set'
        ) {
            ${state}.signalMemory = msg_readFloatToken(m, 1)
            return

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'reset'
        ) {
            ${state}.controlMemory = msg_readFloatToken(m, 1)
            return

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'reset'
        ) {
            ${state}.controlMemory = 1e20
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$B = {
    loop: loop$8,
    messageReceivers: messageReceivers$q,
    initialization: initialization$p,
    dependencies: [
        nodeCore$q,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$H = {
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$z = generateVariableNamesNodeType('snapshot_t');
const nodeCore$p = () => Sequence$1([
    Class$1(variableNames$z.stateClass, [
        Var$1('Float', 'currentValue')
    ]),
]);
const initialization$o = ({ state }) => ast$1 `
        ${ConstVar$1(variableNames$z.stateClass, state, `{
            currentValue: 0
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$7 = ({ ins, state }) => ast$1 `
    ${state}.currentValue = ${ins.$0}
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$p = ({ state, snds }) => ({
    '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
        if (msg_isBang(m)) {
            ${snds.$0}(msg_floats([${state}.currentValue]))
            return 
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$A = {
    loop: loop$7,
    messageReceivers: messageReceivers$p,
    initialization: initialization$o,
    dependencies: [
        bangUtils,
        nodeCore$p,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const point = () => Class$1('Point', [
    Var$1('Float', 'x'),
    Var$1('Float', 'y'),
]);
const interpolateLin = {
    codeGenerator: () => Func$1('interpolateLin', [Var$1('Float', 'x'), Var$1('Point', 'p0'), Var$1('Point', 'p1')], 'Float') `
            return p0.y + (x - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
        `,
    dependencies: [point],
};

const linesUtils = {
    codeGenerator: () => Sequence$1([
        Class$1('LineSegment', [
            Var$1('Point', 'p0'),
            Var$1('Point', 'p1'),
            Var$1('Float', 'dx'),
            Var$1('Float', 'dy'),
        ]),
        Func$1('computeSlope', [Var$1('Point', 'p0'), Var$1('Point', 'p1')], 'Float') `
            return p1.x !== p0.x ? (p1.y - p0.y) / (p1.x - p0.x) : 0
        `,
        Func$1('removePointsBeforeFrame', [Var$1('Array<Point>', 'points'), Var$1('Float', 'frame')], 'Array<Point>') `
            ${ConstVar$1('Array<Point>', 'newPoints', '[]')}
            ${Var$1('Int', 'i', '0')}
            while (i < points.length) {
                if (frame <= points[i].x) {
                    newPoints.push(points[i])
                }
                i++
            }
            return newPoints
        `,
        Func$1('insertNewLinePoints', [Var$1('Array<Point>', 'points'), Var$1('Point', 'p0'), Var$1('Point', 'p1')], 'Array<Point>') `
            ${ConstVar$1('Array<Point>', 'newPoints', '[]')}
            ${Var$1('Int', 'i', '0')}
            
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
        `,
        Func$1('computeFrameAjustedPoints', [Var$1('Array<Point>', 'points')], 'Array<Point>') `
            if (points.length < 2) {
                throw new Error('invalid length for points')
            }

            ${ConstVar$1('Array<Point>', 'newPoints', '[]')}
            ${Var$1('Int', 'i', '0')}
            ${Var$1('Point', 'p', 'points[0]')}
            ${Var$1('Float', 'frameLower', '0')}
            ${Var$1('Float', 'frameUpper', '0')}
            
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
        `,
        Func$1('computeLineSegments', [Var$1('Array<Point>', 'points')], 'Array<LineSegment>') `
            ${ConstVar$1('Array<LineSegment>', 'lineSegments', '[]')}
            ${Var$1('Int', 'i', '0')}
            ${Var$1('Point', 'p0')}
            ${Var$1('Point', 'p1')}

            while(i < points.length - 1) {
                p0 = points[i]
                p1 = points[i + 1]
                lineSegments.push({
                    p0, p1, 
                    dy: computeSlope(p0, p1),
                    dx: 1,
                })
                i++
            }
            return lineSegments
        `,
    ]),
    dependencies: [interpolateLin],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : unit testing
// TODO : amount = 0 ?
// TODO : missing persec and all per...
const computeUnitInSamples = () => Func$1('computeUnitInSamples', [
    Var$1('Float', 'sampleRate'),
    Var$1('Float', 'amount'),
    Var$1('string', 'unit'),
], 'Float') `
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
    `;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$G = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$y = generateVariableNamesNodeType('vline_t', [
    'setNewLine',
    'setNextDuration',
    'setNextDelay',
]);
const nodeCore$o = ({ globs }) => Sequence$1([
    Class$1(variableNames$y.stateClass, [
        Var$1('Array<Point>', 'points'),
        Var$1('Array<LineSegment>', 'lineSegments'),
        Var$1('Float', 'currentValue'),
        Var$1('Float', 'nextDurationSamp'),
        Var$1('Float', 'nextDelaySamp'),
    ]),
    Func$1(variableNames$y.setNewLine, [
        Var$1(variableNames$y.stateClass, 'state'),
        Var$1('Float', 'targetValue'),
    ], 'void') `
        state.points = removePointsBeforeFrame(state.points, toFloat(${globs.frame}))
        ${ConstVar$1('Float', 'startFrame', `toFloat(${globs.frame}) + state.nextDelaySamp`)}
        ${ConstVar$1('Float', 'endFrame', `startFrame + state.nextDurationSamp`)}
        if (endFrame === toFloat(${globs.frame})) {
            state.currentValue = targetValue
            state.lineSegments = []
        } else {
            state.points = insertNewLinePoints(
                state.points, 
                {x: startFrame, y: state.currentValue},
                {x: endFrame, y: targetValue}
            )
            state.lineSegments = computeLineSegments(
                computeFrameAjustedPoints(state.points))
        }
        state.nextDurationSamp = 0
        state.nextDelaySamp = 0
    `,
    Func$1(variableNames$y.setNextDuration, [
        Var$1(variableNames$y.stateClass, 'state'),
        Var$1('Float', 'durationMsec'),
    ], 'void') `
        state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    `,
    Func$1(variableNames$y.setNextDelay, [
        Var$1(variableNames$y.stateClass, 'state'),
        Var$1('Float', 'delayMsec'),
    ], 'void') `
        state.nextDelaySamp = computeUnitInSamples(${globs.sampleRate}, delayMsec, 'msec')
    `,
]);
const initialization$n = ({ state }) => ast$1 `
        ${ConstVar$1(variableNames$y.stateClass, state, `{
            points: [],
            lineSegments: [],
            currentValue: 0,
            nextDurationSamp: 0,
            nextDelaySamp: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$6 = ({ outs, state, globs }) => ast$1 `
    if (${state}.lineSegments.length) {
        if (toFloat(${globs.frame}) < ${state}.lineSegments[0].p0.x) {

        // This should come first to handle vertical lines
        } else if (toFloat(${globs.frame}) === ${state}.lineSegments[0].p1.x) {
            ${state}.currentValue = ${state}.lineSegments[0].p1.y
            ${state}.lineSegments.shift()

        } else if (toFloat(${globs.frame}) === ${state}.lineSegments[0].p0.x) {
            ${state}.currentValue = ${state}.lineSegments[0].p0.y

        } else if (toFloat(${globs.frame}) < ${state}.lineSegments[0].p1.x) {
            ${state}.currentValue += ${state}.lineSegments[0].dy

        }
    }
    ${outs.$0} = ${state}.currentValue
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$o = ({ state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
    if (
        msg_isMatching(m, [MSG_FLOAT_TOKEN])
        || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        switch (msg_getLength(m)) {
            case 3:
                ${variableNames$y.setNextDelay}(${state}, msg_readFloatToken(m, 2))
            case 2:
                ${variableNames$y.setNextDuration}(${state}, msg_readFloatToken(m, 1))
            case 1:
                ${variableNames$y.setNewLine}(${state}, msg_readFloatToken(m, 0))
        }
        return

    } else if (msg_isAction(m, 'stop')) {
        ${state}.points = []
        ${state}.lineSegments = []
        return
    }
    `,
    '1': coldFloatInletWithSetter(variableNames$y.setNextDuration, state),
    '2': coldFloatInletWithSetter(variableNames$y.setNextDelay, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$z = {
    loop: loop$6,
    messageReceivers: messageReceivers$o,
    initialization: initialization$n,
    dependencies: [
        linesUtils,
        computeUnitInSamples,
        stringMsgUtils,
        nodeCore$o,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$F = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$x = generateVariableNamesNodeType('line_t', [
    'defaultLine',
    'setNewLine',
    'setNextDuration',
    'stop',
]);
const nodeCore$n = ({ globs }) => Sequence$1([
    Class$1(variableNames$x.stateClass, [
        Var$1('LineSegment', 'currentLine'),
        Var$1('Float', 'currentValue'),
        Var$1('Float', 'nextDurationSamp'),
    ]),
    ConstVar$1('LineSegment', variableNames$x.defaultLine, `{
        p0: {x: -1, y: 0},
        p1: {x: -1, y: 0},
        dx: 1,
        dy: 0,
    }`),
    Func$1(variableNames$x.setNewLine, [
        Var$1(variableNames$x.stateClass, 'state'),
        Var$1('Float', 'targetValue'),
    ], 'void') `
        ${ConstVar$1('Float', 'startFrame', `toFloat(${globs.frame})`)}
        ${ConstVar$1('Float', 'endFrame', `toFloat(${globs.frame}) + state.nextDurationSamp`)}
        if (endFrame === toFloat(${globs.frame})) {
            state.currentLine = ${variableNames$x.defaultLine}
            state.currentValue = targetValue
            state.nextDurationSamp = 0
        } else {
            state.currentLine = {
                p0: {
                    x: startFrame, 
                    y: state.currentValue,
                }, 
                p1: {
                    x: endFrame, 
                    y: targetValue,
                }, 
                dx: 1,
                dy: 0,
            }
            state.currentLine.dy = computeSlope(state.currentLine.p0, state.currentLine.p1)
            state.nextDurationSamp = 0
        }
    `,
    Func$1(variableNames$x.setNextDuration, [
        Var$1(variableNames$x.stateClass, 'state'),
        Var$1('Float', 'durationMsec'),
    ], 'void') `
        state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    `,
    Func$1(variableNames$x.stop, [
        Var$1(variableNames$x.stateClass, 'state'),
    ], 'void') `
        state.currentLine.p1.x = -1
        state.currentLine.p1.y = state.currentValue
    `
]);
const initialization$m = ({ state, node: { args } }) => ast$1 `
        ${ConstVar$1(variableNames$x.stateClass, state, `{
            currentLine: ${variableNames$x.defaultLine},
            currentValue: ${args.initValue},
            nextDurationSamp: 0,
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$n = ({ state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (
            msg_isMatching(m, [MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        ) {
            switch (msg_getLength(m)) {
                case 2:
                    ${variableNames$x.setNextDuration}(${state}, msg_readFloatToken(m, 1))
                case 1:
                    ${variableNames$x.setNewLine}(${state}, msg_readFloatToken(m, 0))
            }
            return

        } else if (msg_isAction(m, 'stop')) {
            ${variableNames$x.stop}(${state})
            return

        }
    `,
    '1': coldFloatInletWithSetter(variableNames$x.setNextDuration, state),
});
// ------------------------------- loop ------------------------------ //
const loop$5 = ({ outs, state, globs }) => ast$1 `
    ${outs.$0} = ${state}.currentValue
    if (toFloat(${globs.frame}) < ${state}.currentLine.p1.x) {
        ${state}.currentValue += ${state}.currentLine.dy
        if (toFloat(${globs.frame} + 1) >= ${state}.currentLine.p1.x) {
            ${state}.currentValue = ${state}.currentLine.p1.y
        }
    }
`;
// ------------------------------------------------------------------- //
const nodeImplementation$y = {
    initialization: initialization$m,
    messageReceivers: messageReceivers$n,
    loop: loop$5,
    dependencies: [stringMsgUtils, computeUnitInSamples, linesUtils, nodeCore$n],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const MIN_GRAIN_MSEC = 20;
// ------------------------------- node builder ------------------------------ //
const builder$E = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
        timeGrainMsec: Math.max(assertOptionalNumber(args[1]) || MIN_GRAIN_MSEC, MIN_GRAIN_MSEC),
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
        isPushingMessages: true,
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$w = generateVariableNamesNodeType('line', [
    'setNewLine',
    'setNextDuration',
    'setGrain',
    'stopCurrentLine',
    'setNextSamp',
    'incrementTime',
    'tick',
    'scheduleNextTick',
]);
const nodeCore$m = ({ globs }) => Sequence$1([
    Class$1(variableNames$w.stateClass, [
        Var$1('LineSegment', 'currentLine'),
        Var$1('Float', 'currentValue'),
        Var$1('Float', 'nextSamp'),
        Var$1('Int', 'nextSampInt'),
        Var$1('Float', 'grainSamp'),
        Var$1('Float', 'nextDurationSamp'),
        Var$1('SkedId', 'skedId'),
        Var$1('(m: Message) => void', 'snd0'),
        Var$1('SkedCallback', 'tickCallback'),
    ]),
    Func$1(variableNames$w.setNewLine, [
        Var$1(variableNames$w.stateClass, 'state'),
        Var$1('Float', 'targetValue'),
    ], 'void') `
        state.currentLine = {
            p0: {
                x: toFloat(${globs.frame}), 
                y: state.currentValue,
            }, 
            p1: {
                x: toFloat(${globs.frame}) + state.nextDurationSamp, 
                y: targetValue,
            }, 
            dx: state.grainSamp
        }
        state.nextDurationSamp = 0
        state.currentLine.dy = computeSlope(state.currentLine.p0, state.currentLine.p1) * state.grainSamp
    `,
    Func$1(variableNames$w.setNextDuration, [
        Var$1(variableNames$w.stateClass, 'state'),
        Var$1('Float', 'durationMsec'),
    ], 'void') `
        state.nextDurationSamp = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    `,
    Func$1(variableNames$w.setGrain, [
        Var$1(variableNames$w.stateClass, 'state'),
        Var$1('Float', 'grainMsec'),
    ], 'void') `
        state.grainSamp = computeUnitInSamples(${globs.sampleRate}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
    `,
    Func$1(variableNames$w.stopCurrentLine, [
        Var$1(variableNames$w.stateClass, 'state'),
    ], 'void') `
        if (state.skedId !== SKED_ID_NULL) {
            commons_cancelWaitFrame(state.skedId)
            state.skedId = SKED_ID_NULL
        }
        if (${globs.frame} < state.nextSampInt) {
            ${variableNames$w.incrementTime}(state, -1 * (state.nextSamp - toFloat(${globs.frame})))
        }
        ${variableNames$w.setNextSamp}(state, -1)
    `,
    Func$1(variableNames$w.setNextSamp, [
        Var$1(variableNames$w.stateClass, 'state'),
        Var$1('Float', 'currentSamp'),
    ], 'void') `
        state.nextSamp = currentSamp
        state.nextSampInt = toInt(Math.round(currentSamp))
    `,
    Func$1(variableNames$w.incrementTime, [
        Var$1(variableNames$w.stateClass, 'state'),
        Var$1('Float', 'incrementSamp'),
    ], 'void') `
        if (incrementSamp === state.currentLine.dx) {
            state.currentValue += state.currentLine.dy
        } else {
            state.currentValue += interpolateLin(
                incrementSamp,
                {x: 0, y: 0},
                {x: state.currentLine.dx, y: state.currentLine.dy},
            )
        }
        ${variableNames$w.setNextSamp}(
            state, 
            (state.nextSamp !== -1 ? state.nextSamp: toFloat(${globs.frame})) + incrementSamp
        )
    `,
    Func$1(variableNames$w.tick, [
        Var$1(variableNames$w.stateClass, 'state'),
    ], 'void') `
        state.snd0(msg_floats([state.currentValue]))
        if (toFloat(${globs.frame}) >= state.currentLine.p1.x) {
            state.currentValue = state.currentLine.p1.y
            ${variableNames$w.stopCurrentLine}(state)
        } else {
            ${variableNames$w.incrementTime}(state, state.currentLine.dx)
            ${variableNames$w.scheduleNextTick}(state)
        }
    `,
    Func$1(variableNames$w.scheduleNextTick, [
        Var$1(variableNames$w.stateClass, 'state'),
    ], 'void') `
        state.skedId = commons_waitFrame(state.nextSampInt, state.tickCallback)
    `
]);
const initialization$l = ({ node: { args, id }, state, snds }) => ast$1 `
        ${ConstVar$1(variableNames$w.stateClass, state, ast$1 `{
            currentLine: {
                p0: {x: -1, y: 0},
                p1: {x: -1, y: 0},
                dx: 1,
                dy: 0,
            },
            currentValue: ${args.initValue},
            nextSamp: -1,
            nextSampInt: -1,
            grainSamp: 0,
            nextDurationSamp: 0,
            skedId: SKED_ID_NULL,
            snd0: ${snds.$0},
            tickCallback: ${AnonFunc$1() ``},
        }`)}

        commons_waitEngineConfigure(() => {
            ${variableNames$w.setGrain}(${state}, ${args.timeGrainMsec})
            ${state}.tickCallback = ${AnonFunc$1() `
                ${variableNames$w.tick}(${state})
            `}
        })
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$m = ({ snds, state, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (
            msg_isMatching(m, [MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
            || msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        ) {
            ${variableNames$w.stopCurrentLine}(${state})
            switch (msg_getLength(m)) {
                case 3:
                    ${variableNames$w.setGrain}(${state}, msg_readFloatToken(m, 2))
                case 2:
                    ${variableNames$w.setNextDuration}(${state}, msg_readFloatToken(m, 1))
                case 1:
                    ${ConstVar$1('Float', 'targetValue', 'msg_readFloatToken(m, 0)')}
                    if (${state}.nextDurationSamp === 0) {
                        ${state}.currentValue = targetValue
                        ${snds.$0}(msg_floats([targetValue]))
                    } else {
                        ${snds.$0}(msg_floats([${state}.currentValue]))
                        ${variableNames$w.setNewLine}(${state}, targetValue)
                        ${variableNames$w.incrementTime}(${state}, ${state}.currentLine.dx)
                        ${variableNames$w.scheduleNextTick}(${state})
                    }
                    
            }
            return

        } else if (msg_isAction(m, 'stop')) {
            ${variableNames$w.stopCurrentLine}(${state})
            return

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'set'
        ) {
            ${variableNames$w.stopCurrentLine}(${state})
            ${state}.currentValue = msg_readFloatToken(m, 1)
            return
        }
    `,
    '1': coldFloatInletWithSetter(variableNames$w.setNextDuration, state),
    '2': coldFloatInletWithSetter(variableNames$w.setGrain, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$x = {
    initialization: initialization$l,
    messageReceivers: messageReceivers$m,
    dependencies: [
        stringMsgUtils,
        computeUnitInSamples,
        linesUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
        nodeCore$m
    ],
};

const MAX_MIDI_FREQ = Math.pow(2, (1499 - 69) / 12) * 440;
// Also possible to use optimized version, but gives approximate results : 8.17579891564 * Math.exp(0.0577622650 * value)
const mtof = () => Func$1('mtof', [
    Var$1('Float', 'value'),
], 'Float') `
        return value <= -1500 ? 0: (value > 1499 ? ${MAX_MIDI_FREQ} : Math.pow(2, (value - 69) / 12) * 440)
    `;
// optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
// which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
// which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
const ftom = () => Func$1('ftom', [
    Var$1('Float', 'value'),
], 'Float') `
        return value <= 0 ? -1500: 12 * Math.log(value / 440) / Math.LN2 + 69
    `;
// TODO : tests (see in binop)
const pow = () => Func$1('pow', [
    Var$1('Float', 'leftOp'),
    Var$1('Float', 'rightOp'),
], 'Float') `
        return leftOp > 0 || (Math.round(rightOp) === rightOp) ? Math.pow(leftOp, rightOp): 0
    `;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$D = {
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
// ------------------------------------------------------------------- //
const nodeImplementations$c = {
    'abs~': { inlineLoop: ({ ins }) => ast$1 `Math.abs(${ins.$0})` },
    'cos~': { inlineLoop: ({ ins }) => ast$1 `Math.cos(${ins.$0} * 2 * Math.PI)` },
    'wrap~': { inlineLoop: ({ ins }) => ast$1 `(1 + (${ins.$0} % 1)) % 1` },
    'sqrt~': { inlineLoop: ({ ins }) => ast$1 `${ins.$0} >= 0 ? Math.pow(${ins.$0}, 0.5): 0` },
    'mtof~': { inlineLoop: ({ ins }) => ast$1 `mtof(${ins.$0})`, dependencies: [mtof] },
    'ftom~': { inlineLoop: ({ ins }) => ast$1 `ftom(${ins.$0})`, dependencies: [ftom] },
};
const builders$c = {
    'abs~': builder$D,
    'cos~': builder$D,
    'wrap~': builder$D,
    'sqrt~': builder$D,
    'mtof~': builder$D,
    'ftom~': builder$D,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const translateArgsTabBase = (pdNode) => ({
    arrayName: assertOptionalString(pdNode.args[0]) || '',
});
const variableNamesTabBase = generateVariableNamesNodeType('tabbase', [
    'setArrayName',
    'createState',
    'prepareIndex',
    'emptyArray',
]);
const nodeCoreTabBase = () => Sequence$1([
    ConstVar$1('FloatArray', variableNamesTabBase.emptyArray, 'createFloatArray(1)'),
    Class$1(variableNamesTabBase.stateClass, [
        Var$1('FloatArray', 'array'),
        Var$1('string', 'arrayName'),
        Var$1('SkedId', 'arrayChangesSubscription'),
        Var$1('Int', 'readPosition'),
        Var$1('Int', 'readUntil'),
        Var$1('Int', 'writePosition')
    ]),
    Func$1(variableNamesTabBase.createState, [
        Var$1('string', 'arrayName'),
    ], variableNamesTabBase.stateClass) `
        return {
            array: ${variableNamesTabBase.emptyArray},
            arrayName,
            arrayChangesSubscription: SKED_ID_NULL,
            readPosition: 0,
            readUntil: 0,
            writePosition: 0,
        }
    `,
    Func$1(variableNamesTabBase.setArrayName, [
        Var$1(variableNamesTabBase.stateClass, 'state'),
        Var$1('string', 'arrayName'),
        Var$1('SkedCallback', 'callback'),
    ], 'void') `
        if (state.arrayChangesSubscription != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(state.arrayChangesSubscription)
        }
        state.arrayName = arrayName
        state.array = ${variableNamesTabBase.emptyArray}
        commons_subscribeArrayChanges(arrayName, callback)
    `,
    Func$1(variableNamesTabBase.prepareIndex, [
        Var$1('Float', 'index'),
        Var$1('Int', 'arrayLength'),
    ], 'Int') `
        return toInt(Math.min(
            Math.max(
                0, Math.floor(index)
            ), toFloat(arrayLength - 1)
        ))
    `
]);

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$C = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
};
// ------------------------------ node implementation ------------------------------ //
const variableNames$v = generateVariableNamesNodeType('tabread', [
    'setArrayNameFinalize',
]);
const nodeImplementation$w = {
    initialization: ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNamesTabBase.stateClass, state, `${variableNamesTabBase.createState}("${args.arrayName}")`)}

        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames$v.setArrayNameFinalize}(${state})
                )
            }
        })
    `,
    messageReceivers: (context) => {
        const { snds, state } = context;
        return {
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                    if (${state}.array.length === 0) {
                        ${snds.$0}(msg_floats([0]))

                    } else {
                        ${snds.$0}(msg_floats([${state}.array[
                            ${variableNamesTabBase.prepareIndex}(
                                msg_readFloatToken(m, 0), 
                                ${state}.array.length
                            )
                        ]]))
                    }
                    return 

                } else if (
                    msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                    && msg_readStringToken(m, 0) === 'set'
                ) {
                    ${variableNamesTabBase.setArrayName}(
                        ${state}, 
                        msg_readStringToken(m, 1),
                        () => ${variableNames$v.setArrayNameFinalize}(${state})
                    )
                    return
            
                }
            `,
        };
    },
    dependencies: [
        commonsWaitEngineConfigure,
        commonsArrays,
        nodeCoreTabBase,
        () => Sequence$1([
            Func$1(variableNames$v.setArrayNameFinalize, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
            ], 'void') `
                state.array = commons_getArray(state.arrayName)
            `,
        ]),
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$B = {
    translateArgs: translateArgsTabBase,
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
};
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$u = generateVariableNamesNodeType('tabwrite', [
    'setArrayNameFinalize',
    'setWritePosition',
]);
const nodeImplementation$v = {
    initialization: ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNamesTabBase.stateClass, state, `${variableNamesTabBase.createState}("${args.arrayName}")`)}

        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames$u.setArrayNameFinalize}(${state})
                )
            }
        })
    `,
    messageReceivers: (context) => {
        const { state } = context;
        return {
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {        
                    if (${state}.array.length === 0) {
                        return
    
                    } else {
                        ${state}.array[${state}.writePosition] = msg_readFloatToken(m, 0)
                        return
                    }
    
                } else if (
                    msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                    && msg_readStringToken(m, 0) === 'set'
                ) {
                    ${variableNamesTabBase.setArrayName}(
                        ${state}, 
                        msg_readStringToken(m, 1),
                        () => ${variableNames$u.setArrayNameFinalize}(${state}),
                    )
                    return
            
                }
            `,
            '1': coldFloatInletWithSetter(variableNames$u.setWritePosition, state)
        };
    },
    dependencies: [
        commonsWaitEngineConfigure,
        commonsArrays,
        nodeCoreTabBase,
        () => Sequence$1([
            Func$1(variableNames$u.setArrayNameFinalize, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
            ], 'void') `
                state.array = commons_getArray(state.arrayName)
            `,
            Func$1(variableNames$u.setWritePosition, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
                Var$1('Float', 'writePosition')
            ], 'void') `
                state.writePosition = ${variableNamesTabBase.prepareIndex}(writePosition, state.array.length)
            `
        ]),
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : tabread4 interpolation algorithm
// ------------------------------- node builder ------------------------------ //
const builder$A = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------ node implementation ------------------------------ //
const variableNames$t = generateVariableNamesNodeType('tabread_t', [
    'setArrayNameFinalize',
]);
const nodeImplementation$u = {
    initialization: ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNamesTabBase.stateClass, state, `${variableNamesTabBase.createState}("${args.arrayName}")`)}

        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames$t.setArrayNameFinalize}(${state})
                )
            }
        })
    `,
    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc$1([Var$1('Message', 'm')]) `
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNamesTabBase.setArrayName}(
                    ${state},
                    msg_readStringToken(m, 1),
                    () => ${variableNames$t.setArrayNameFinalize}(${state}),
                )
                return
    
            }
        `,
    }),
    inlineLoop: ({ ins, state }) => ast$1 `${state}.array[toInt(Math.max(Math.min(Math.floor(${ins.$0}), ${state}.array.length - 1), 0))]`,
    dependencies: [
        bangUtils,
        commonsWaitEngineConfigure,
        commonsArrays,
        stringMsgUtils,
        nodeCoreTabBase,
        () => Sequence$1([
            Func$1(variableNames$t.setArrayNameFinalize, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
            ], 'void') `
                state.array = commons_getArray(state.arrayName)
            `,
        ]),
    ],
};
const builders$b = {
    'tabread~': builder$A,
    'tabread4~': builder$A,
};
const nodeImplementations$b = {
    'tabread~': nodeImplementation$u,
    'tabread4~': nodeImplementation$u,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : Should work also if array was set the play started
// ------------------------------- node builder ------------------------------ //
const builder$z = {
    translateArgs: (pdNode) => ({
        arrayName: assertOptionalString(pdNode.args[0]) || '',
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
// ------------------------------ node implementation ------------------------------ //
const variableNames$s = generateVariableNamesNodeType('tabplay_t', [
    'setArrayNameFinalize',
    'play',
    'stop',
]);
const nodeImplementation$t = {
    initialization: ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNamesTabBase.stateClass, state, `${variableNamesTabBase.createState}("${args.arrayName}")`)}

        commons_waitEngineConfigure(() => {
            if (${state}.arrayName.length) {
                ${variableNamesTabBase.setArrayName}(
                    ${state}, 
                    ${state}.arrayName,
                    () => ${variableNames$s.setArrayNameFinalize}(${state})
                )
            }
        })
    `,
    messageReceivers: ({ state }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isBang(m)) {
                ${variableNames$s.play}(${state}, 0, ${state}.array.length)
                return 
                
            } else if (msg_isAction(m, 'stop')) {
                ${variableNames$s.stop}(${state})
                return 
    
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNamesTabBase.setArrayName}(
                    ${state},
                    msg_readStringToken(m, 1),
                    () => ${variableNames$s.setArrayNameFinalize}(${state}),
                )
                return
    
            } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${variableNames$s.play}(
                    ${state},
                    toInt(msg_readFloatToken(m, 0)), 
                    ${state}.array.length
                )
                return 
    
            } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
                ${ConstVar$1('Int', 'fromSample', `toInt(msg_readFloatToken(m, 0))`)}
                ${variableNames$s.play}(
                    ${state},
                    fromSample,
                    fromSample + toInt(msg_readFloatToken(m, 1)),
                )
                return
            }
        `,
    }),
    loop: ({ state, snds, outs }) => ast$1 `
        if (${state}.readPosition < ${state}.readUntil) {
            ${outs.$0} = ${state}.array[${state}.readPosition]
            ${state}.readPosition++
            if (${state}.readPosition >= ${state}.readUntil) {
                ${snds.$1}(msg_bang())
            }
        } else {
            ${outs.$0} = 0
        }
    `,
    dependencies: [
        bangUtils,
        commonsWaitEngineConfigure,
        commonsArrays,
        stringMsgUtils,
        nodeCoreTabBase,
        () => Sequence$1([
            Func$1(variableNames$s.setArrayNameFinalize, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
            ], 'void') `
                state.array = commons_getArray(state.arrayName)
                state.readPosition = state.array.length
                state.readUntil = state.array.length
            `,
            Func$1(variableNames$s.play, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
                Var$1('Int', 'playFrom'),
                Var$1('Int', 'playTo'),
            ], 'void') `
                state.readPosition = playFrom
                state.readUntil = toInt(Math.min(
                    toFloat(playTo), 
                    toFloat(state.array.length),
                ))
            `,
            Func$1(variableNames$s.stop, [
                Var$1(variableNamesTabBase.stateClass, 'state'),
            ], 'void') `
                state.readPosition = 0
                state.readUntil = 0
            `,
        ]),
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : support for -raw (see soundfiler help)
// TODO : find a better way to factorize this code
// TODO : unit testing
const parseSoundFileOpenOpts = {
    codeGenerator: () => Func$1('parseSoundFileOpenOpts', [Var$1('Message', 'm'), Var$1('fs_SoundInfo', 'soundInfo')], 'Set<Int>') `
            ${ConstVar$1('Set<Int>', 'unhandled', 'new Set()')}
            ${Var$1('Int', 'i', '0')}
            while (i < msg_getLength(m)) {
                if (msg_isStringToken(m, i)) {
                    ${ConstVar$1('string', 'str', 'msg_readStringToken(m, i)')}
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
                            soundInfo.bitDepth = toInt(msg_readFloatToken(m, i + 1) * 8)
                            i++
                        } else {
                            console.log('failed to parse -bytes <value>')
                        }

                    } else if (str === '-rate') {
                        if (i < msg_getLength(m) && msg_isFloatToken(m, i + 1)) {
                            soundInfo.sampleRate = toInt(msg_readFloatToken(m, i + 1))
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
        `,
    dependencies: [msg$1, fsCore$1],
};
// TODO : unit testing
const parseReadWriteFsOpts = {
    codeGenerator: () => Func$1('parseReadWriteFsOpts', [
        Var$1('Message', 'm'),
        Var$1('fs_SoundInfo', 'soundInfo'),
        Var$1('Set<Int>', 'unhandledOptions'),
    ], 'string') `
            // Remove the "open" token
            unhandledOptions.delete(0)

            ${Var$1('string', 'url', '""')}
            ${Var$1('boolean', 'urlFound', 'false')}
            ${Var$1('boolean', 'errored', 'false')}
            ${Var$1('Int', 'i', '1')}
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
        `,
    dependencies: [msg$1, fsCore$1],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : check the real state machine of readsf
//      - what happens when start / stopping / start stream ?
//      - what happens when stream ended and starting again ?
//      - etc ...
// TODO : second arg : "buffer channel size" not implemented
// TODO : implement raw
// ------------------------------- node builder ------------------------------ //
const builder$y = {
    translateArgs: (pdNode) => ({
        channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
    }),
    build: (nodeArgs) => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: {
            ...mapArray(countTo$1(nodeArgs.channelCount), (channel) => [`${channel}`, { type: 'signal', id: `${channel}` }]),
            [`${nodeArgs.channelCount}`]: {
                type: 'message',
                id: `${nodeArgs.channelCount}`,
            }
        },
    })
};
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$r = generateVariableNamesNodeType('readsf_t', [
    'openStream',
]);
const nodeCore$l = ({ globs }) => Sequence$1([
    Class$1(variableNames$r.stateClass, [
        Var$1('Array<buf_SoundBuffer>', 'buffers'),
        Var$1('fs_OperationId', 'streamOperationId'),
        Var$1('Int', 'readingStatus'),
    ]),
    Func$1(variableNames$r.openStream, [
        Var$1(variableNames$r.stateClass, 'state'),
        Var$1('Message', 'm'),
        Var$1('Int', 'channelCount'),
        Var$1('fs_OperationCallback', 'onStreamClose'),
    ], 'void') `
        if (state.streamOperationId !== -1) {
            state.readingStatus = 3
            fs_closeSoundStream(state.streamOperationId, FS_OPERATION_SUCCESS)
        }

        ${ConstVar$1('fs_SoundInfo', 'soundInfo', `{
            channelCount,
            sampleRate: toInt(${globs.sampleRate}),
            bitDepth: 32,
            encodingFormat: '',
            endianness: '',
            extraOptions: '',
        }`)}
        ${ConstVar$1('Set<Int>', 'unhandledOptions', `parseSoundFileOpenOpts(
            m,
            soundInfo,
        )`)}
        ${ConstVar$1('string', 'url', `parseReadWriteFsOpts(
            m,
            soundInfo,
            unhandledOptions
        )`)}
        if (url.length === 0) {
            return
        }
        state.streamOperationId = fs_openSoundReadStream(
            url,
            soundInfo,
            onStreamClose,
        )
        state.buffers = _FS_SOUND_STREAM_BUFFERS.get(state.streamOperationId)
    `
]);
const initialization$k = ({ state }) => ast$1 `
        ${ConstVar$1(variableNames$r.stateClass, state, `{
            buffers: [],
            streamOperationId: -1,
            readingStatus: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$4 = ({ state, snds, outs, node: { args: { channelCount }, }, }) => ast$1 `
    switch(${state}.readingStatus) {
        case 1: 
            ${countTo$1(channelCount).map((i) => `${outs[i]} = buf_pullSample(${state}.buffers[${i}])`)}
            break
            
        case 2: 
            ${countTo$1(channelCount).map((i) => `${outs[i]} = buf_pullSample(${state}.buffers[${i}])`)}
            if (${state}.buffers[0].pullAvailableLength === 0) {
                ${snds[channelCount]}(msg_bang())
                ${state}.readingStatus = 3
            }
            break

        case 3: 
            ${countTo$1(channelCount).map((i) => `${outs[i]} = 0`)}
            ${state}.readingStatus = 0
            break
    }
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$l = ({ node, state, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_getLength(m) >= 2) {
            if (msg_isStringToken(m, 0) 
                && msg_readStringToken(m, 0) === 'open'
            ) {
                ${variableNames$r.openStream}(
                    ${state},
                    m,
                    ${node.args.channelCount},
                    ${AnonFunc$1() `
                        ${state}.streamOperationId = -1
                        if (${state}.readingStatus === 1) {
                            ${state}.readingStatus = 2
                        } else {
                            ${state}.readingStatus = 3
                        }
                    `}
                )
                return
            }

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            if (msg_readFloatToken(m, 0) === 0) {
                ${state}.readingStatus = 3
                return

            } else {
                if (${state}.streamOperationId !== -1) {
                    ${state}.readingStatus = 1
                } else {
                    console.log('[readsf~] start requested without prior open')
                }
                return

            }
            
        } else if (msg_isAction(m, 'print')) {
            console.log('[readsf~] reading = ' + ${state}.readingStatus.toString())
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$s = {
    initialization: initialization$k,
    messageReceivers: messageReceivers$l,
    loop: loop$4,
    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        bangUtils,
        stringMsgUtils,
        fsReadSoundStream,
        nodeCore$l,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const BLOCK_SIZE = 44100 * 5;
// TODO: lots of things left to implement
// TODO : check the real state machine of writesf
//      - what happens when start / stopping / start stream ? 
//      - what happens when stream ended and starting again ? 
//      - etc ...
// ------------------------------- node builder ------------------------------ //
const builder$x = {
    translateArgs: (pdNode) => ({
        channelCount: assertOptionalNumber(pdNode.args[0]) || 1,
    }),
    build: ({ channelCount }) => ({
        inlets: {
            '0_message': { type: 'message', id: '0_message' },
            ...mapArray(countTo$1(channelCount), (channel) => [
                `${channel}`,
                { type: 'signal', id: `${channel}` },
            ]),
        },
        outlets: {},
        isPullingSignal: true,
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$q = generateVariableNamesNodeType('writesf_t', [
    'flushBlock'
]);
const nodeCore$k = () => Sequence$1([
    Class$1(variableNames$q.stateClass, [
        Var$1('fs_OperationId', 'operationId'),
        Var$1('boolean', 'isWriting'),
        Var$1('Array<FloatArray>', 'block'),
        Var$1('Int', 'cursor'),
    ]),
    Func$1(variableNames$q.flushBlock, [
        Var$1(variableNames$q.stateClass, 'state'),
    ], 'void') `
        ${ConstVar$1('Array<FloatArray>', 'block', '[]')}
        for (${Var$1('Int', 'i', '0')}; i < state.block.length; i++) {
            block.push(state.block[i].subarray(0, state.cursor))
        }
        fs_sendSoundStreamData(state.operationId, block)
        state.cursor = 0
    `,
]);
const initialization$j = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$q.stateClass, state, `{
            operationId: -1,
            isWriting: false,
            cursor: 0,
            block: [
                ${countTo$1(args.channelCount).map(() => `createFloatArray(${BLOCK_SIZE})`).join(',')}
            ],
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$3 = ({ state, ins, node: { args } }) => ast$1 `
    if (${state}.isWriting === true) {
        ${countTo$1(args.channelCount).map((i) => `${state}.block[${i}][${state}.cursor] = ${ins[i]}`)}
        ${state}.cursor++
        if (${state}.cursor === ${BLOCK_SIZE}) {
            ${variableNames$q.flushBlock}(${state})
        }
    }
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$k = ({ node, state, globs }) => ({
    '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
        if (msg_getLength(m) >= 2) {
            if (
                msg_isStringToken(m, 0) 
                && msg_readStringToken(m, 0) === 'open'
            ) {
                if (${state}.operationId !== -1) {
                    fs_closeSoundStream(${state}.operationId, FS_OPERATION_SUCCESS)
                }

                ${ConstVar$1('fs_SoundInfo', 'soundInfo', `{
                    channelCount: ${node.args.channelCount},
                    sampleRate: toInt(${globs.sampleRate}),
                    bitDepth: 32,
                    encodingFormat: '',
                    endianness: '',
                    extraOptions: '',
                }`)}
                ${ConstVar$1('Set<Int>', 'unhandledOptions', `parseSoundFileOpenOpts(
                    m,
                    soundInfo,
                )`)}
                ${ConstVar$1('string', 'url', `parseReadWriteFsOpts(
                    m,
                    soundInfo,
                    unhandledOptions
                )`)}
                if (url.length === 0) {
                    return
                }
                ${state}.operationId = fs_openSoundWriteStream(
                    url,
                    soundInfo,
                    () => {
                        ${variableNames$q.flushBlock}(${state})
                        ${state}.operationId = -1
                    }
                )
                return
            }

        } else if (msg_isAction(m, 'start')) {
                ${state}.isWriting = true
                return

        } else if (msg_isAction(m, 'stop')) {
            ${variableNames$q.flushBlock}(${state})
            ${state}.isWriting = false
            return

        } else if (msg_isAction(m, 'print')) {
            console.log('[writesf~] writing = ' + ${state}.isWriting.toString())
            return
        }    
    `
});
// ------------------------------------------------------------------- //
const nodeImplementation$r = {
    initialization: initialization$j,
    messageReceivers: messageReceivers$k,
    loop: loop$3,
    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        stringMsgUtils,
        fsWriteSoundStream,
        nodeCore$k,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$w = {
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------- node implementation ------------------------------ //
const variableNames$p = generateVariableNamesNodeType('filter_bp_t', [
    'updateCoefs',
    'setFrequency',
    'setQ',
    'clear',
]);
// ------------------------------------------------------------------- //
const nodeImplementation$q = {
    initialization: ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$p.stateClass, state, `{
            frequency: ${args.frequency},
            Q: ${args.Q},
            coef1: 0,
            coef2: 0,
            gain: 0,
            y: 0,
            ym1: 0,
            ym2: 0,
        }`)}

        commons_waitEngineConfigure(() => {
            ${variableNames$p.updateCoefs}(${state})
        })
    `,
    loop: ({ ins, outs, state }) => ast$1 `
        ${state}.y = ${ins.$0} + ${state}.coef1 * ${state}.ym1 + ${state}.coef2 * ${state}.ym2
        ${outs.$0} = ${state}.gain * ${state}.y
        ${state}.ym2 = ${state}.ym1
        ${state}.ym1 = ${state}.y
    `,
    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
            if (
                msg_isMatching(m)
                && msg_readStringToken(m, 0) === 'clear'
            ) {
                ${variableNames$p.clear}()
                return 
            }
        `,
        '1': coldFloatInletWithSetter(variableNames$p.setFrequency, state),
        '2': coldFloatInletWithSetter(variableNames$p.setQ, state),
    }),
    dependencies: [
        ({ globs }) => Sequence$1([
            Class$1(variableNames$p.stateClass, [
                Var$1('Float', 'frequency'),
                Var$1('Float', 'Q'),
                Var$1('Float', 'coef1'),
                Var$1('Float', 'coef2'),
                Var$1('Float', 'gain'),
                Var$1('Float', 'y'),
                Var$1('Float', 'ym1'),
                Var$1('Float', 'ym2'),
            ]),
            Func$1(variableNames$p.updateCoefs, [
                Var$1(variableNames$p.stateClass, 'state'),
            ], 'void') `
                ${Var$1('Float', 'omega', `state.frequency * (2.0 * Math.PI) / ${globs.sampleRate}`)}
                ${Var$1('Float', 'oneminusr', `state.Q < 0.001 ? 1.0 : Math.min(omega / state.Q, 1)`)}
                ${Var$1('Float', 'r', `1.0 - oneminusr`)}
                ${Var$1('Float', 'sigbp_qcos', `(omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
                    (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
                    : 0`)}
        
                state.coef1 = 2.0 * sigbp_qcos * r
                state.coef2 = - r * r
                state.gain = 2 * oneminusr * (oneminusr + r * omega)
            `,
            Func$1(variableNames$p.setFrequency, [
                Var$1(variableNames$p.stateClass, 'state'),
                Var$1('Float', 'frequency'),
            ], 'void') `
                state.frequency = (frequency < 0.001) ? 10: frequency
                ${variableNames$p.updateCoefs}(state)
            `,
            Func$1(variableNames$p.setQ, [
                Var$1(variableNames$p.stateClass, 'state'),
                Var$1('Float', 'Q'),
            ], 'void') `
                state.Q = Math.max(Q, 0)
                ${variableNames$p.updateCoefs}(state)
            `,
            Func$1(variableNames$p.clear, [
                Var$1(variableNames$p.stateClass, 'state'),
            ], 'void') `
                state.ym1 = 0
                state.ym2 = 0
            `
        ])
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builderThrow = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '0_message': { type: 'message', id: '0_message' },
        },
        outlets: {},
        isPullingSignal: true,
    }),
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
const builderReceive$1 = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
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
const builderSend$1 = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
        },
        outlets: {},
        isPullingSignal: true,
    }),
};
const builderCatch = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {},
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$o = generateVariableNamesNodeType('throw_catch_send_receive_t', ['setBusName']);
const nodeCore$j = () => Sequence$1([
    Class$1(variableNames$o.stateClass, [
        Var$1('string', 'busName'),
    ]),
    Func$1(variableNames$o.setBusName, [
        Var$1(variableNames$o.stateClass, 'state'),
        Var$1('string', 'busName')
    ], 'void') `
        if (busName.length) {
            state.busName = busName
            resetSignalBus(state.busName)
        }
    `
]);
const initialization$i = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$o.stateClass, state, `{
            busName: '',
        }`)}

        ${variableNames$o.setBusName}(${state}, "${args.busName}")
    `;
// --------------------------------- throw~ ---------------------------------- //
const nodeImplementationThrow = {
    initialization: initialization$i,
    loop: ({ ins, state }) => ast$1 `
        addAssignSignalBus(${state}.busName, ${ins.$0})
    `,
    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNames$o.setBusName}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),
    dependencies: [
        signalBuses,
        nodeCore$j,
    ]
};
// --------------------------------- catch~ ---------------------------------- //
const nodeImplementationCatch = {
    initialization: initialization$i,
    loop: ({ outs, state, }) => ast$1 `
        ${outs.$0} = readSignalBus(${state}.busName)
        resetSignalBus(${state}.busName)
    `,
    dependencies: [
        signalBuses,
        nodeCore$j
    ],
};
// --------------------------------- send~ ---------------------------------- //
const nodeImplementationSend$1 = {
    initialization: initialization$i,
    loop: ({ state, ins }) => ast$1 `
        setSignalBus(${state}.busName, ${ins.$0})
    `,
    dependencies: [
        signalBuses,
        nodeCore$j
    ],
};
// --------------------------------- receive~ ---------------------------------- //
const nodeImplementationReceive$1 = {
    initialization: initialization$i,
    inlineLoop: ({ state }) => ast$1 `readSignalBus(${state}.busName)`,
    messageReceivers: ({ state }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${variableNames$o.setBusName}(${state}, msg_readStringToken(m, 1))
                return
            }
        `
    }),
    dependencies: [
        signalBuses,
        nodeCore$j,
    ]
};
// ------------------------------------------------------------------- //
const builders$a = {
    'throw~': builderThrow,
    'catch~': builderCatch,
    'send~': builderSend$1,
    'receive~': builderReceive$1,
};
const nodeImplementations$a = {
    'throw~': nodeImplementationThrow,
    'catch~': nodeImplementationCatch,
    'send~': nodeImplementationSend$1,
    'receive~': nodeImplementationReceive$1,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$v = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$n = generateVariableNamesNodeType('metro', [
    'setRate',
    'scheduleNextTick',
    'stop',
]);
const nodeCore$i = () => Sequence$1([
    Class$1(variableNames$n.stateClass, [
        Var$1('Float', 'rate'),
        Var$1('Float', 'sampleRatio'),
        Var$1('Int', 'skedId'),
        Var$1('Float', 'realNextTick'),
        Var$1('(m: Message) => void', 'snd0'),
        Var$1('SkedCallback', 'tickCallback'),
    ]),
    // Time units are all expressed in samples here
    Func$1(variableNames$n.setRate, [
        Var$1(variableNames$n.stateClass, 'state'),
        Var$1('Float', 'rate'),
    ], 'void') `
        state.rate = Math.max(rate, 0)
    `,
    Func$1(variableNames$n.scheduleNextTick, [
        Var$1(variableNames$n.stateClass, 'state'),
    ], 'void') `
        state.snd0(msg_bang())
        state.realNextTick = state.realNextTick + state.rate * state.sampleRatio
        state.skedId = commons_waitFrame(
            toInt(Math.round(state.realNextTick)), 
            state.tickCallback,
        )
    `,
    Func$1(variableNames$n.stop, [
        Var$1(variableNames$n.stateClass, 'state'),
    ], 'void') `
        if (state.skedId !== SKED_ID_NULL) {
            commons_cancelWaitFrame(state.skedId)
            state.skedId = SKED_ID_NULL
        }
        state.realNextTick = 0
    `,
]);
const initialization$h = ({ node: { args }, state, globs, snds, }) => ast$1 `
        ${ConstVar$1(variableNames$n.stateClass, state, ast$1 `{
            rate: 0,
            sampleRatio: 1,
            skedId: SKED_ID_NULL,
            realNextTick: -1,
            snd0: ${snds.$0},
            tickCallback: ${AnonFunc$1() ``},
        }`)}

        commons_waitEngineConfigure(() => {
            ${state}.sampleRatio = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${variableNames$n.setRate}(${state}, ${args.rate})
            ${state}.tickCallback = ${AnonFunc$1() `
                ${variableNames$n.scheduleNextTick}(${state})
            `}
        })
    `;
// ------------------------------ messageReceivers ------------------------------ //
const messageReceivers$j = ({ state, globs, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_getLength(m) === 1) {
            if (
                (msg_isFloatToken(m, 0) && msg_readFloatToken(m, 0) === 0)
                || msg_isAction(m, 'stop')
            ) {
                ${variableNames$n.stop}(${state})
                return

            } else if (
                msg_isFloatToken(m, 0)
                || msg_isBang(m)
            ) {
                ${state}.realNextTick = toFloat(${globs.frame})
                ${variableNames$n.scheduleNextTick}(${state})
                return
            }
        }
    `,
    '1': coldFloatInletWithSetter(variableNames$n.setRate, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$p = {
    initialization: initialization$h,
    messageReceivers: messageReceivers$j,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stringMsgUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
        nodeCore$i,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$u = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$m = generateVariableNamesNodeType('timer');
const nodeCore$h = () => Sequence$1([
    Class$1(variableNames$m.stateClass, [
        Var$1('Float', 'sampleRatio'),
        Var$1('Int', 'resetTime'),
    ]),
]);
const initialization$g = ({ node: { args }, state, globs }) => ast$1 `
        ${ConstVar$1(variableNames$m.stateClass, state, `{
            sampleRatio: 0,
            resetTime: 0,
        }`)}

        commons_waitEngineConfigure(() => {
            ${state}.sampleRatio = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
        })
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$i = ({ snds, globs, state, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${state}.resetTime = ${globs.frame}
            return

        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
            && msg_readStringToken(m, 0) === 'tempo'
        ) {
            ${state}.sampleRatio = computeUnitInSamples(
                ${globs.sampleRate}, 
                msg_readFloatToken(m, 1), 
                msg_readStringToken(m, 2)
            )
            return
        }
    `,
    '1': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${snds.$0}(msg_floats([toFloat(${globs.frame} - ${state}.resetTime) / ${state}.sampleRatio]))
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$o = {
    initialization: initialization$g,
    messageReceivers: messageReceivers$i,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        commonsWaitEngineConfigure,
        nodeCore$h,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$t = {
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
        isPushingMessages: true
    }),
};
// ------------------------------- node implementation ------------------------------ //
const variableNames$l = generateVariableNamesNodeType('delay', [
    'setDelay',
    'scheduleDelay',
    'stop',
]);
const nodeImplementation$n = {
    initialization: ({ node: { args }, state, globs }) => ast$1 `
        ${ConstVar$1(variableNames$l.stateClass, state, `{
            delay: 0,
            sampleRatio: 1,
            scheduledBang: SKED_ID_NULL,
        }`)}

        commons_waitEngineConfigure(() => {
            ${state}.sampleRatio = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${variableNames$l.setDelay}(${state}, ${args.delay})
        })
    `,
    messageReceivers: ({ state, globs, snds }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_getLength(m) === 1) {
                if (msg_isStringToken(m, 0)) {
                    ${ConstVar$1('string', 'action', 'msg_readStringToken(m, 0)')}
                    if (action === 'bang' || action === 'start') {
                        ${variableNames$l.scheduleDelay}(
                            ${state}, 
                            () => ${snds.$0}(msg_bang()),
                            ${globs.frame},
                        )
                        return
                    } else if (action === 'stop') {
                        ${variableNames$l.stop}(${state})
                        return
                    }
                    
                } else if (msg_isFloatToken(m, 0)) {
                    ${variableNames$l.setDelay}(${state}, msg_readFloatToken(m, 0))
                    ${variableNames$l.scheduleDelay}(
                        ${state},
                        () => ${snds.$0}(msg_bang()),
                        ${globs.frame},
                    )
                    return 
                }
            
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN, MSG_STRING_TOKEN])
                && msg_readStringToken(m, 0) === 'tempo'
            ) {
                ${state}.sampleRatio = computeUnitInSamples(
                    ${globs.sampleRate}, 
                    msg_readFloatToken(m, 1), 
                    msg_readStringToken(m, 2)
                )
                return
            }
        `,
        '1': coldFloatInletWithSetter(variableNames$l.setDelay, state)
    }),
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
        () => Sequence$1([
            Class$1(variableNames$l.stateClass, [
                Var$1('Float', 'delay', '0'),
                Var$1('Float', 'sampleRatio', '1'),
                Var$1('SkedId', 'scheduledBang', 'SKED_ID_NULL'),
            ]),
            Func$1(variableNames$l.setDelay, [
                Var$1(variableNames$l.stateClass, 'state'),
                Var$1('Float', 'delay'),
            ], 'void') `
                state.delay = Math.max(0, delay)
            `,
            Func$1(variableNames$l.scheduleDelay, [
                Var$1(variableNames$l.stateClass, 'state'),
                Var$1('SkedCallback', 'callback'),
                Var$1('Int', 'currentFrame'),
            ], 'void') `
                if (state.scheduledBang !== SKED_ID_NULL) {
                    ${variableNames$l.stop}(state)
                }
                state.scheduledBang = commons_waitFrame(toInt(
                    Math.round(
                        toFloat(currentFrame) + state.delay * state.sampleRatio)),
                    callback
                )
            `,
            Func$1(variableNames$l.stop, [
                Var$1(variableNames$l.stateClass, 'state'),
            ], 'void') `
                commons_cancelWaitFrame(state.scheduledBang)
                state.scheduledBang = SKED_ID_NULL
            `
        ])
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$s = {
    translateArgs: ({ args: [init, receive, send] }) => ({
        outputOnLoad: !!init,
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
};
// ------------------------------- node implementation ------------------------------ //
const variableNames$k = generateVariableNamesNodeType('bang', ['receiveMessage']);
const nodeImplementation$m = {
    initialization: ({ snds, state, node: { args }, }) => ast$1 `
        ${ConstVar$1(controlsCoreVariableNames.stateClass, state, `{
            value: msg_create([]),
            receiveBusName: "${args.receiveBusName}",
            sendBusName: "${args.sendBusName}",
            messageReceiver: ${controlsCoreVariableNames.defaultMessageHandler},
            messageSender: ${controlsCoreVariableNames.defaultMessageHandler},
        }`)}
    
        commons_waitEngineConfigure(() => {
            ${state}.messageReceiver = ${AnonFunc$1([Var$1('Message', 'm')]) `
                ${variableNames$k.receiveMessage}(${state}, m)
            `}
            ${state}.messageSender = ${snds.$0}
            ${controlsCoreVariableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
        })

        ${args.outputOnLoad ?
        `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))` : null}
    `,
    messageReceivers: ({ state }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            ${variableNames$k.receiveMessage}(${state}, m)
            return
        `,
    }),
    dependencies: [
        bangUtils,
        messageBuses,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
        controlsCore,
        () => Sequence$1([
            Func$1(variableNames$k.receiveMessage, [
                Var$1(controlsCoreVariableNames.stateClass, 'state'),
                Var$1('Message', 'm'),
            ], 'void') `
                if (${controlsCoreVariableNames.setSendReceiveFromMessage}(state, m) === true) {
                    return
                }
                
                ${ConstVar$1('Message', 'outMessage', 'msg_bang()')}
                state.messageSender(outMessage)
                if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                    msgBusPublish(state.sendBusName, outMessage)
                }
                return
            `
        ]),
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : use standard "unsupported message" from compile-generateDeclarations
// ------------------------------- node builder ------------------------------ //
const builder$r = {
    translateArgs: ({ args: [_, __, receive, send] }) => ({
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
};
// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation$6 = ({ name, initValue, messageMatch, }) => {
    const variableNames = generateVariableNamesNodeType(name, ['receiveMessage']);
    return {
        initialization: ({ state, node: { args }, snds, }) => ast$1 `
            ${ConstVar$1(controlsCoreVariableNames.stateClass, state, `{
                value: ${initValue},
                receiveBusName: "${args.receiveBusName}",
                sendBusName: "${args.sendBusName}",
                messageReceiver: ${controlsCoreVariableNames.defaultMessageHandler},
                messageSender: ${controlsCoreVariableNames.defaultMessageHandler},
            }`)}
        
            commons_waitEngineConfigure(() => {
                ${state}.messageReceiver = ${AnonFunc$1([Var$1('Message', 'm')]) `
                    ${variableNames.receiveMessage}(${state}, m)
                `}
                ${state}.messageSender = ${snds.$0}
                ${controlsCoreVariableNames.setReceiveBusName}(${state}, "${args.receiveBusName}")
            })
        `,
        messageReceivers: ({ state }) => ({
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                ${variableNames.receiveMessage}(${state}, m)
                return
            `,
        }),
        dependencies: [
            bangUtils,
            messageBuses,
            msgUtils,
            commonsWaitEngineConfigure,
            controlsCore,
            () => Sequence$1([
                Func$1(variableNames.receiveMessage, [
                    Var$1(controlsCoreVariableNames.stateClass, 'state'),
                    Var$1('Message', 'm'),
                ], 'void') `
                    if (msg_isBang(m)) {
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, state.value)
                        }
                        return
                    
                    } else if (
                        msg_getTokenType(m, 0) === MSG_STRING_TOKEN
                        && msg_readStringToken(m, 0) === 'set'
                    ) {
                        ${ConstVar$1('Message', 'setMessage', 'msg_slice(m, 1, msg_getLength(m))')}
                        ${messageMatch ?
                    `if (${messageMatch('setMessage')}) {` : null} 
                                state.value = setMessage    
                                return
                        ${messageMatch ?
                    '}' : null}
        
                    } else if (${controlsCoreVariableNames.setSendReceiveFromMessage}(state, m) === true) {
                        return
                        
                    } ${messageMatch ?
                    `else if (${messageMatch('m')}) {` :
                    `else {`}
                    
                        state.value = m
                        state.messageSender(state.value)
                        if (state.sendBusName !== "${EMPTY_BUS_NAME}") {
                            msgBusPublish(state.sendBusName, state.value)
                        }
                        return
        
                    }
                `
            ]),
        ],
    };
};
const builders$9 = {
    'floatatom': builder$r,
    'symbolatom': builder$r,
    'listbox': builder$r,
};
const nodeImplementations$9 = {
    'floatatom': makeNodeImplementation$6({
        name: 'floatatom',
        initValue: `msg_floats([0])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_FLOAT_TOKEN])`
    }),
    'symbolatom': makeNodeImplementation$6({
        name: 'symbolatom',
        initValue: `msg_strings([''])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_STRING_TOKEN])`
    }),
    'listbox': makeNodeImplementation$6({
        name: 'listbox',
        initValue: `msg_bang()`,
    })
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$q = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: { '0': { type: 'message', id: '0' } },
        isPushingMessages: true
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const initialization$f = ({ snds }) => ast$1 `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`;
// ------------------------------------------------------------------- //
const nodeImplementation$l = {
    initialization: initialization$f,
    dependencies: [bangUtils, commonsWaitFrame],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const roundFloatAsPdInt = () => Func$1('roundFloatAsPdInt', [
    Var$1('Float', 'value'),
], 'Float') `
        return value > 0 ? Math.floor(value): Math.ceil(value)
    `;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder$p = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$j = generateVariableNamesNodeType('float_int', [
    'setValueInt',
    'setValueFloat'
]);
const nodeCore$g = () => Sequence$1([
    Class$1(variableNames$j.stateClass, [
        Var$1('Float', 'value')
    ]),
    Func$1(variableNames$j.setValueInt, [
        Var$1(variableNames$j.stateClass, 'state'),
        Var$1('Float', 'value'),
    ], 'void') `
        state.value = roundFloatAsPdInt(value)
    `,
    Func$1(variableNames$j.setValueFloat, [
        Var$1(variableNames$j.stateClass, 'state'),
        Var$1('Float', 'value'),
    ], 'void') `
        state.value = value
    `
]);
const makeNodeImplementation$5 = (setValueVariableName) => {
    const initialization = ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$j.stateClass, state, `{
                value: 0,
            }`)}
            ${setValueVariableName}(${state}, ${args.value})
        `;
    // ------------------------------- messageReceivers ------------------------------ //
    const messageReceivers = ({ snds, state, }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${setValueVariableName}(${state}, msg_readFloatToken(m, 0))
                ${snds.$0}(msg_floats([${state}.value]))
                return 

            } else if (msg_isBang(m)) {
                ${snds.$0}(msg_floats([${state}.value]))
                return
                
            }
        `,
        '1': coldFloatInletWithSetter(setValueVariableName, state),
    });
    return {
        initialization: initialization,
        messageReceivers: messageReceivers,
    };
};
// ------------------------------------------------------------------- //
const builders$8 = {
    float: builder$p,
    f: { aliasTo: 'float' },
    int: builder$p,
    i: { aliasTo: 'int' },
};
const nodeImplementations$8 = {
    float: {
        ...makeNodeImplementation$5(variableNames$j.setValueFloat),
        dependencies: [bangUtils, nodeCore$g],
    },
    int: {
        ...makeNodeImplementation$5(variableNames$j.setValueInt),
        dependencies: [roundFloatAsPdInt, bangUtils, nodeCore$g],
    },
};

// ------------------------------- node builder ------------------------------ //
const builder$o = {
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
const makeNodeImplementation$4 = ({ operationCode, dependencies = [], }) => {
    // ------------------------------- messageReceivers ------------------------------ //
    const messageReceivers = ({ snds }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${ConstVar$1('Float', 'value', 'msg_readFloatToken(m, 0)')}
                ${snds.$0}(msg_floats([${operationCode}]))
                return
            }
        `
    });
    return { messageReceivers: messageReceivers, dependencies };
};
// ------------------------------------------------------------------- //
const nodeImplementations$7 = {
    'abs': makeNodeImplementation$4({ operationCode: `Math.abs(value)` }),
    'wrap': makeNodeImplementation$4({ operationCode: `(1 + (value % 1)) % 1` }),
    'cos': makeNodeImplementation$4({ operationCode: `Math.cos(value)` }),
    'sqrt': makeNodeImplementation$4({ operationCode: `value >= 0 ? Math.pow(value, 0.5): 0` }),
    'mtof': makeNodeImplementation$4({ operationCode: `mtof(value)`, dependencies: [mtof] }),
    'ftom': makeNodeImplementation$4({ operationCode: `ftom(value)`, dependencies: [ftom] }),
    'rmstodb': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : 20 * Math.log(value) / Math.LN10 + 100` }),
    'dbtorms': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 20)` }),
    'powtodb': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : 10 * Math.log(value) / Math.LN10 + 100` }),
    'dbtopow': makeNodeImplementation$4({ operationCode: `value <= 0 ? 0 : Math.exp(Math.LN10 * (value - 100) / 10)` }),
    // Implement vu as a noop
    'vu': makeNodeImplementation$4({ operationCode: `value` }),
};
const builders$7 = {
    'abs': builder$o,
    'cos': builder$o,
    'wrap': builder$o,
    'sqrt': builder$o,
    'mtof': builder$o,
    'ftom': builder$o,
    'rmstodb': builder$o,
    'dbtorms': builder$o,
    'powtodb': builder$o,
    'dbtopow': builder$o,
    'vu': builder$o,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
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
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection(inletId, nodeArgs) {
        if (inletId === '0') {
            return { initialSignalValue: 0 };
        }
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.value };
        }
        return undefined;
    },
});
// ------------------------------- node implementation ------------------------------ //
const nodeImplementations$6 = {
    '+~': {
        inlineLoop: ({ ins }) => ast$1 `${ins.$0} + ${ins.$1}`,
    },
    '-~': {
        inlineLoop: ({ ins }) => ast$1 `${ins.$0} - ${ins.$1}`,
    },
    '*~': {
        inlineLoop: ({ ins }) => ast$1 `${ins.$0} * ${ins.$1}`,
    },
    '/~': {
        inlineLoop: ({ ins }) => ast$1 `${ins.$1} !== 0 ? ${ins.$0} / ${ins.$1} : 0`,
    },
    'min~': {
        inlineLoop: ({ ins }) => ast$1 `Math.min(${ins.$0}, ${ins.$1})`,
    },
    'max~': {
        inlineLoop: ({ ins }) => ast$1 `Math.max(${ins.$0}, ${ins.$1})`,
    },
    'pow~': {
        inlineLoop: ({ ins }) => ast$1 `pow(${ins.$0}, ${ins.$1})`,
        dependencies: [pow],
    },
};
const builders$6 = {
    '+~': makeBuilder$1(0),
    '-~': makeBuilder$1(0),
    '*~': makeBuilder$1(0),
    '/~': makeBuilder$1(0),
    'min~': makeBuilder$1(0),
    'max~': makeBuilder$1(0),
    'pow~': makeBuilder$1(0),
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : implement seed
// ------------------------------- node builder ------------------------------ //
const builder$n = {
    translateArgs: () => ({}),
    build: () => {
        return {
            inlets: {
                '0': { type: 'message', id: '0' },
            },
            outlets: {
                '0': { type: 'signal', id: '0' },
            },
        };
    },
};
// ------------------------------- loop ------------------------------ //
const inlineLoop = () => ast$1 `Math.random() * 2 - 1`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$h = ({ globs }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'seed'
        ) {
            console.log('WARNING : seed not implemented yet for [noise~]')
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$k = {
    inlineLoop: inlineLoop,
    messageReceivers: messageReceivers$h,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : how to safely declare a global variable without clashing
const delayBuffers = {
    codeGenerator: () => Sequence$1([
        ConstVar$1('Map<string, buf_SoundBuffer>', 'DELAY_BUFFERS', 'new Map()'),
        ConstVar$1('Skeduler', 'DELAY_BUFFERS_SKEDULER', 'sked_create(true)'),
        ConstVar$1('buf_SoundBuffer', 'DELAY_BUFFERS_NULL', 'buf_create(1)'),
        Func$1('DELAY_BUFFERS_set', [Var$1('string', 'delayName'), Var$1('buf_SoundBuffer', 'buffer')], 'void') `
            DELAY_BUFFERS.set(delayName, buffer)
            sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
        `,
        Func$1('DELAY_BUFFERS_get', [
            Var$1('string', 'delayName'),
            Var$1('SkedCallback', 'callback'),
        ], 'void') `
            sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
        `,
        Func$1('DELAY_BUFFERS_delete', [Var$1('string', 'delayName')], 'void') `
            DELAY_BUFFERS.delete(delayName)
        `,
    ]),
    dependencies: [bufCore$1, sked],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : Implement 4-point interpolation for delread4
// ------------------------------- node builder ------------------------------ //
const builder$m = {
    translateArgs: ({ args }) => ({
        delayName: assertOptionalString(args[0]) || '',
        initDelayMsec: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { initDelayMsec }) => {
        if (inletId === '0') {
            return { initialSignalValue: initDelayMsec };
        }
        return undefined;
    },
};
// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation$3 = () => {
    const variableNames = generateVariableNamesNodeType('delread', ['setDelayName']);
    return {
        initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames.stateClass, state, `{
                delayName: '',
                buffer: DELAY_BUFFERS_NULL,
            }`)}

            commons_waitEngineConfigure(() => {
                if ("${args.delayName}".length) {
                    ${variableNames.setDelayName}(${state}, "${args.delayName}", () => {
                        ${state}.buffer = DELAY_BUFFERS.get(${state}.delayName)
                    })
                }
            })
        `,
        inlineLoop: ({ globs, ins, state }) => ast$1 `buf_readSample(${state}.buffer, toInt(Math.round(
            Math.min(
                Math.max(computeUnitInSamples(${globs.sampleRate}, ${ins.$0}, "msec"), 0), 
                toFloat(${state}.buffer.length - 1)
            )
        )))`,
        dependencies: [
            computeUnitInSamples,
            delayBuffers,
            commonsWaitEngineConfigure,
            bufWriteRead,
            () => Sequence$1([
                Class$1(variableNames.stateClass, [
                    Var$1('string', 'delayName'),
                    Var$1('buf_SoundBuffer', 'buffer'),
                ]),
                Func$1(variableNames.setDelayName, [
                    Var$1(variableNames.stateClass, 'state'),
                    Var$1('string', 'delayName'),
                    Var$1('SkedCallback', 'callback'),
                ], 'void') `
                    if (state.delayName.length) {
                        state.buffer = DELAY_BUFFERS_NULL
                    }
                    state.delayName = delayName
                    if (state.delayName.length) {
                        DELAY_BUFFERS_get(state.delayName, callback)
                    }
                `
            ]),
        ],
    };
};
const builders$5 = {
    'delread~': builder$m,
    'delread4~': builder$m,
};
const nodeImplementations$5 = {
    'delread~': makeNodeImplementation$3(),
    'delread4~': makeNodeImplementation$3(),
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : default maxDurationMsec in Pd ? 
// ------------------------------- node builder ------------------------------ //
const builder$l = {
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------- node implementation ------------------------------ //
const variableNames$i = generateVariableNamesNodeType('delwrite', ['setDelayName']);
const nodeImplementation$j = {
    loop: ({ ins, state }) => ast$1 `buf_writeSample(${state}.buffer, ${ins.$0})`,
    messageReceivers: ({ state }) => ({
        '0_message': AnonFunc$1([Var$1('Message', 'm')], 'void') `
            if (msg_isAction(m, 'clear')) {
                buf_clear(${state}.buffer)
                return
            }
        `
    }),
    initialization: ({ node: { args }, state, globs }) => ast$1 `
        ${ConstVar$1(variableNames$i.stateClass, state, `{
            delayName: '',
            buffer: DELAY_BUFFERS_NULL,
        }`)}

        commons_waitEngineConfigure(() => {
            ${state}.buffer = buf_create(
                toInt(Math.ceil(computeUnitInSamples(
                    ${globs.sampleRate}, 
                    ${args.maxDurationMsec},
                    "msec"
                )))
            )
            if ("${args.delayName}".length) {
                ${variableNames$i.setDelayName}(${state}, "${args.delayName}")
            }
        })
    `,
    dependencies: [
        computeUnitInSamples,
        delayBuffers,
        stringMsgUtils,
        () => Sequence$1([
            Class$1(variableNames$i.stateClass, [
                Var$1('string', 'delayName'),
                Var$1('buf_SoundBuffer', 'buffer'),
            ]),
            Func$1(variableNames$i.setDelayName, [
                Var$1(variableNames$i.stateClass, 'state'),
                Var$1('string', 'delayName')
            ], 'void') `
                if (state.delayName.length) {
                    DELAY_BUFFERS_delete(state.delayName)
                }
                state.delayName = delayName
                if (state.delayName.length) {
                    DELAY_BUFFERS_set(state.delayName, state.buffer)
                }
            `
        ])
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$k = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { initValue }) => {
        if (inletId === '1') {
            return { initialSignalValue: initValue };
        }
        return undefined;
    },
};
const makeNodeImplementation$2 = ({ generateOperation, }) => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const variableNames = generateVariableNamesNodeType('filter_r_t');
    const nodeCore = () => Sequence$1([
        Class$1(variableNames.stateClass, [
            Var$1('Float', 'lastOutput'),
            Var$1('Float', 'lastInput'),
        ]),
    ]);
    const initialization = ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames.stateClass, state, `{
                lastOutput: 0,
                lastInput: 0,
            }`)}
        `;
    // ------------------------------- loop ------------------------------ //
    const loop = ({ ins, state, outs }) => ast$1 `
        ${state}.lastOutput = ${outs.$0} = ${generateOperation(ins.$0, ins.$1, `${state}.lastOutput`, `${state}.lastInput`)}
        ${state}.lastInput = ${ins.$0}
    `;
    return {
        initialization: initialization,
        loop: loop,
        dependencies: [nodeCore],
    };
};
// ------------------------------------------------------------------- //
const builders$4 = {
    'rpole~': builder$k,
    'rzero~': builder$k,
    'rzero_rev~': builder$k,
};
const nodeImplementations$4 = {
    'rpole~': makeNodeImplementation$2({
        generateOperation: (input, coeff, lastOutput) => `${input} + ${coeff} * ${lastOutput}`,
    }),
    'rzero~': makeNodeImplementation$2({
        generateOperation: (input, coeff, _, lastInput) => `${input} - ${coeff} * ${lastInput}`,
    }),
    'rzero_rev~': makeNodeImplementation$2({
        generateOperation: (input, coeff, _, lastInput) => `${lastInput} - ${coeff} * ${input}`
    }),
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : tests + cleaner implementations
// TODO : separate cfilters with lastInputRe lastInputIm from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$j = {
    translateArgs: ({ args }) => ({
        initCoeffRe: assertOptionalNumber(args[0]) || 0,
        initCoeffIm: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
            '2': { type: 'signal', id: '2' },
            '3': { type: 'signal', id: '3' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
    configureMessageToSignalConnection: (inletId, { initCoeffIm, initCoeffRe }) => {
        if (inletId === '0') {
            return { initialSignalValue: 0 };
        }
        if (inletId === '1') {
            return { initialSignalValue: 0 };
        }
        if (inletId === '2') {
            return { initialSignalValue: initCoeffRe };
        }
        if (inletId === '3') {
            return { initialSignalValue: initCoeffIm };
        }
        return undefined;
    },
};
// ------------------------------- node implementation ------------------------------ //
const makeNodeImplementation$1 = ({ generateOperationRe, generateOperationIm, }) => {
    const variableNames = generateVariableNamesNodeType('filter_c_t');
    return {
        initialization: ({ state }) => ast$1 `
            ${ConstVar$1(variableNames.stateClass, state, `{
                lastOutputRe: 0,
                lastOutputIm: 0,
                lastInputRe: 0,
                lastInputIm: 0,
            }`)}
        `,
        loop: ({ ins, state, outs }) => ast$1 `
            ${outs.$0} = ${generateOperationRe(ins.$0, ins.$1, ins.$2, ins.$3, `${state}.lastOutputRe`, `${state}.lastOutputIm`, `${state}.lastInputRe`, `${state}.lastInputIm`)}
            ${state}.lastOutputIm = ${outs.$1} = ${generateOperationIm(ins.$0, ins.$1, ins.$2, ins.$3, `${state}.lastOutputRe`, `${state}.lastOutputIm`, `${state}.lastInputRe`, `${state}.lastInputIm`)}
            ${state}.lastOutputRe    = ${outs.$0}
            ${state}.lastInputRe = ${ins.$0}
            ${state}.lastInputIm = ${ins.$1}
        `,
        dependencies: [
            () => Sequence$1([
                Class$1(variableNames.stateClass, [
                    Var$1('Float', 'lastOutputRe'),
                    Var$1('Float', 'lastOutputIm'),
                    Var$1('Float', 'lastInputRe'),
                    Var$1('Float', 'lastInputIm'),
                ]),
            ])
        ]
    };
};
// ------------------------------------------------------------------- //
const builders$3 = {
    'cpole~': builder$j,
    'czero~': builder$j,
};
const nodeImplementations$3 = {
    'cpole~': makeNodeImplementation$1({
        // *outre++ = nextre + lastre * coefre - lastim * coefim
        generateOperationRe: (inputRe, _, coeffRe, coeffIm, lastOutputRe, lastOutputIm) => `${inputRe} + ${lastOutputRe} * ${coeffRe} - ${lastOutputIm} * ${coeffIm}`,
        // *outim++ = nextim + lastre * coefim + lastim * coefre;
        generateOperationIm: (_, inputIm, coeffRe, coeffIm, lastOutputRe, lastOutputIm) => `${inputIm} + ${lastOutputRe} * ${coeffIm} + ${lastOutputIm} * ${coeffRe}`,
    }),
    'czero~': makeNodeImplementation$1({
        // *outre++ = nextre - lastre * coefre + lastim * coefim;
        generateOperationRe: (inputRe, _, coeffRe, coeffIm, __, ___, lastInputRe, lastInputIm) => `${inputRe} - ${lastInputRe} * ${coeffRe} + ${lastInputIm} * ${coeffIm}`,
        // *outim++ = nextim - lastre * coefim - lastim * coefre;
        generateOperationIm: (_, inputIm, coeffRe, coeffIm, __, ___, lastInputRe, lastInputIm) => `${inputIm} - ${lastInputRe} * ${coeffIm} - ${lastInputIm} * ${coeffRe}`,
    }),
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : very inneficient compute coeff at each iter
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$i = {
    translateArgs: ({ args }) => ({
        initValue: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, nodeArgs) => {
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.initValue };
        }
        return undefined;
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$h = generateVariableNamesNodeType('hip_t');
const nodeCore$f = () => Sequence$1([
    Class$1(variableNames$h.stateClass, [
        Var$1('Float', 'previous'),
        Var$1('Float', 'current'),
        Var$1('Float', 'coeff'),
        Var$1('Float', 'normal'),
    ]),
]);
const initialization$e = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$h.stateClass, state, `{
            previous: 0,
            current: 0,
            coeff: 0,
            normal: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$2 = ({ ins, state, outs, globs }) => ast$1 `
    ${state}.coeff = Math.min(Math.max(1 - ${ins.$1} * (2 * Math.PI) / ${globs.sampleRate}, 0), 1)
    ${state}.normal = 0.5 * (1 + ${state}.coeff)
    ${state}.current = ${ins.$0} + ${state}.coeff * ${state}.previous
    ${outs.$0} = ${state}.normal * (${state}.current - ${state}.previous)
    ${state}.previous = ${state}.current
`;
const nodeImplementation$i = {
    initialization: initialization$e,
    loop: loop$2,
    dependencies: [nodeCore$f],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : very inneficient compute coeff at each iter
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$h = {
    translateArgs: ({ args }) => ({
        frequency: assertOptionalNumber(args[0]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
        },
    }),
    configureMessageToSignalConnection: (inletId, nodeArgs) => {
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.frequency };
        }
        return undefined;
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$g = generateVariableNamesNodeType('lop_t', ['setFreq']);
const nodeCore$e = ({ globs }) => Sequence$1([
    Class$1(variableNames$g.stateClass, [
        Var$1('Float', 'previous'),
        Var$1('Float', 'coeff'),
    ]),
    Func$1(variableNames$g.setFreq, [
        Var$1(variableNames$g.stateClass, 'state'),
        Var$1('Float', 'freq'),
    ], 'void') `
        state.coeff = Math.max(Math.min(freq * 2 * Math.PI / ${globs.sampleRate}, 1), 0)
    `
]);
const initialization$d = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$g.stateClass, state, `{
            previous: 0,
            coeff: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop$1 = ({ ins, state, outs }) => ast$1 `
    ${variableNames$g.setFreq}(${state}, ${ins.$1})
    ${state}.previous = ${outs.$0} = ${state}.coeff * ${ins.$0} + (1 - ${state}.coeff) * ${state}.previous
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$g = ({ state }) => ({
    '1': coldFloatInletWithSetter(variableNames$g.setFreq, state),
});
const nodeImplementation$h = {
    initialization: initialization$d,
    loop: loop$1,
    messageReceivers: messageReceivers$g,
    dependencies: [nodeCore$e],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : this uses bp~ implementation, not vcf. Rewrite using pd's implementation : 
// https://github.com/pure-data/pure-data/blob/master/src/d_osc.c
// ------------------------------- node builder ------------------------------ //
const builder$g = {
    translateArgs: ({ args }) => ({
        frequency: assertOptionalNumber(args[0]) || 0,
        Q: assertOptionalNumber(args[1]) || 0,
    }),
    build: () => ({
        inlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
            '2': { type: 'message', id: '2' },
        },
        outlets: {
            '0': { type: 'signal', id: '0' },
            '1': { type: 'signal', id: '1' },
        },
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$f = generateVariableNamesNodeType('vcf_t', [
    'updateCoefs',
    'setFrequency',
    'setQ',
]);
const nodeCore$d = ({ globs }) => Sequence$1([
    Class$1(variableNames$f.stateClass, [
        Var$1('Float', 'frequency'),
        Var$1('Float', 'Q'),
        Var$1('Float', 'coef1'),
        Var$1('Float', 'coef2'),
        Var$1('Float', 'gain'),
        Var$1('Float', 'y'),
        Var$1('Float', 'ym1'),
        Var$1('Float', 'ym2'),
    ]),
    Func$1(variableNames$f.updateCoefs, [
        Var$1(variableNames$f.stateClass, 'state'),
    ], 'void') `
        ${Var$1('Float', 'omega', `state.frequency * (2.0 * Math.PI) / ${globs.sampleRate}`)}
        ${Var$1('Float', 'oneminusr', `state.Q < 0.001 ? 1.0 : Math.min(omega / state.Q, 1)`)}
        ${Var$1('Float', 'r', `1.0 - oneminusr`)}
        ${Var$1('Float', 'sigbp_qcos', `(omega >= -(0.5 * Math.PI) && omega <= 0.5 * Math.PI) ? 
            (((Math.pow(omega, 6) * (-1.0 / 720.0) + Math.pow(omega, 4) * (1.0 / 24)) - Math.pow(omega, 2) * 0.5) + 1)
            : 0`)}

        state.coef1 = 2.0 * sigbp_qcos * r
        state.coef2 = - r * r
        state.gain = 2 * oneminusr * (oneminusr + r * omega)
    `,
    Func$1(variableNames$f.setFrequency, [
        Var$1(variableNames$f.stateClass, 'state'),
        Var$1('Float', 'frequency'),
    ], 'void') `
        state.frequency = (frequency < 0.001) ? 10: frequency
        ${variableNames$f.updateCoefs}(state)
    `,
    Func$1(variableNames$f.setQ, [
        Var$1(variableNames$f.stateClass, 'state'),
        Var$1('Float', 'Q'),
    ], 'void') `
        state.Q = Math.max(Q, 0)
        ${variableNames$f.updateCoefs}(state)
    `,
]);
const initialization$c = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$f.stateClass, state, `{
            frequency: ${args.frequency},
            Q: ${args.Q},
            coef1: 0,
            coef2: 0,
            gain: 0,
            y: 0,
            ym1: 0,
            ym2: 0,
        }`)}
    `;
// ------------------------------- loop ------------------------------ //
const loop = ({ ins, outs, state }) => ast$1 `
    ${variableNames$f.setFrequency}(${state}, ${ins.$1})
    ${state}.y = ${ins.$0} + ${state}.coef1 * ${state}.ym1 + ${state}.coef2 * ${state}.ym2
    ${outs.$1} = ${outs.$0} = ${state}.gain * ${state}.y
    ${state}.ym2 = ${state}.ym1
    ${state}.ym1 = ${state}.y
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$f = ({ state }) => ({
    '2': coldFloatInletWithSetter(variableNames$f.setQ, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$g = {
    initialization: initialization$c,
    loop: loop,
    messageReceivers: messageReceivers$f,
    dependencies: [nodeCore$d],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : msg [ symbol $1 ( has the fllowing behavior :
//      sends "" when receiving a number
//      sends <string> when receiving a string
// ------------------------------- node builder ------------------------------ //
const builder$f = {
    skipDollarArgsResolution: true,
    translateArgs: ({ args }) => {
        const templates = [[]];
        args.forEach(arg => {
            if (arg === ',') {
                templates.push([]);
            }
            else {
                templates[templates.length - 1].push(arg);
            }
        });
        return ({
            templates: templates
                .filter(template => template.length)
                .map(template => {
                if (template[0] === 'symbol') {
                    return [typeof template[1] === 'string' ? template[1] : ''];
                }
                return template;
            }),
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
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$e = generateVariableNamesNodeType('msg');
const nodeCore$c = () => Sequence$1([
    Class$1(variableNames$e.stateClass, [
        Var$1('Array<MessageTemplate>', 'outTemplates'),
        Var$1('Array<Message>', 'outMessages'),
        Var$1('Array<(m: Message) => Message>', 'messageTransferFunctions'),
    ]),
]);
const initialization$b = (context) => {
    const { node: { args }, state } = context;
    const transferCodes = args.templates.map((template, i) => buildMsgTransferCode(context, template, i));
    return ast$1 `
        ${ConstVar$1(variableNames$e.stateClass, state, `{
            outTemplates: [],
            outMessages: [],
            messageTransferFunctions: [],
        }`)}

        ${transferCodes
        .filter(({ inMessageUsed }) => !inMessageUsed)
        .map(({ outMessageCode }) => outMessageCode)}
        
        ${state}.messageTransferFunctions = [
            ${transferCodes.flatMap(({ inMessageUsed, outMessageCode }, i) => [
        AnonFunc$1([
            Var$1('Message', 'inMessage')
        ], 'Message') `
                    ${inMessageUsed ? outMessageCode : null}
                    return ${state}.outMessages[${i}]
                `, ','
    ])}
        ]
    `;
};
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$e = ({ snds, state, }) => {
    return {
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (
                msg_isStringToken(m, 0) 
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${state}.outTemplates = [[]]
                for (${Var$1('Int', 'i', '1')}; i < msg_getLength(m); i++) {
                    if (msg_isFloatToken(m, i)) {
                        ${state}.outTemplates[0].push(MSG_FLOAT_TOKEN)
                    } else {
                        ${state}.outTemplates[0].push(MSG_STRING_TOKEN)
                        ${state}.outTemplates[0].push(msg_readStringToken(m, i).length)
                    }
                }

                ${ConstVar$1('Message', 'message', `msg_create(${state}.outTemplates[0])`)}
                for (${Var$1('Int', 'i', '1')}; i < msg_getLength(m); i++) {
                    if (msg_isFloatToken(m, i)) {
                        msg_writeFloatToken(
                            message, i - 1, msg_readFloatToken(m, i)
                        )
                    } else {
                        msg_writeStringToken(
                            message, i - 1, msg_readStringToken(m, i)
                        )
                    }
                }
                ${state}.outMessages[0] = message
                ${state}.messageTransferFunctions.splice(0, ${state}.messageTransferFunctions.length - 1)
                ${state}.messageTransferFunctions[0] = ${AnonFunc$1([Var$1('Message', 'm')], 'Message') `
                    return ${state}.outMessages[0]
                `}
                return

            } else {
                for (${Var$1('Int', 'i', '0')}; i < ${state}.messageTransferFunctions.length; i++) {
                    ${snds.$0}(${state}.messageTransferFunctions[i](m))
                }
                return
            }
        `,
    };
};
// ------------------------------------------------------------------- //
const nodeImplementation$f = {
    initialization: initialization$b,
    messageReceivers: messageReceivers$e,
    dependencies: [nodeCore$c],
};
const buildMsgTransferCode = ({ state }, template, index) => {
    const outTemplate = `${state}.outTemplates[${index}]`;
    const outMessage = `${state}.outMessages[${index}]`;
    const operations = buildMessageTransferOperations(template);
    let outTemplateCode = [];
    let outMessageCode = [];
    let stringMemCount = 0;
    operations.forEach((operation, outIndex) => {
        if (operation.type === 'noop') {
            const { inIndex } = operation;
            outTemplateCode.push(ast$1 `
                ${outTemplate}.push(msg_getTokenType(inMessage, ${inIndex}))
                if (msg_isStringToken(inMessage, ${inIndex})) {
                    stringMem[${stringMemCount}] = msg_readStringToken(inMessage, ${inIndex})
                    ${outTemplate}.push(stringMem[${stringMemCount}].length)
                }
            `);
            outMessageCode.push(ast$1 `
                if (msg_isFloatToken(inMessage, ${inIndex})) {
                    msg_writeFloatToken(${outMessage}, ${outIndex}, msg_readFloatToken(inMessage, ${inIndex}))
                } else if (msg_isStringToken(inMessage, ${inIndex})) {
                    msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
                }
            `);
            stringMemCount++;
        }
        else if (operation.type === 'string-template') {
            outTemplateCode.push(ast$1 `
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
                    }`).join('\n')}
                stringMem[${stringMemCount}] = stringToken
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(stringMem[${stringMemCount}].length)
            `);
            outMessageCode.push(ast$1 `
                msg_writeStringToken(${outMessage}, ${outIndex}, stringMem[${stringMemCount}])
            `);
            stringMemCount++;
        }
        else if (operation.type === 'string-constant') {
            outTemplateCode.push(ast$1 `
                ${outTemplate}.push(MSG_STRING_TOKEN)
                ${outTemplate}.push(${operation.value.length})
            `);
            outMessageCode.push(ast$1 `
                msg_writeStringToken(${outMessage}, ${outIndex}, "${operation.value}")
            `);
        }
        else if (operation.type === 'float-constant') {
            outTemplateCode.push(ast$1 `
                ${outTemplate}.push(MSG_FLOAT_TOKEN)
            `);
            outMessageCode.push(ast$1 `
                msg_writeFloatToken(${outMessage}, ${outIndex}, ${operation.value})
            `);
        }
    });
    const hasStringTemplate = operations.some((op) => op.type === 'string-template');
    const inMessageUsed = operations.some((op) => op.type === 'noop' || op.type === 'string-template');
    return {
        inMessageUsed,
        outMessageCode: ast$1 `
            ${hasStringTemplate ? Var$1('string', 'stringToken') : null}
            ${hasStringTemplate ? Var$1('string', 'otherStringToken') : null}
            ${inMessageUsed ? Var$1('Array<string>', 'stringMem', '[]') : null}
            ${outTemplate} = []
            ${outTemplateCode}
            ${outMessage} = msg_create(${outTemplate})
            ${outMessageCode}
        `
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : implement missing list operations
// ------------------------------- node builder ------------------------------ //
const builder$e = {
    translateArgs: ({ args }) => {
        const operation = assertOptionalString(args[0]) || 'append';
        let operationArgs = args.slice(1);
        switch (operation) {
            case 'split':
                operationArgs = [assertOptionalNumber(args[1]) || 0];
                break;
            case 'trim':
            case 'length':
                operationArgs = [];
                break;
            case 'append':
            case 'prepend':
                break;
            case 'fromsymbol':
            case 'tosymbol':
            case 'store':
                throw new Error(`list operation ${operation} not implemented yet`);
            default:
                throw new Error(`invalid list operation ${operation}`);
        }
        return {
            operation,
            operationArgs,
        };
    },
    build: ({ operation }) => {
        let inletCount = 0;
        let outletCount = 0;
        switch (operation) {
            case 'split':
                inletCount = 2;
                outletCount = 3;
                break;
            case 'trim':
            case 'length':
                inletCount = 1;
                outletCount = 1;
                break;
            case 'prepend':
            case 'append':
                inletCount = 2;
                outletCount = 1;
                break;
        }
        return {
            inlets: mapArray(countTo$1(inletCount), (i) => [`${i}`, { type: 'message', id: `${i}` }]),
            outlets: mapArray(countTo$1(outletCount), (i) => [`${i}`, { type: 'message', id: `${i}` }]),
        };
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$d = generateVariableNamesNodeType('list', ['setSplitPoint']);
const nodeCore$b = () => Sequence$1([
    Class$1(variableNames$d.stateClass, [
        Var$1('Int', 'splitPoint'),
        Var$1('Message', 'currentList'),
    ]),
    Func$1(variableNames$d.setSplitPoint, [
        Var$1(variableNames$d.stateClass, 'state'),
        Var$1('Float', 'value'),
    ], 'void') `
        state.splitPoint = toInt(value)
    `
]);
const initialization$a = ({ node: { args }, state }) => ast$1 `
    ${ConstVar$1(variableNames$d.stateClass, state, `{
        splitPoint: 0,
        currentList: msg_create([]),
    }`)}

    ${args.operation === 'split' ?
    `${state}.splitPoint = ${args.operationArgs[0]}` : null}

    ${args.operation === 'append' || args.operation === 'prepend' ? ast$1 ` 
        {
            ${ConstVar$1('MessageTemplate', 'template', `[${args.operationArgs.map((arg) => typeof arg === 'string' ?
    `MSG_STRING_TOKEN,${arg.length}`
    : `MSG_FLOAT_TOKEN`).join(',')}]`)}

            ${state}.currentList = msg_create(template)

            ${args.operationArgs.map((arg, i) => typeof arg === 'string' ?
    `msg_writeStringToken(${state}.currentList, ${i}, "${arg}")`
    : `msg_writeFloatToken(${state}.currentList, ${i}, ${arg})`)}
        }
    ` : null}
`;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$d = ({ snds, state, node: { args } }) => {
    const prepareInMessage = ConstVar$1('Message', 'inMessage', `msg_isBang(m) ? msg_create([]): m`);
    switch (args.operation) {
        case 'split':
            return {
                '0': AnonFunc$1([Var$1('Message', 'm')]) `
                    ${prepareInMessage}
                    if (msg_getLength(inMessage) < ${state}.splitPoint) {
                        ${snds.$2}(m)
                        return
                    } else if (msg_getLength(inMessage) === ${state}.splitPoint) {
                        ${snds.$1}(msg_bang())
                        ${snds.$0}(m)
                        return
                    }
                    ${ConstVar$1('Message', 'outMessage1', `msg_slice(inMessage, ${state}.splitPoint, msg_getLength(inMessage))`)}
                    ${ConstVar$1('Message', 'outMessage0', `msg_slice(inMessage, 0, ${state}.splitPoint)`)}
                    ${snds.$1}(msg_getLength(outMessage1) === 0 ? msg_bang(): outMessage1)
                    ${snds.$0}(msg_getLength(outMessage0) === 0 ? msg_bang(): outMessage0)
                    return
                `,
                '1': coldFloatInletWithSetter(variableNames$d.setSplitPoint, state),
            };
        case 'trim':
            return {
                '0': AnonFunc$1([Var$1('Message', 'm')]) `
                    ${snds.$0}(m)
                    return
                `
            };
        case 'length':
            return {
                '0': AnonFunc$1([Var$1('Message', 'm')]) `
                    if (msg_isBang(m)) {
                        ${snds.$0}(msg_floats([0]))
                    } else {
                        ${snds.$0}(msg_floats([toFloat(msg_getLength(m))]))
                    }
                    return
                `
            };
        case 'append':
        case 'prepend':
            const appendPrependOutMessageCode = args.operation === 'prepend' ?
                `msg_concat(${state}.currentList, m)`
                : `msg_concat(m, ${state}.currentList)`;
            return {
                '0': AnonFunc$1([Var$1('Message', 'm')]) `
                    if (msg_isBang(m)) {
                        ${snds.$0}(msg_getLength(${state}.currentList) === 0 ? msg_bang(): ${state}.currentList)
                    } else {
                        ${snds.$0}(msg_getLength(${state}.currentList) === 0 && msg_getLength(m) === 0 ? msg_bang(): ${appendPrependOutMessageCode})
                    }
                    return
                `,
                '1': AnonFunc$1([Var$1('Message', 'm')]) `
                    ${prepareInMessage}
                    ${state}.currentList = inMessage
                    return
                `
            };
        case 'length':
        default:
            throw new Error(`unknown list operation ${args.operation}`);
    }
};
// ------------------------------------------------------------------- //
const nodeImplementation$e = {
    messageReceivers: messageReceivers$d,
    initialization: initialization$a,
    dependencies: [bangUtils, msgUtils, nodeCore$b]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder$d = {
    translateArgs: (pdNode) => ({
        value: assertOptionalString(pdNode.args[0]) || '',
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$c = generateVariableNamesNodeType('symbol');
const nodeCore$a = () => Sequence$1([
    Class$1(variableNames$c.stateClass, [
        Var$1('string', 'value')
    ]),
]);
const initialization$9 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$c.stateClass, state, `{
            value: "${args.value}"
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$c = ({ snds, state, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${snds.$0}(msg_strings([${state}.value]))
            return

        } else if (msg_isMatching(m, [MSG_STRING_TOKEN])) {
            ${state}.value = msg_readStringToken(m, 0)
            ${snds.$0}(msg_strings([${state}.value]))
            return

        }
    `,
    '1': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isMatching(m, [MSG_STRING_TOKEN])) {
            ${state}.value = msg_readStringToken(m, 0)
            return 
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$d = {
    messageReceivers: messageReceivers$c,
    initialization: initialization$9,
    dependencies: [
        bangUtils,
        messageBuses,
        nodeCore$a,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builderSend = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {},
    }),
};
const builderReceive = {
    translateArgs: (pdNode) => ({
        busName: assertOptionalString(pdNode.args[0]) || '',
    }),
    build: () => ({
        inlets: {},
        outlets: {
            '0': { type: 'message', id: '0' },
        },
        isPushingMessages: true
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$b = generateVariableNamesNodeType('send');
const nodeCore$9 = () => Sequence$1([
    Class$1(variableNames$b.stateClass, [
        Var$1('string', 'busName')
    ]),
]);
// -------------------------------- send ----------------------------------- //
const nodeImplementationSend = {
    initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$b.stateClass, state, `{
                busName: "${args.busName}",
            }`)}
        `,
    messageReceivers: ({ state, }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            msgBusPublish(${state}.busName, m)
            return
        `,
        '1': coldStringInlet(`${state}.busName`)
    }),
    dependencies: [
        messageBuses,
        commonsWaitEngineConfigure,
        nodeCore$9,
    ],
};
// -------------------------------- receive ----------------------------------- //
const nodeImplementationReceive = {
    initialization: ({ node: { args }, snds }) => ast$1 `
            commons_waitEngineConfigure(() => {
                msgBusSubscribe("${args.busName}", ${snds.$0})
            })
        `,
    dependencies: [
        messageBuses,
        commonsWaitEngineConfigure,
    ],
};
const builders$2 = {
    send: builderSend,
    receive: builderReceive,
};
const nodeImplementations$2 = {
    send: nodeImplementationSend,
    receive: nodeImplementationReceive,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO: Implement -normalize for write operation
// TODO: Implement output headersize
// ------------------------------- node builder ------------------------------ //
const builder$c = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const variableNames$a = generateVariableNamesNodeType('soundfiler', [
    'Operation',
    'buildMessage1',
]);
const nodeCore$8 = () => Sequence$1([
    Class$1(variableNames$a.stateClass, [
        Var$1(`Map<fs_OperationId, ${variableNames$a.Operation}>`, 'operations')
    ]),
    Class$1(variableNames$a.Operation, [
        Var$1('string', 'url'),
        Var$1('Array<string>', 'arrayNames'),
        Var$1('boolean', 'resize'),
        Var$1('Float', 'maxSize'),
        Var$1('Float', 'framesToWrite'),
        Var$1('Float', 'skip'),
        Var$1('fs_SoundInfo', 'soundInfo'),
    ]),
    Func$1(variableNames$a.buildMessage1, [
        Var$1('fs_SoundInfo', 'soundInfo')
    ], 'Message') `
        ${ConstVar$1('Message', 'm', `msg_create([
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_FLOAT_TOKEN,
            MSG_STRING_TOKEN,
            soundInfo.endianness.length,
        ])`)}
        msg_writeFloatToken(m, 0, toFloat(soundInfo.sampleRate))
        msg_writeFloatToken(m, 1, -1) // TODO IMPLEMENT headersize
        msg_writeFloatToken(m, 2, toFloat(soundInfo.channelCount))
        msg_writeFloatToken(m, 3, Math.round(toFloat(soundInfo.bitDepth) / 8))
        msg_writeStringToken(m, 4, soundInfo.endianness)
        return m
    `
]);
const initialization$8 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$a.stateClass, state, `{
            operations: new Map(),
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$b = ({ state, globs, snds }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (
            msg_getLength(m) >= 3 
            && msg_isStringToken(m, 0)
            && (
                msg_readStringToken(m, 0) === 'read'
                || msg_readStringToken(m, 0) === 'write'
            )
        ) {
            ${ConstVar$1('string', 'operationType', `msg_readStringToken(m, 0)`)}
            ${ConstVar$1('fs_SoundInfo', 'soundInfo', `{
                channelCount: 0,
                sampleRate: toInt(${globs.sampleRate}),
                bitDepth: 32,
                encodingFormat: '',
                endianness: '',
                extraOptions: '',
            }`)}
            ${ConstVar$1(variableNames$a.Operation, 'operation', `{
                arrayNames: [],
                resize: false,
                maxSize: -1,
                skip: 0,
                framesToWrite: 0,
                url: '',
                soundInfo,
            }`)}
            ${Var$1('Set<Int>', 'unhandledOptions', `parseSoundFileOpenOpts(
                m,
                soundInfo,
            )`)}
            
            // Remove the operation type
            unhandledOptions.delete(0)
            
            ${Var$1('Int', 'i', '1')}
            ${Var$1('string', 'str', '""')}
            while (i < msg_getLength(m)) {
                if (!unhandledOptions.has(i)) {

                } else if (msg_isStringToken(m, i)) {
                    str = msg_readStringToken(m, i)
                    if (str === '-resize') {
                        unhandledOptions.delete(i)
                        operation.resize = true

                    } else if (str === '-maxsize' || str === '-nframes') {
                        unhandledOptions.delete(i)
                        if (
                            i + 1 >= msg_getLength(m) 
                            || !msg_isFloatToken(m, i + 1)
                        ) {
                            console.log("invalid value for -maxsize")
                        }
                        operation.maxSize = msg_readFloatToken(m, i + 1)
                        unhandledOptions.delete(i + 1)
                        i++

                    } else if (str === '-skip') {
                        unhandledOptions.delete(i)
                        if (
                            i + 1 >= msg_getLength(m) 
                            || !msg_isFloatToken(m, i + 1)
                        ) {
                            console.log("invalid value for -skip")
                        }
                        operation.skip = msg_readFloatToken(m, i + 1)
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
            ${Var$1('boolean', 'urlFound', 'false')}
            while (i < msg_getLength(m)) {
                if (!unhandledOptions.has(i)) {

                } else if (msg_isStringToken(m, i)) {
                    str = msg_readStringToken(m, i)
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
                ${ConstVar$1('fs_OperationId', 'id', ast$1 `fs_readSoundFile(
                    operation.url, 
                    soundInfo,
                    ${AnonFunc$1([
        Var$1('fs_OperationId', 'id'),
        Var$1('fs_OperationStatus', 'status'),
        Var$1('FloatArray[]', 'sound'),
    ], 'void') `
                        ${ConstVar$1(variableNames$a.Operation, 'operation', `${state}.operations.get(id)`)}
                        ${state}.operations.delete(id)
                        ${Var$1('Int', 'i', '0')}
                        ${Var$1('Float', 'maxFramesRead', '0')}
                        ${Var$1('Float', 'framesToRead', '0')}
                        ${Var$1('FloatArray', 'array', 'createFloatArray(0)')}
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
    
                        ${snds.$1}(${variableNames$a.buildMessage1}(operation.soundInfo))
                        ${snds.$0}(msg_floats([maxFramesRead]))
                    `}
                )`)}

                ${state}.operations.set(id, operation)

            } else if (operationType === 'write') {
                ${Var$1('Int', 'i', '0')}
                ${Var$1('Float', 'framesToWrite', '0')}
                ${Var$1('FloatArray', 'array', 'createFloatArray(0)')}
                ${ConstVar$1('FloatArray[]', 'sound', '[]')}
                
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

                ${Func$1('callback', [
        Var$1('fs_OperationId', 'id'),
        Var$1('fs_OperationStatus', 'status'),
    ], 'void') `
                    ${ConstVar$1(variableNames$a.Operation, 'operation', `${state}.operations.get(id)`)}
                    ${state}.operations.delete(id)
                    ${snds.$1}(${variableNames$a.buildMessage1}(operation.soundInfo))
                    ${snds.$0}(msg_floats([operation.framesToWrite]))
                `}

                ${ConstVar$1('fs_OperationId', 'id', `fs_writeSoundFile(
                    sound, 
                    operation.url, 
                    soundInfo, 
                    callback
                )`)}

                ${state}.operations.set(id, operation)
            }

            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$c = {
    initialization: initialization$8,
    messageReceivers: messageReceivers$b,
    dependencies: [
        parseSoundFileOpenOpts,
        commonsArrays,
        fsReadSoundFile,
        fsWriteSoundFile,
        nodeCore$8,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$b = {
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
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$a = ({ node: { args } }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        console.log("${args.prefix} " + msg_display(m))
        return
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$b = { messageReceivers: messageReceivers$a };

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
const messageTokenToFloat = () => Func$1('messageTokenToFloat', [
    Var$1('Message', 'm'),
    Var$1('Int', 'i')
], 'Float') `
        if (msg_isFloatToken(m, i)) {
            return msg_readFloatToken(m, i)
        } else {
            return 0
        }
    `;
const messageTokenToString = () => Func$1('messageTokenToString', [
    Var$1('Message', 'm'),
    Var$1('Int', 'i')
], 'string') `
        if (msg_isStringToken(m, i)) {
            ${ConstVar$1('string', 'str', 'msg_readStringToken(m, i)')}
            if (str === 'bang') {
                return 'symbol'
            } else {
                return str
            }
        } else {
            return 'float'
        }
    `;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : 
// - pointer
// ------------------------------- node builder ------------------------------ //
const builder$a = {
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
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$9 = ({ snds, node: { args: { typeArguments } } }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        ${typeArguments.reverse().map((typeArg, i) => `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, 'm', 0)})`)}
        return
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$a = {
    messageReceivers: messageReceivers$9,
    dependencies: [
        messageTokenToFloat,
        messageTokenToString,
        bangUtils,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$9 = {
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
// ------------------------------- node implementation ------------------------------ //
const variableNames$9 = generateVariableNamesNodeType('change');
const nodeImplementation$9 = {
    initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$9.stateClass, state, `{
                currentValue: ${args.initValue}
            }`)}
        `,
    messageReceivers: ({ snds, state, }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${ConstVar$1('Float', 'newValue', 'msg_readFloatToken(m, 0)')}
                if (newValue !== ${state}.currentValue) {
                    ${state}.currentValue = newValue
                    ${snds[0]}(msg_floats([${state}.currentValue]))
                }
                return
    
            } else if (msg_isBang(m)) {
                ${snds[0]}(msg_floats([${state}.currentValue]))
                return 
    
            } else if (
                msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
                && msg_readStringToken(m, 0) === 'set'
            ) {
                ${state}.currentValue = msg_readFloatToken(m, 1)
                return
            }
        `,
    }),
    dependencies: [
        bangUtils,
        () => Sequence$1([
            Class$1(variableNames$9.stateClass, [
                Var$1('Float', 'currentValue'),
            ]),
        ])
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$8 = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$8 = generateVariableNamesNodeType('moses');
const nodeCore$7 = () => Sequence$1([
    Class$1(variableNames$8.stateClass, [
        Var$1('Float', 'threshold')
    ]),
]);
const initialization$7 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$8.stateClass, state, `{
            threshold: ${args.threshold},
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$8 = ({ snds, state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${ConstVar$1('Float', 'value', 'msg_readFloatToken(m, 0)')}
            if (value >= ${state}.threshold) {
                ${snds[1]}(msg_floats([value]))
            } else {
                ${snds[0]}(msg_floats([value]))
            }
            return
        }
    `,
    '1': coldFloatInlet(`${state}.threshold`),
});
// ------------------------------------------------------------------- //
const nodeImplementation$8 = {
    initialization: initialization$7,
    messageReceivers: messageReceivers$8, dependencies: [nodeCore$7]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$7 = {
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
// ------------------------------- node implementation ------------------------------ //
const variableNames$7 = generateVariableNamesNodeType('clip');
const nodeImplementation$7 = {
    initialization: ({ node: { args }, state }) => ast$1 `
            ${ConstVar$1(variableNames$7.stateClass, state, `{
                minValue: ${args.minValue},
                maxValue: ${args.maxValue},
            }`)}
        `,
    messageReceivers: ({ snds, state }) => ({
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                ${snds[0]}(msg_floats([
                    Math.max(
                        Math.min(
                            ${state}.maxValue, 
                            msg_readFloatToken(m, 0)
                        ), 
                        ${state}.minValue
                    )
                ]))
                return
            }
        `,
        '1': coldFloatInlet(`${state}.minValue`),
        '2': coldFloatInlet(`${state}.maxValue`),
    }),
    dependencies: [
        () => Sequence$1([
            Class$1(variableNames$7.stateClass, [
                Var$1('Float', 'minValue'),
                Var$1('Float', 'maxValue'),
            ]),
        ])
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$6 = {
    translateArgs: ({ args }) => ({
        filters: args.length ? args : [0],
    }),
    build: (args) => {
        const inlets = {
            '0': { type: 'message', id: '0' },
        };
        if (args.filters.length === 1) {
            inlets['1'] = { type: 'message', id: '1' };
        }
        return {
            inlets,
            outlets: mapArray(args.filters.length ? countTo$1(args.filters.length + 1) : [0, 1], (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
        };
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$6 = generateVariableNamesNodeType('route');
const nodeCore$6 = () => Sequence$1([
    Class$1(variableNames$6.stateClass, [
        Var$1('Float', 'floatFilter'),
        Var$1('string', 'stringFilter'),
        Var$1('Int', 'filterType'),
    ]),
]);
const initialization$6 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$6.stateClass, state, `{
            floatFilter: ${typeof args.filters[0] === 'number' ? args.filters[0] : 0},
            stringFilter: "${args.filters[0]}",
            filterType: ${typeof args.filters[0] === 'number' ? 'MSG_FLOAT_TOKEN' : 'MSG_STRING_TOKEN'},
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$7 = ({ snds, state, node: { args } }) => {
    if (args.filters.length > 1) {
        return {
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                ${args.filters.map((filter, i) => renderSwitch([filter === 'float', `
                        if (msg_isFloatToken(m, 0)) {
                            ${snds[i]}(m)
                            return
                        }
                    `], [filter === 'symbol', `
                        if (msg_isStringToken(m, 0)) {
                            ${snds[i]}(m)
                            return
                        }
                    `], [filter === 'list', `
                        if (msg_getLength(m).length > 1) {
                            ${snds[i]}(m)
                            return
                        }
                    `], [filter === 'bang', `
                        if (msg_isBang(m)) {
                            ${snds[i]}(m)
                            return
                        }
                    `], [typeof filter === 'number', `
                        if (
                            msg_isFloatToken(m, 0)
                            && msg_readFloatToken(m, 0) === ${filter}
                        ) {
                            ${snds[i]}(msg_emptyToBang(msg_shift(m)))
                            return
                        }
                    `], [typeof filter === 'string', `
                        if (
                            msg_isStringToken(m, 0) 
                            && msg_readStringToken(m, 0) === "${filter}"
                        ) {
                            ${snds[i]}(msg_emptyToBang(msg_shift(m)))
                            return
                        }`
            ]))}

                ${snds[args.filters.length]}(m)
                return
            `
        };
    }
    else {
        return {
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                if (${state}.filterType === MSG_STRING_TOKEN) {
                    if (
                        (${state}.stringFilter === 'float'
                            && msg_isFloatToken(m, 0))
                        || (${state}.stringFilter === 'symbol'
                            && msg_isStringToken(m, 0))
                        || (${state}.stringFilter === 'list'
                            && msg_getLength(m) > 1)
                        || (${state}.stringFilter === 'bang' 
                            && msg_isBang(m))
                    ) {
                        ${snds.$0}(m)
                        return
                    
                    } else if (
                        msg_isStringToken(m, 0)
                        && msg_readStringToken(m, 0) === ${state}.stringFilter
                    ) {
                        ${snds.$0}(msg_emptyToBang(msg_shift(m)))
                        return
                    }

                } else if (
                    msg_isFloatToken(m, 0)
                    && msg_readFloatToken(m, 0) === ${state}.floatFilter
                ) {
                    ${snds.$0}(msg_emptyToBang(msg_shift(m)))
                    return
                }
            
                ${snds.$1}(m)
            return
            `,
            '1': AnonFunc$1([Var$1('Message', 'm')]) `
                ${state}.filterType = msg_getTokenType(m, 0)
                if (${state}.filterType === MSG_STRING_TOKEN) {
                    ${state}.stringFilter = msg_readStringToken(m, 0)
                } else {
                    ${state}.floatFilter = msg_readFloatToken(m, 0)
                }
                return
            `
        };
    }
};
// ------------------------------------------------------------------- //
const nodeImplementation$6 = {
    messageReceivers: messageReceivers$7,
    initialization: initialization$6,
    dependencies: [
        bangUtils,
        msgUtils,
        nodeCore$6,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$5 = {
    translateArgs: ({ args }) => ({
        isClosed: (assertOptionalNumber(args[0]) || 0) === 0
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$5 = generateVariableNamesNodeType('spigot', ['setIsClosed']);
const nodeCore$5 = () => Sequence$1([
    Class$1(variableNames$5.stateClass, [
        Var$1('Float', 'isClosed')
    ]),
    Func$1(variableNames$5.setIsClosed, [
        Var$1(variableNames$5.stateClass, 'state'),
        Var$1('Float', 'value'),
    ], 'void') `
        state.isClosed = (value === 0)
    `
]);
const initialization$5 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$5.stateClass, state, `{
            isClosed: ${args.isClosed ? 'true' : 'false'}
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$6 = ({ snds, state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (!${state}.isClosed) {
            ${snds.$0}(m)
        }
        return
    `,
    '1': coldFloatInletWithSetter(variableNames$5.setIsClosed, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$5 = {
    initialization: initialization$5,
    messageReceivers: messageReceivers$6,
    dependencies: [
        nodeCore$5,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$4 = {
    translateArgs: () => ({}),
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$4 = generateVariableNamesNodeType('until');
const nodeCore$4 = () => Sequence$1([
    Class$1(variableNames$4.stateClass, [
        Var$1('boolean', 'continueIter')
    ]),
]);
const initialization$4 = ({ state }) => ast$1 `
        ${ConstVar$1(variableNames$4.stateClass, state, `{
            continueIter: true,
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$5 = ({ snds, state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${state}.continueIter = true
            while (${state}.continueIter) {
                ${snds[0]}(msg_bang())
            }
            return

        } else if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
            ${state}.continueIter = true
            ${Var$1('Int', 'maxIterCount', 'toInt(msg_readFloatToken(m, 0))')}
            ${Var$1('Int', 'iterCount', '0')}
            while (${state}.continueIter && iterCount++ < maxIterCount) {
                ${snds[0]}(msg_bang())
            }
            return
        }
    `,
    '1': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${state}.continueIter = false
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$4 = {
    messageReceivers: messageReceivers$5,
    initialization: initialization$4,
    dependencies: [
        bangUtils,
        nodeCore$4,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : make seed work
// ------------------------------- node builder ------------------------------ //
const builder$3 = {
    translateArgs: ({ args }) => ({
        maxValue: assertOptionalNumber(args[0]) || 0,
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$3 = generateVariableNamesNodeType('random', [
    'setMaxValue',
]);
const nodeCore$3 = () => Sequence$1([
    Class$1(variableNames$3.stateClass, [
        Var$1('Float', 'maxValue')
    ]),
    Func$1(variableNames$3.setMaxValue, [
        Var$1(variableNames$3.stateClass, 'state'),
        Var$1('Float', 'maxValue'),
    ], 'void') `
        state.maxValue = Math.max(maxValue, 0)
    `
]);
const initialization$3 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$3.stateClass, state, `{
            maxValue: ${args.maxValue}
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$4 = ({ snds, state }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isBang(m)) {
            ${snds['0']}(msg_floats([Math.floor(Math.random() * ${state}.maxValue)]))
            return
        } else if (
            msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(m, 0) === 'seed'
        ) {
            console.log('WARNING : seed not implemented yet for [random]')
            return
        }
    `,
    '1': coldFloatInletWithSetter(variableNames$3.setMaxValue, state),
});
// ------------------------------------------------------------------- //
const nodeImplementation$3 = {
    messageReceivers: messageReceivers$4,
    initialization: initialization$3,
    dependencies: [
        bangUtils,
        nodeCore$3,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$2 = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$2 = generateVariableNamesNodeType('pipe', [
    'prepareMessageScheduling',
    'sendMessages',
    'clear',
    'setDelay',
    'ScheduledMessage',
    'dummyScheduledMessage',
]);
const nodeCore$2 = ({ globs }) => Sequence$1([
    Class$1(variableNames$2.stateClass, [
        Var$1('Int', 'delay'),
        Var$1('Array<Message>', 'outputMessages'),
        Var$1(`Array<${variableNames$2.ScheduledMessage}>`, 'scheduledMessages'),
        Var$1('Array<(m: Message) => void>', 'snds'),
    ]),
    Class$1(variableNames$2.ScheduledMessage, [
        Var$1('Message', 'message'),
        Var$1('Int', 'frame'),
        Var$1('SkedId', 'skedId'),
    ]),
    ConstVar$1(variableNames$2.ScheduledMessage, variableNames$2.dummyScheduledMessage, `{
        message: msg_create([]),
        frame: 0,
        skedId: SKED_ID_NULL,
    }`),
    Func$1(variableNames$2.prepareMessageScheduling, [
        Var$1(variableNames$2.stateClass, 'state'),
        Var$1('SkedCallback', 'callback'),
    ], 'Int') `
        ${Var$1('Int', 'insertIndex', '0')}
        ${Var$1('Int', 'frame', `${globs.frame} + state.delay`)}
        ${Var$1('SkedId', 'skedId', 'SKED_ID_NULL')}

        while (
            insertIndex < state.scheduledMessages.length 
            && state.scheduledMessages[insertIndex].frame <= frame
        ) {
            insertIndex++
        }

        ${''
    // If there was not yet a callback scheduled for that frame, we schedule it.
    }
        if (
            insertIndex === 0 || 
            (
                insertIndex > 0 
                && state.scheduledMessages[insertIndex - 1].frame !== frame
            )
        ) {
            skedId = commons_waitFrame(frame, callback)
        }

        ${''
    // !!! Array.splice insertion is not supported by assemblyscript, so : 
    // 1. We grow arrays to their post-insertion size by using `push`
    // 2. We use `copyWithin` to move old elements to their final position.
    // 3. Instantiate new messages in the newly created holes.
    }
        for (${Var$1('Int', 'i', 0)}; i < state.snds.length; i++) {
            state.scheduledMessages.push(${variableNames$2.dummyScheduledMessage})
        }
        state.scheduledMessages.copyWithin(
            (insertIndex + 1) * state.snds.length, 
            insertIndex * state.snds.length
        )
        for (${Var$1('Int', 'i', 0)}; i < state.snds.length; i++) {
            state.scheduledMessages[insertIndex + i] = {
                message: ${variableNames$2.dummyScheduledMessage}.message,
                frame,
                skedId,
            }
        }

        return insertIndex
    `,
    Func$1(variableNames$2.sendMessages, [
        Var$1(variableNames$2.stateClass, 'state'),
        Var$1('Int', 'toFrame'),
    ], 'void') `
        ${Var$1('Int', 'i', 0)}
        while (
            state.scheduledMessages.length 
            && state.scheduledMessages[0].frame <= toFrame
        ) {
            for (i = 0; i < state.snds.length; i++) {
                // Snds are already reversed
                state.snds[i](state.scheduledMessages.shift().message)
            }
        }
    `,
    Func$1(variableNames$2.clear, [
        Var$1(variableNames$2.stateClass, 'state'),
    ], 'void') `
        ${Var$1('Int', 'i', '0')}
        ${ConstVar$1('Int', 'length', `state.scheduledMessages.length`)}
        for (i; i < length; i++) {
            commons_cancelWaitFrame(state.scheduledMessages[i].skedId)
        }
        state.scheduledMessages = []
    `,
    Func$1(variableNames$2.setDelay, [
        Var$1(variableNames$2.stateClass, 'state'),
        Var$1('Float', 'delay'),
    ], 'void') `
        state.delay = toInt(Math.round(delay / 1000 * ${globs.sampleRate}))
    `,
]);
const initialization$2 = ({ node: { args, id }, state, snds }) => ast$1 `
        ${ConstVar$1(variableNames$2.stateClass, state, `{
            delay: 0,
            outputMessages: [${args.typeArguments
    .map(([_, value]) => typeof value === 'number' ?
    `msg_floats([${value}])`
    : `msg_strings(["${value}"])`).join(',')}],
            scheduledMessages: [],
            snds: [${countTo$1(args.typeArguments.length)
    .reverse()
    .map((i) => snds[i]).join(', ')}],
        }`)}

        commons_waitEngineConfigure(() => {
            ${variableNames$2.setDelay}(${state}, ${args.delay})
        })
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$3 = ({ node: { args }, state, globs, }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (msg_isAction(m, 'clear')) {
            ${variableNames$2.clear}(${state})
            return 

        } else if (msg_isAction(m, 'flush')) {
            if (${state}.scheduledMessages.length) {
                ${variableNames$2.sendMessages}(
                    ${state}, 
                    ${state}.scheduledMessages[${state}.scheduledMessages.length - 1].frame
                )
            }
            return

        } else {
            ${ConstVar$1('Message', 'inMessage', 'msg_isBang(m) ? msg_create([]): m')}
            ${ConstVar$1('Int', 'insertIndex', `${variableNames$2.prepareMessageScheduling}(
                ${state}, 
                () => {
                    ${variableNames$2.sendMessages}(${state}, ${globs.frame})
                },
            )`)}

            ${args.typeArguments.slice(0).reverse()
        .map(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
        .map(([iReverse, typeArg], i) => ast$1 `
                        if (msg_getLength(inMessage) > ${iReverse}) {
                            ${state}.scheduledMessages[insertIndex + ${i}].message = 
                                ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                            ${state}.outputMessages[${iReverse}] 
                                = ${state}.scheduledMessages[insertIndex + ${i}].message
                        } else {
                            ${state}.scheduledMessages[insertIndex + ${i}].message 
                                = ${state}.outputMessages[${iReverse}]
                        }
                    `)}

            return
        }
    `,
    ...mapArray(args.typeArguments.slice(1), ([typeArg], i) => [
        `${i + 1}`,
        AnonFunc$1([Var$1('Message', 'm')]) `
                ${state}.outputMessages[${i + 1}] = ${renderMessageTransfer(typeArg, 'm', 0)}
                return
            `
    ]),
    [args.typeArguments.length]: coldFloatInletWithSetter(variableNames$2.setDelay, state)
});
// ------------------------------------------------------------------- //
const nodeImplementation$2 = {
    messageReceivers: messageReceivers$3,
    initialization: initialization$2,
    dependencies: [
        messageTokenToFloat,
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
        nodeCore$2,
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder$1 = {
    translateArgs: ({ args }) => ({
        typeArguments: (args.length ? args : ['float', 'float']).map(resolveTypeArgumentAlias)
            // Not sure why but 'bang' is supported as a creation argument, 
            // but turned into a float.
            .map(typeArg => {
            // Assign default value
            typeArg = typeArg || 'float';
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
    build: ({ typeArguments }) => ({
        inlets: mapArray(typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const variableNames$1 = generateVariableNamesNodeType('pack');
const nodeCore$1 = () => Sequence$1([
    Class$1(variableNames$1.stateClass, [
        Var$1('Array<Float>', 'floatValues'),
        Var$1('Array<string>', 'stringValues'),
    ]),
]);
const initialization$1 = ({ node: { args }, state }) => ast$1 `
        ${ConstVar$1(variableNames$1.stateClass, state, `{
            floatValues: [${args.typeArguments.map(([typeArg, defaultValue]) => typeArg === 'float' ? defaultValue : 0).join(',')}],
            stringValues: [${args.typeArguments.map(([typeArg, defaultValue]) => typeArg === 'symbol' ? `"${defaultValue}"` : '""').join(',')}]
        }`)}
    `;
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$2 = ({ snds, state, node }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        if (!msg_isBang(m)) {
            for (${Var$1('Int', 'i', '0')}; i < msg_getLength(m); i++) {
                ${state}.stringValues[i] = messageTokenToString(m, i)
                ${state}.floatValues[i] = messageTokenToFloat(m, i)
            }
        }

        ${ConstVar$1('MessageTemplate', 'template', `[${node.args.typeArguments.map(([typeArg], i) => typeArg === 'symbol' ?
        `MSG_STRING_TOKEN, ${state}.stringValues[${i}].length`
        : `MSG_FLOAT_TOKEN`).join(',')}]`)}

        ${ConstVar$1('Message', 'messageOut', 'msg_create(template)')}

        ${node.args.typeArguments.map(([typeArg], i) => typeArg === 'symbol' ?
        `msg_writeStringToken(messageOut, ${i}, ${state}.stringValues[${i}])`
        : `msg_writeFloatToken(messageOut, ${i}, ${state}.floatValues[${i}])`)}

        ${snds[0]}(messageOut)
        return
    `,
    ...mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => {
        if (typeArg === 'symbol') {
            return [
                `${i + 1}`,
                AnonFunc$1([Var$1('Message', 'm')]) `
                    ${state}.stringValues[${i + 1}] = messageTokenToString(m, 0)
                    return
                `
            ];
        }
        else if (typeArg === 'float') {
            return [
                `${i + 1}`,
                AnonFunc$1([Var$1('Message', 'm')]) `
                    ${state}.floatValues[${i + 1}] = messageTokenToFloat(m, 0)
                    return
                `
            ];
        }
        else {
            throw new Error(`Unsupported type argument ${typeArg}`);
        }
    }),
});
// ------------------------------------------------------------------- //
const nodeImplementation$1 = {
    messageReceivers: messageReceivers$2,
    initialization: initialization$1,
    dependencies: [
        messageTokenToString,
        messageTokenToFloat,
        bangUtils,
        nodeCore$1,
    ]
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// ------------------------------- node builder ------------------------------ //
const builder = {
    translateArgs: ({ args }) => ({
        typeArguments: args.length === 0 ? ['float', 'float'] : args
            .map(resolveTypeArgumentAlias)
            .map(arg => {
            if (typeof arg === 'number') {
                return 'float';
            }
            else if (arg === 'symbol' || arg === 'float') {
                return arg;
            }
            else {
                throw new Error(`Invalid type argument for unpack "${arg}"`);
            }
        }),
    }),
    build: ({ typeArguments }) => ({
        inlets: {
            '0': { type: 'message', id: '0' },
        },
        outlets: mapArray(typeArguments, (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
    }),
};
// ------------------------------- messageReceivers ------------------------------ //
const messageReceivers$1 = ({ snds, node: { args } }) => ({
    '0': AnonFunc$1([Var$1('Message', 'm')]) `
        ${args.typeArguments.map((t, i) => [t, i]).reverse().map(([t, reversedI]) => `
                if (
                    msg_getLength(m) >= ${reversedI + 1}
                ) {
                    if (msg_getTokenType(m, ${reversedI}) === ${t === 'float' ? 'MSG_FLOAT_TOKEN' : 'MSG_STRING_TOKEN'}) {
                        ${renderSwitch([t === 'float', `${snds[reversedI]}(msg_floats([msg_readFloatToken(m, ${reversedI})]))`], [t === 'symbol', `${snds[reversedI]}(msg_strings([msg_readStringToken(m, ${reversedI})]))`])}
                    } else {
                        console.log('unpack : invalid token type index ${reversedI}')
                    }
                }
            `)}
        return
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation = {
    messageReceivers: messageReceivers$1,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
// TODO : Implement if (`if(<test>, <then>, <else>)`)
// TODO : [expr random(0, 10000)] fails (no inlet), and random function doesn't exist
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
// ------------------------------- node implementation ------------------------------ //
const variableNames = generateVariableNamesNodeType('expr');
const nodeCore = () => Sequence$1([
    Class$1(variableNames.stateClass, [
        Var$1('Map<Int, Float>', 'floatInputs'),
        Var$1('Map<Int, string>', 'stringInputs'),
        Var$1('Array<Float>', 'outputs'),
    ]),
]);
const initialization = ({ node: { args, type }, state }) => {
    const inputs = type === 'expr' ?
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal');
    return ast$1 `
        ${ConstVar$1(variableNames.stateClass, state, `{
            floatInputs: new Map(),
            stringInputs: new Map(),
            outputs: new Array(${args.tokenizedExpressions.length}),
        }`)}

        ${inputs.filter(input => input.type === 'float' || input.type === 'int')
        .map(input => `${state}.floatInputs.set(${input.id}, 0)`)}
        ${inputs.filter(input => input.type === 'string')
        .map(input => `${state}.stringInputs.set(${input.id}, '')`)}
    `;
};
const loopExprTilde = ({ node: { args }, state, outs, ins, }) => Sequence$1(args.tokenizedExpressions.map((tokens, i) => `${outs[i]} = ${renderTokenizedExpression(state, ins, tokens)}`));
const messageReceivers = ({ snds, state, node: { args, type }, }) => {
    const inputs = type === 'expr' ?
        validateAndListInputsExpr(args.tokenizedExpressions)
        : validateAndListInputsExprTilde(args.tokenizedExpressions)
            .filter(({ type }) => type !== 'signal');
    const hasInput0 = inputs.length && inputs[0].id === 0;
    return {
        '0': AnonFunc$1([Var$1('Message', 'm')]) `
            if (!msg_isBang(m)) {
                for (${Var$1('Int', 'i', '0')}; i < msg_getLength(m); i++) {
                    ${state}.stringInputs.set(i, messageTokenToString(m, i))
                    ${state}.floatInputs.set(i, messageTokenToFloat(m, i))
                }
            }

            ${type === 'expr' ? `
                ${args.tokenizedExpressions.map((tokens, i) => `${state}.outputs[${i}] = ${renderTokenizedExpression(state, null, tokens)}`)}
        
                ${args.tokenizedExpressions.map((_, i) => `${snds[`${i}`]}(msg_floats([${state}.outputs[${i}]]))`)}
            ` : null}
            
            return
        `,
        ...mapArray(inputs.slice(hasInput0 ? 1 : 0), ({ id, type }) => {
            if (type === 'float' || type === 'int') {
                return [
                    `${id}`,
                    AnonFunc$1([Var$1('Message', 'm')]) `
                            ${state}.floatInputs.set(${id}, messageTokenToFloat(m, 0))
                            return
                        `
                ];
            }
            else if (type === 'string') {
                return [
                    `${id}`,
                    AnonFunc$1([Var$1('Message', 'm')]) `
                            ${state}.stringInputs.set(${id}, messageTokenToString(m, 0))
                            return
                        `
                ];
            }
            else {
                throw new Error(`invalid input type ${type}`);
            }
        })
    };
};
// ------------------------------------------------------------------- //
// NOTE: Normally we'd use named regexp capturing groups, but that causes problems with 
// create-react-app which uses a babel plugin to remove them.
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
        if (match[1]) {
            tokens.push({
                type: 'float',
                id: parseInt(match[2]) - 1,
            });
        }
        else if (match[3]) {
            tokens.push({
                type: 'signal',
                id: parseInt(match[4]) - 1,
            });
        }
        else if (match[5]) {
            tokens.push({
                type: 'int',
                id: parseInt(match[6]) - 1,
            });
            // Symbols in an expr are used normally only to index an array.
            // Since we need to cast to an int to index an array, we need 
            // to wrap the indexing expression with a cast to int :
            // $s1[$i1 + 2] -> $s1[toInt($i1 + 2)]
        }
        else if (match[7]) {
            tokens = [
                ...tokens,
                {
                    type: 'string',
                    id: parseInt(match[8]) - 1,
                },
                {
                    type: 'indexing-start'
                },
                ...tokenizeExpression(match[9]),
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
const renderTokenizedExpression = (state, ins, tokens) => 
// Add '+(' to convert for example boolean output to float
'+(' + tokens.map(token => {
    switch (token.type) {
        case 'float':
            return `${state}.floatInputs.get(${token.id})`;
        case 'signal':
            if (ins === null) {
                throw new Error(`invalid token signal received`);
            }
            return ins[token.id];
        case 'int':
            return `roundFloatAsPdInt(${state}.floatInputs.get(${token.id}))`;
        case 'string':
            return `commons_getArray(${state}.stringInputs.get(${token.id}))`;
        case 'indexing-start':
            return '[toInt(';
        case 'indexing-end':
            return ')]';
        case 'raw':
            return token.content;
    }
}).join('') + ')';
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
    expr: {
        messageReceivers: messageReceivers,
        initialization: initialization,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            commonsArrays,
            nodeCore,
        ],
    },
    'expr~': {
        messageReceivers: messageReceivers,
        initialization: initialization,
        loop: loopExprTilde,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            commonsArrays,
            nodeCore,
        ],
    },
};
const builders$1 = {
    'expr': builderExpr,
    'expr~': builderExprTilde,
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
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
// ------------------------------- node implementation ------------------------------ //
const variableNamesBinopBase = generateVariableNamesNodeType('binopbase');
const makeNodeImplementation = ({ operationName, generateOperation, dependencies = [], prepareLeftOp, prepareRightOp, }) => {
    const variableNames = generateVariableNamesNodeType(operationName, ['setLeft', 'setRight']);
    return {
        initialization: ({ state, node: { args } }) => ast$1 `
        ${ConstVar$1(variableNamesBinopBase.stateClass, state, `{
                leftOp: 0,
                rightOp: 0,
            }`)}
            ${variableNames.setLeft}(${state}, 0)
            ${variableNames.setRight}(${state}, ${args.value})
        `,
        messageReceivers: ({ state, snds }) => ({
            '0': AnonFunc$1([Var$1('Message', 'm')]) `
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${variableNames.setLeft}(${state}, msg_readFloatToken(m, 0))
                    ${snds.$0}(msg_floats([${generateOperation(state)}]))
                    return
                
                } else if (msg_isBang(m)) {
                    ${snds.$0}(msg_floats([${generateOperation(state)}]))
                    return
                }
            `,
            '1': coldFloatInletWithSetter(variableNames.setRight, state),
        }),
        dependencies: [
            bangUtils,
            ...dependencies,
            // Shared code for all operators
            () => Sequence$1([
                Class$1(variableNamesBinopBase.stateClass, [
                    Var$1('Float', 'leftOp'),
                    Var$1('Float', 'rightOp')
                ])
            ]),
            // Operator-dependent code
            () => Sequence$1([
                Func$1(variableNames.setLeft, [
                    Var$1(variableNamesBinopBase.stateClass, 'state'),
                    Var$1('Float', 'value'),
                ], 'void') `
                    state.leftOp = ${prepareLeftOp ? prepareLeftOp : 'value'}
                `,
                Func$1(variableNames.setRight, [
                    Var$1(variableNamesBinopBase.stateClass, 'state'),
                    Var$1('Float', 'value'),
                ], 'void') `
                    state.rightOp = ${prepareRightOp ? prepareRightOp : 'value'}
                `,
            ]),
        ],
    };
};
// ------------------------------------------------------------------- //
const nodeImplementations = {
    '+': makeNodeImplementation({
        operationName: 'add',
        generateOperation: (state) => `${state}.leftOp + ${state}.rightOp`,
    }),
    '-': makeNodeImplementation({
        operationName: 'sub',
        generateOperation: (state) => `${state}.leftOp - ${state}.rightOp`,
    }),
    '*': makeNodeImplementation({
        operationName: 'mul',
        generateOperation: (state) => `${state}.leftOp * ${state}.rightOp`,
    }),
    '/': makeNodeImplementation({
        operationName: 'div',
        generateOperation: (state) => `${state}.rightOp !== 0 ? ${state}.leftOp / ${state}.rightOp: 0`,
    }),
    max: makeNodeImplementation({
        operationName: 'max',
        generateOperation: (state) => `Math.max(${state}.leftOp, ${state}.rightOp)`,
    }),
    min: makeNodeImplementation({
        operationName: 'min',
        generateOperation: (state) => `Math.min(${state}.leftOp, ${state}.rightOp)`,
    }),
    mod: makeNodeImplementation({
        operationName: 'mod',
        prepareLeftOp: `value > 0 ? Math.floor(value): Math.ceil(value)`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly :
        // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
        // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
        generateOperation: (state) => `${state}.rightOp !== 0 ? (${state}.rightOp + (${state}.leftOp % ${state}.rightOp)) % ${state}.rightOp: 0`,
    }),
    // Legacy modulo
    '%': makeNodeImplementation({
        operationName: 'modlegacy',
        generateOperation: (state) => `${state}.leftOp % ${state}.rightOp`,
    }),
    pow: makeNodeImplementation({
        operationName: 'pow',
        generateOperation: (state) => `pow(${state}.leftOp, ${state}.rightOp)`,
        dependencies: [pow],
    }),
    log: makeNodeImplementation({
        operationName: 'log',
        generateOperation: (state) => `Math.log(${state}.leftOp) / Math.log(${state}.rightOp)`,
    }),
    '||': makeNodeImplementation({
        operationName: 'or',
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) => `${state}.leftOp || ${state}.rightOp ? 1: 0`,
    }),
    '&&': makeNodeImplementation({
        operationName: 'and',
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) => `${state}.leftOp && ${state}.rightOp ? 1: 0`,
    }),
    '>': makeNodeImplementation({
        operationName: 'gt',
        generateOperation: (state) => `${state}.leftOp > ${state}.rightOp ? 1: 0`,
    }),
    '>=': makeNodeImplementation({
        operationName: 'gte',
        generateOperation: (state) => `${state}.leftOp >= ${state}.rightOp ? 1: 0`,
    }),
    '<': makeNodeImplementation({
        operationName: 'lt',
        generateOperation: (state) => `${state}.leftOp < ${state}.rightOp ? 1: 0`,
    }),
    '<=': makeNodeImplementation({
        operationName: 'lte',
        generateOperation: (state) => `${state}.leftOp <= ${state}.rightOp ? 1: 0`,
    }),
    '==': makeNodeImplementation({
        operationName: 'eq',
        generateOperation: (state) => `${state}.leftOp == ${state}.rightOp ? 1: 0`,
    }),
    '!=': makeNodeImplementation({
        operationName: 'neq',
        generateOperation: (state) => `${state}.leftOp != ${state}.rightOp ? 1: 0`,
    }),
};
const builders = {
    '+': makeBuilder(0),
    '-': makeBuilder(0),
    '*': makeBuilder(1),
    '/': makeBuilder(1),
    max: makeBuilder(0),
    min: makeBuilder(1),
    mod: makeBuilder(0),
    '%': makeBuilder(0),
    pow: makeBuilder(0),
    log: makeBuilder(Math.E),
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
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const NODE_BUILDERS = {
    ...nodeBuilders,
    ...builders$6,
    ...builders$c,
    ...builders$d,
    ...builders$4,
    ...builders$3,
    ...builders$5,
    ...builders$a,
    ...builders$2,
    ...builders$2,
    ...builders$b,
    'noise~': builder$n,
    'snapshot~': builder$H,
    'sig~': builder$P,
    'samphold~': builder$I,
    'clip~': builder$J,
    'vline~': builder$G,
    'line~': builder$F,
    'dac~': builder$N,
    'adc~': builder$M,
    'samplerate~': builder$L,
    'tabplay~': builder$z,
    'readsf~': builder$y,
    'writesf~': builder$x,
    'vd~': { aliasTo: 'delread4~' },
    'bp~': builder$w,
    'hip~': builder$i,
    'lop~': builder$h,
    'vcf~': builder$g,
    'delwrite~': builder$l,
    's~': { aliasTo: 'send~' },
    'r~': { aliasTo: 'receive~' },
    ...builders$e,
    ...builders$9,
    ...builders,
    ...builders$7,
    ...builders$8,
    ...builders$1,
    bang: builder$s,
    bng: { aliasTo: 'bang' },
    b: { aliasTo: 'bang' },
    list: builder$e,
    symbol: builder$d,
    loadbang: builder$q,
    s: { aliasTo: 'send' },
    r: { aliasTo: 'receive' },
    print: builder$b,
    trigger: builder$a,
    t: { aliasTo: 'trigger' },
    change: builder$9,
    clip: builder$7,
    pipe: builder$2,
    moses: builder$8,
    pack: builder$1,
    unpack: builder,
    spigot: builder$5,
    until: builder$4,
    random: builder$3,
    route: builder$6,
    select: { aliasTo: 'route' },
    sel: { aliasTo: 'route' },
    msg: builder$f,
    metro: builder$v,
    timer: builder$u,
    delay: builder$t,
    del: { aliasTo: 'delay' },
    line: builder$E,
    soundfiler: builder$c,
    tabread: builder$C,
    tabwrite: builder$B,
    // The following are internal nodes used by the compiler
    // to help reproduce Pd's behavior
    '_mixer~': builder$Q,
    '_routemsg': builder$O,
    // The following don't need implementations as they will never
    // show up in the graph traversal.
    graph: { isNoop: true },
    table: { isNoop: true },
    array: { isNoop: true },
    text: { isNoop: true },
    cnv: { isNoop: true },
    'block~': { isNoop: true },
    openpanel: { isNoop: true },
};
const NODE_IMPLEMENTATIONS = {
    ...nodeImplementations$6,
    ...nodeImplementations$c,
    ...nodeImplementations$d,
    ...nodeImplementations$4,
    ...nodeImplementations$3,
    ...nodeImplementations$5,
    ...nodeImplementations$a,
    ...nodeImplementations$2,
    ...nodeImplementations$b,
    'noise~': nodeImplementation$k,
    'snapshot~': nodeImplementation$A,
    'sig~': nodeImplementation$H,
    'samphold~': nodeImplementation$B,
    'clip~': nodeImplementation$C,
    'vline~': nodeImplementation$z,
    'line~': nodeImplementation$y,
    'dac~': nodeImplementation$F,
    'adc~': nodeImplementation$E,
    'samplerate~': nodeImplementation$D,
    'tabplay~': nodeImplementation$t,
    'readsf~': nodeImplementation$s,
    'writesf~': nodeImplementation$r,
    'delwrite~': nodeImplementation$j,
    'bp~': nodeImplementation$q,
    'hip~': nodeImplementation$i,
    'lop~': nodeImplementation$h,
    'vcf~': nodeImplementation$g,
    ...nodeImplementations$e,
    ...nodeImplementations$9,
    ...nodeImplementations,
    ...nodeImplementations$8,
    ...nodeImplementations$7,
    ...nodeImplementations$1,
    bang: nodeImplementation$m,
    list: nodeImplementation$e,
    symbol: nodeImplementation$d,
    loadbang: nodeImplementation$l,
    print: nodeImplementation$b,
    trigger: nodeImplementation$a,
    change: nodeImplementation$9,
    clip: nodeImplementation$7,
    pipe: nodeImplementation$2,
    moses: nodeImplementation$8,
    pack: nodeImplementation$1,
    unpack: nodeImplementation,
    spigot: nodeImplementation$5,
    until: nodeImplementation$4,
    route: nodeImplementation$6,
    random: nodeImplementation$3,
    msg: nodeImplementation$f,
    metro: nodeImplementation$p,
    timer: nodeImplementation$o,
    delay: nodeImplementation$n,
    line: nodeImplementation$x,
    tabread: nodeImplementation$w,
    tabwrite: nodeImplementation$v,
    soundfiler: nodeImplementation$c,
    // Internal nodes
    '_mixer~': nodeImplementation$I,
    '_routemsg': nodeImplementation$G,
};

const defaultSettingsForBuild$1 = () => ({
    audioSettings: {
        channelCount: {
            in: 2,
            out: 2,
        },
        bitDepth: 64,
    },
    renderAudioSettings: {
        sampleRate: 44100,
        blockSize: 4096,
        previewDurationSeconds: 30,
    },
    abstractionLoader: alwaysFailingAbstractionLoader,
    nodeBuilders: NODE_BUILDERS,
    nodeImplementations: NODE_IMPLEMENTATIONS,
});
const alwaysFailingAbstractionLoader = async (nodeType) => {
    throw new UnknownNodeTypeError(nodeType);
};
/**
 * A helper to perform a build step on a given artefacts object.
 * If the build is successful, the artefacts object is updated in place with
 * the newly built artefact.
 *
 * Beware that this can only build one step at a time. If targetting a given format
 * requires multiple steps, you need to call this function multiple times with intermediate targets.
 *
 * @see fromPatch
 *
 * @param artefacts
 * @param target
 * @param settings
 */
const performBuildStep = async (artefacts, target, { nodeBuilders, nodeImplementations, audioSettings, renderAudioSettings, io = {}, abstractionLoader, }) => {
    let warnings = [];
    let errors = [];
    switch (target) {
        case 'pdJson':
            const parseResult = parse(artefacts.pd);
            if (parseResult.status === 0) {
                artefacts.pdJson = parseResult.pd;
                return {
                    status: 0,
                    warnings: _makeParseErrorMessages(parseResult.warnings),
                };
            }
            else {
                return {
                    status: 1,
                    warnings: _makeParseErrorMessages(parseResult.warnings),
                    errors: _makeParseErrorMessages(parseResult.errors),
                };
            }
        case 'dspGraph':
            const toDspGraphResult = await toDspGraph(artefacts.pdJson, nodeBuilders, abstractionLoader);
            if (toDspGraphResult.abstractionsLoadingWarnings) {
                warnings = Object.entries(toDspGraphResult.abstractionsLoadingWarnings)
                    .filter(([_, warnings]) => !!warnings.length)
                    .flatMap(([nodeType, warnings]) => [
                    `Warnings when parsing abstraction ${nodeType} :`,
                    ..._makeParseErrorMessages(warnings),
                ]);
            }
            if (toDspGraphResult.status === 0) {
                // If io.messageReceivers are not defined, we infer them by
                // discovering UI controls and generating messageReceivers for each one.
                if (!io.messageReceivers) {
                    const { controls } = discoverGuiControls(toDspGraphResult.pd);
                    io.messageReceivers = {
                        ...collectIoMessageReceiversFromGui(controls, toDspGraphResult.graph),
                        ...collectIoMessageReceiversFromSendNodes(toDspGraphResult.pd, toDspGraphResult.graph)
                    };
                }
                artefacts.dspGraph = {
                    graph: toDspGraphResult.graph,
                    arrays: toDspGraphResult.arrays,
                    pd: toDspGraphResult.pd,
                    io: {
                        messageReceivers: {},
                        messageSenders: {},
                        ...io,
                    },
                };
                return { status: 0, warnings };
            }
            else {
                const unknownNodeTypes = Object.values(toDspGraphResult.abstractionsLoadingErrors)
                    .filter((errors) => !!errors.unknownNodeType)
                    .map((errors) => errors.unknownNodeType);
                if (unknownNodeTypes.length) {
                    errors = [
                        ...errors,
                        ..._makeUnknownNodeTypeMessage(new Set(unknownNodeTypes)),
                    ];
                }
                errors = [
                    ...errors,
                    ...Object.entries(toDspGraphResult.abstractionsLoadingErrors)
                        .filter(([_, errors]) => !!errors.parsingErrors)
                        .flatMap(([nodeType, errors]) => [
                        `Failed to parse abstraction ${nodeType} :`,
                        ..._makeParseErrorMessages(errors.parsingErrors),
                    ]),
                ];
                return {
                    status: 1,
                    errors,
                    warnings,
                };
            }
        case 'javascript':
        case 'assemblyscript':
            const compileCodeResult = index(artefacts.dspGraph.graph, nodeImplementations, target, {
                audio: audioSettings,
                io: artefacts.dspGraph.io,
                arrays: artefacts.dspGraph.arrays,
            });
            {
                if (target === 'javascript') {
                    artefacts.javascript = compileCodeResult.code;
                }
                else {
                    artefacts.assemblyscript = compileCodeResult.code;
                }
                return { status: 0, warnings: [] };
            }
        case 'wasm':
            try {
                artefacts.wasm = await compileAssemblyscript(getArtefact(artefacts, 'assemblyscript'), audioSettings.bitDepth);
            }
            catch (err) {
                return {
                    status: 1,
                    errors: [err.message],
                    warnings: [],
                };
            }
            return { status: 0, warnings: [] };
        case 'wav':
            artefacts.wav = await renderWav(renderAudioSettings.previewDurationSeconds, artefacts, { ...audioSettings, ...renderAudioSettings });
            return { status: 0, warnings: [] };
        case 'app':
            artefacts.app = appGenerator('bare-bones', artefacts);
            return { status: 0, warnings: [] };
        default:
            throw new Error(`invalid build step ${target}`);
    }
};
const _makeUnknownNodeTypeMessage = (nodeTypeSet) => [
    `Unknown object types ${Array.from(nodeTypeSet)
        .map((nodeType) => `${nodeType}`)
        .join(', ')}`,
];
const _makeParseErrorMessages = (errorOrWarnings) => errorOrWarnings.map(({ message, lineIndex }) => `line ${lineIndex + 1} : ${message}`);

var fetchRetry = function (fetch, defaults) {
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
        // As of node 18, this is no longer needed since node comes with native support for fetch:
        /* istanbul ignore next */
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

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
fetchRetry(fetch);

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
/** Generate an integer series from 0 to `count` (non-inclusive). */
const countTo = (count) => {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(i);
    }
    return results;
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const Var = (typeName, name, value) => _preventToString({
    astType: 'Var',
    name,
    type: typeName,
    value: value !== undefined ? _prepareVarValue(value) : undefined,
});
const ConstVar = (typeName, name, value) => _preventToString({
    astType: 'ConstVar',
    name,
    type: typeName,
    value: _prepareVarValue(value),
});
const Func = (name, args = [], returnType = 'void') => (strings, ...content) => _preventToString({
    astType: 'Func',
    name,
    args,
    returnType,
    body: ast(strings, ...content),
});
const AnonFunc = (args = [], returnType = 'void') => (strings, ...content) => _preventToString({
    astType: 'Func',
    name: null,
    args,
    returnType,
    body: ast(strings, ...content),
});
const Class = (name, members) => _preventToString({
    astType: 'Class',
    name,
    members,
});
const Sequence = (content) => ({
    astType: 'Sequence',
    content: _processRawContent(_intersperse(content, countTo(content.length - 1).map(() => '\n'))),
});
const ast = (strings, ...content) => _preventToString({
    astType: 'Sequence',
    content: _processRawContent(_intersperse(strings, content)),
});
const _processRawContent = (content) => {
    // 1. Flatten arrays and AstSequence, filter out nulls, and convert numbers to strings
    // Basically converts input to an Array<AstContent>.
    const flattenedAndFiltered = content.flatMap((element) => {
        if (typeof element === 'string') {
            return [element];
        }
        else if (typeof element === 'number') {
            return [element.toString()];
        }
        else {
            if (element === null) {
                return [];
            }
            else if (Array.isArray(element)) {
                return _processRawContent(_intersperse(element, countTo(element.length - 1).map(() => '\n')));
            }
            else if (typeof element === 'object' &&
                element.astType === 'Sequence') {
                return element.content;
            }
            else {
                return [element];
            }
        }
    });
    // 2. Combine adjacent strings
    const [combinedContent, remainingString] = flattenedAndFiltered.reduce(([combinedContent, currentString], element) => {
        if (typeof element === 'string') {
            return [combinedContent, currentString + element];
        }
        else {
            if (currentString.length) {
                return [[...combinedContent, currentString, element], ''];
            }
            else {
                return [[...combinedContent, element], ''];
            }
        }
    }, [[], '']);
    if (remainingString.length) {
        combinedContent.push(remainingString);
    }
    return combinedContent;
};
/**
 * Intersperse content from array1 with content from array2.
 * `array1.length` must be equal to `array2.length + 1`.
 */
const _intersperse = (array1, array2) => {
    if (array1.length === 0) {
        return [];
    }
    return array1
        .slice(1)
        .reduce((combinedContent, element, i) => combinedContent.concat([array2[i], element]), [array1[0]]);
};
/**
 * Prevents AST elements from being rendered as a string, as this is
 * most likely an error due to unproper use of `ast`.
 * Deacivated. Activate for debugging by uncommenting the line below.
 */
const _preventToString = (element) => ({
    ...element,
    // Uncomment this to activate
    // toString: () => { throw new Error(`Rendering element ${elemennt.astType} as string is probably an error`) }
});
const _prepareVarValue = (value) => {
    if (typeof value === 'number') {
        return Sequence([value.toString()]);
    }
    else if (typeof value === 'string') {
        return Sequence([value]);
    }
    else {
        return value;
    }
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const bufCore = () => Sequence([
    /**
     * Ring buffer
     */
    Class('buf_SoundBuffer', [
        Var('FloatArray', 'data'),
        Var('Int', 'length'),
        Var('Int', 'writeCursor'),
        Var('Int', 'pullAvailableLength'),
    ]),
    /** Erases all the content from the buffer */
    Func('buf_clear', [
        Var('buf_SoundBuffer', 'buffer')
    ], 'void') `
        buffer.data.fill(0)
    `,
    /** Erases all the content from the buffer */
    Func('buf_create', [
        Var('Int', 'length')
    ], 'buf_SoundBuffer') `
        return {
            data: createFloatArray(length),
            length: length,
            writeCursor: 0,
            pullAvailableLength: 0,
        }
    `
]);
const bufPushPull = {
    codeGenerator: () => Sequence([
        /**
         * Pushes a block to the buffer, throwing an error if the buffer is full.
         * If the block is written successfully, {@link buf_SoundBuffer#writeCursor}
         * is moved corresponding with the length of data written.
         *
         * @todo : Optimize by allowing to read/write directly from host
         */
        Func('buf_pushBlock', [
            Var('buf_SoundBuffer', 'buffer'),
            Var('FloatArray', 'block')
        ], 'Int') `
            if (buffer.pullAvailableLength + block.length > buffer.length) {
                throw new Error('buffer full')
            }

            ${Var('Int', 'left', 'block.length')}
            while (left > 0) {
                ${ConstVar('Int', 'lengthToWrite', `toInt(Math.min(
                    toFloat(buffer.length - buffer.writeCursor), 
                    toFloat(left),
                ))`)}
                buffer.data.set(
                    block.subarray(
                        block.length - left, 
                        block.length - left + lengthToWrite
                    ), 
                    buffer.writeCursor
                )
                left -= lengthToWrite
                buffer.writeCursor = (buffer.writeCursor + lengthToWrite) % buffer.length
                buffer.pullAvailableLength += lengthToWrite
            }
            return buffer.pullAvailableLength
        `,
        /**
         * Pulls a single sample from the buffer.
         * This is a destructive operation, and the sample will be
         * unavailable for subsequent readers with the same operation.
         */
        Func('buf_pullSample', [
            Var('buf_SoundBuffer', 'buffer')
        ], 'Float') `
            if (buffer.pullAvailableLength <= 0) {
                return 0
            }
            ${ConstVar('Int', 'readCursor', 'buffer.writeCursor - buffer.pullAvailableLength')}
            buffer.pullAvailableLength -= 1
            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]
        `
    ]),
    dependencies: [bufCore],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const msg = {
    codeGenerator: ({ target }) => {
        const declareFuncs = {
            msg_create: Func('msg_create', [Var('MessageTemplate', 'template')], 'Message'),
            msg_writeStringToken: Func('msg_writeStringToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
                Var('string', 'value'),
            ], 'void'),
            msg_writeFloatToken: Func('msg_writeFloatToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
                Var('MessageFloatToken', 'value'),
            ], 'void'),
            msg_readStringToken: Func('msg_readStringToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
            ], 'string'),
            msg_readFloatToken: Func('msg_readFloatToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
            ], 'MessageFloatToken'),
            msg_getLength: Func('msg_getLength', [
                Var('Message', 'message')
            ], 'Int'),
            msg_getTokenType: Func('msg_getTokenType', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
            ], 'Int'),
            msg_isStringToken: Func('msg_isStringToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
            ], 'boolean'),
            msg_isFloatToken: Func('msg_isFloatToken', [
                Var('Message', 'message'),
                Var('Int', 'tokenIndex'),
            ], 'boolean'),
            msg_isMatching: Func('msg_isMatching', [
                Var('Message', 'message'),
                Var('Array<MessageHeaderEntry>', 'tokenTypes'),
            ], 'boolean'),
            msg_floats: Func('msg_floats', [
                Var('Array<Float>', 'values'),
            ], 'Message'),
            msg_strings: Func('msg_strings', [
                Var('Array<string>', 'values'),
            ], 'Message'),
            msg_display: Func('msg_display', [
                Var('Message', 'message'),
            ], 'string')
        };
        if (target === 'assemblyscript') {
            return Sequence([
                `
                type MessageFloatToken = Float
                type MessageCharToken = Int

                type MessageTemplate = Array<Int>
                type MessageHeaderEntry = Int
                type MessageHeader = Int32Array
                `,
                ConstVar('MessageHeaderEntry', 'MSG_FLOAT_TOKEN', '0'),
                ConstVar('MessageHeaderEntry', 'MSG_STRING_TOKEN', '1'),
                // =========================== EXPORTED API
                Func('x_msg_create', [
                    Var('Int32Array', 'templateTypedArray')
                ], 'Message') `
                    const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                    for (let i: Int = 0; i < templateTypedArray.length; i++) {
                        template[i] = templateTypedArray[i]
                    }
                    return msg_create(template)
                `,
                Func('x_msg_getTokenTypes', [
                    Var('Message', 'message')
                ], 'MessageHeader') `
                    return message.tokenTypes
                `,
                Func('x_msg_createTemplate', [
                    Var('i32', 'length')
                ], 'Int32Array') `
                    return new Int32Array(length)
                `,
                // =========================== MSG API
                declareFuncs.msg_create `
                    let i: Int = 0
                    let byteCount: Int = 0
                    let tokenTypes: Array<MessageHeaderEntry> = []
                    let tokenPositions: Array<MessageHeaderEntry> = []

                    i = 0
                    while (i < template.length) {
                        switch(template[i]) {
                            case MSG_FLOAT_TOKEN:
                                byteCount += sizeof<MessageFloatToken>()
                                tokenTypes.push(MSG_FLOAT_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 1
                                break
                            case MSG_STRING_TOKEN:
                                byteCount += sizeof<MessageCharToken>() * template[i + 1]
                                tokenTypes.push(MSG_STRING_TOKEN)
                                tokenPositions.push(byteCount)
                                i += 2
                                break
                            default:
                                throw new Error("unknown token type : " + template[i].toString())
                        }
                    }

                    const tokenCount = tokenTypes.length
                    const headerByteCount = _msg_computeHeaderLength(tokenCount) * sizeof<MessageHeaderEntry>()
                    byteCount += headerByteCount

                    const buffer = new ArrayBuffer(byteCount)
                    const dataView = new DataView(buffer)
                    let writePosition: Int = 0
                    
                    dataView.setInt32(writePosition, tokenCount)
                    writePosition += sizeof<MessageHeaderEntry>()

                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, tokenTypes[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    dataView.setInt32(writePosition, headerByteCount)
                    writePosition += sizeof<MessageHeaderEntry>()
                    for (i = 0; i < tokenCount; i++) {
                        dataView.setInt32(writePosition, headerByteCount + tokenPositions[i])
                        writePosition += sizeof<MessageHeaderEntry>()
                    }

                    const header = _msg_unpackHeader(dataView, tokenCount)
                    return {
                        dataView,
                        tokenCount,
                        header,
                        tokenTypes: _msg_unpackTokenTypes(header),
                        tokenPositions: _msg_unpackTokenPositions(header),
                    }
                `,
                declareFuncs.msg_writeStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const expectedStringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    if (value.length !== expectedStringLength) {
                        throw new Error('Invalid string size, specified ' + expectedStringLength.toString() + ', received ' + value.length.toString())
                    }

                    for (let i = 0; i < value.length; i++) {
                        message.dataView.setInt32(
                            startPosition + i * sizeof<MessageCharToken>(), 
                            value.codePointAt(i)
                        )
                    }
                `,
                declareFuncs.msg_writeFloatToken `
                    setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                `,
                declareFuncs.msg_readStringToken `
                    const startPosition = message.tokenPositions[tokenIndex]
                    const endPosition = message.tokenPositions[tokenIndex + 1]
                    const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                    let value: string = ''
                    for (let i = 0; i < stringLength; i++) {
                        value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                    }
                    return value
                `,
                declareFuncs.msg_readFloatToken `
                    return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                `,
                declareFuncs.msg_getLength `
                    return message.tokenTypes.length
                `,
                declareFuncs.msg_getTokenType `
                    return message.tokenTypes[tokenIndex]
                `,
                declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                `,
                declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                `,
                declareFuncs.msg_isMatching `
                    if (message.tokenTypes.length !== tokenTypes.length) {
                        return false
                    }
                    for (let i: Int = 0; i < tokenTypes.length; i++) {
                        if (message.tokenTypes[i] !== tokenTypes[i]) {
                            return false
                        }
                    }
                    return true
                `,
                declareFuncs.msg_floats `
                    const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeFloatToken(message, i, values[i])
                    }
                    return message
                `,
                declareFuncs.msg_strings `
                    const template: MessageTemplate = []
                    for (let i: Int = 0; i < values.length; i++) {
                        template.push(MSG_STRING_TOKEN)
                        template.push(values[i].length)
                    }
                    const message: Message = msg_create(template)
                    for (let i: Int = 0; i < values.length; i++) {
                        msg_writeStringToken(message, i, values[i])
                    }
                    return message
                `,
                declareFuncs.msg_display `
                    let displayArray: Array<string> = []
                    for (let i: Int = 0; i < msg_getLength(message); i++) {
                        if (msg_isFloatToken(message, i)) {
                            displayArray.push(msg_readFloatToken(message, i).toString())
                        } else {
                            displayArray.push('"' + msg_readStringToken(message, i) + '"')
                        }
                    }
                    return '[' + displayArray.join(', ') + ']'
                `,
                // =========================== PRIVATE
                // Message header : [
                //      <Token count>, 
                //      <Token 1 type>,  ..., <Token N type>, 
                //      <Token 1 start>, ..., <Token N start>, <Token N end>
                //      ... DATA ...
                // ]
                Class('Message', [
                    Var('DataView', 'dataView'),
                    Var('MessageHeader', 'header'),
                    Var('MessageHeaderEntry', 'tokenCount'),
                    Var('MessageHeader', 'tokenTypes'),
                    Var('MessageHeader', 'tokenPositions'),
                ]),
                Func('_msg_computeHeaderLength', [
                    Var('Int', 'tokenCount')
                ], 'Int') `
                    return 1 + tokenCount * 2 + 1
                `,
                Func('_msg_unpackTokenCount', [
                    Var('DataView', 'messageDataView')
                ], 'MessageHeaderEntry') `
                    return messageDataView.getInt32(0)
                `,
                Func('_msg_unpackHeader', [
                    Var('DataView', 'messageDataView'),
                    Var('MessageHeaderEntry', 'tokenCount'),
                ], 'MessageHeader') `
                    const headerLength = _msg_computeHeaderLength(tokenCount)
                    // TODO : why is this \`wrap\` not working ?
                    // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                    const messageHeader = new Int32Array(headerLength)
                    for (let i = 0; i < headerLength; i++) {
                        messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                    }
                    return messageHeader
                `,
                Func('_msg_unpackTokenTypes', [
                    Var('MessageHeader', 'header'),
                ], 'MessageHeader') `
                    return header.slice(1, 1 + header[0])
                `,
                Func('_msg_unpackTokenPositions', [
                    Var('MessageHeader', 'header'),
                ], 'MessageHeader') `
                    return header.slice(1 + header[0])
                `,
            ]);
        }
        else if (target === 'javascript') {
            return Sequence([
                ConstVar('string', 'MSG_FLOAT_TOKEN', '"number"'),
                ConstVar('string', 'MSG_STRING_TOKEN', '"string"'),
                declareFuncs.msg_create `
                    const m = []
                    let i = 0
                    while (i < template.length) {
                        if (template[i] === MSG_STRING_TOKEN) {
                            m.push('')
                            i += 2
                        } else if (template[i] === MSG_FLOAT_TOKEN) {
                            m.push(0)
                            i += 1
                        }
                    }
                    return m
                `,
                declareFuncs.msg_getLength `
                    return message.length
                `,
                declareFuncs.msg_getTokenType `
                    return typeof message[tokenIndex]
                `,
                declareFuncs.msg_isStringToken `
                    return msg_getTokenType(message, tokenIndex) === 'string'
                `,
                declareFuncs.msg_isFloatToken `
                    return msg_getTokenType(message, tokenIndex) === 'number'
                `,
                declareFuncs.msg_isMatching `
                    return (message.length === tokenTypes.length) 
                        && message.every((v, i) => msg_getTokenType(message, i) === tokenTypes[i])
                `,
                declareFuncs.msg_writeFloatToken `
                    message[tokenIndex] = value
                `,
                declareFuncs.msg_writeStringToken `
                    message[tokenIndex] = value
                `,
                declareFuncs.msg_readFloatToken `
                    return message[tokenIndex]
                `,
                declareFuncs.msg_readStringToken `
                    return message[tokenIndex]
                `,
                declareFuncs.msg_floats `
                    return values
                `,
                declareFuncs.msg_strings `
                    return values
                `,
                declareFuncs.msg_display `
                    return '[' + message
                        .map(t => typeof t === 'string' ? '"' + t + '"' : t.toString())
                        .join(', ') + ']'
                `,
            ]);
        }
        else {
            throw new Error(`Unexpected target: ${target}`);
        }
    },
    exports: [
        { name: 'x_msg_create', targets: ['assemblyscript'] },
        { name: 'x_msg_getTokenTypes', targets: ['assemblyscript'] },
        { name: 'x_msg_createTemplate', targets: ['assemblyscript'] },
        { name: 'msg_writeStringToken', targets: ['assemblyscript'] },
        { name: 'msg_writeFloatToken', targets: ['assemblyscript'] },
        { name: 'msg_readStringToken', targets: ['assemblyscript'] },
        { name: 'msg_readFloatToken', targets: ['assemblyscript'] },
        { name: 'MSG_FLOAT_TOKEN', targets: ['assemblyscript'] },
        { name: 'MSG_STRING_TOKEN', targets: ['assemblyscript'] },
    ],
};

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const FS_OPERATION_SUCCESS = 0;
const FS_OPERATION_FAILURE = 1;
const fsCore = {
    codeGenerator: ({ target }) => {
        const content = [];
        if (target === 'assemblyscript') {
            content.push(`
                type fs_OperationId = Int
                type fs_OperationStatus = Int
                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void
                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void
                type fs_Url = string
            `);
        }
        return Sequence([
            ...content,
            ConstVar('Int', 'FS_OPERATION_SUCCESS', FS_OPERATION_SUCCESS.toString()),
            ConstVar('Int', 'FS_OPERATION_FAILURE', FS_OPERATION_FAILURE.toString()),
            ConstVar('Set<fs_OperationId>', '_FS_OPERATIONS_IDS', 'new Set()'),
            ConstVar('Map<fs_OperationId, fs_OperationCallback>', '_FS_OPERATIONS_CALLBACKS', 'new Map()'),
            ConstVar('Map<fs_OperationId, fs_OperationSoundCallback>', '_FS_OPERATIONS_SOUND_CALLBACKS', 'new Map()'),
            // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to 
            // a function. Therefore we can get false negatives when a test happens to expect a 0.
            Var('Int', '_FS_OPERATION_COUNTER', '1'),
            Class('fs_SoundInfo', [
                Var('Int', 'channelCount'),
                Var('Int', 'sampleRate'),
                Var('Int', 'bitDepth'),
                Var('string', 'encodingFormat'),
                Var('string', 'endianness'),
                Var('string', 'extraOptions'),
            ]),
            Func('fs_soundInfoToMessage', [
                Var('fs_SoundInfo', 'soundInfo')
            ], 'Message') `
                ${ConstVar('Message', 'info', `msg_create([
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_FLOAT_TOKEN,
                    MSG_STRING_TOKEN,
                    soundInfo.encodingFormat.length,
                    MSG_STRING_TOKEN,
                    soundInfo.endianness.length,
                    MSG_STRING_TOKEN,
                    soundInfo.extraOptions.length
                ])`)}
                msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))
                msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))
                msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))
                msg_writeStringToken(info, 3, soundInfo.encodingFormat)
                msg_writeStringToken(info, 4, soundInfo.endianness)
                msg_writeStringToken(info, 5, soundInfo.extraOptions)
                return info
            `,
            Func('_fs_assertOperationExists', [
                Var('fs_OperationId', 'id'),
                Var('string', 'operationName'),
            ], 'void') `
                if (!_FS_OPERATIONS_IDS.has(id)) {
                    throw new Error(operationName + ' operation unknown : ' + id.toString())
                }
            `,
            Func('_fs_createOperationId', [], 'fs_OperationId') `
                ${ConstVar('fs_OperationId', 'id', '_FS_OPERATION_COUNTER++')}
                _FS_OPERATIONS_IDS.add(id)
                return id
            `
        ]);
    },
    dependencies: [msg],
};
({
    codeGenerator: () => Sequence([
        Func('fs_readSoundFile', [
            Var('fs_Url', 'url'),
            Var('fs_SoundInfo', 'soundInfo'),
            Var('fs_OperationSoundCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)
            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func('x_fs_onReadSoundFileResponse', [
            Var('fs_OperationId', 'id'),
            Var('fs_OperationStatus', 'status'),
            Var('FloatArray[]', 'sound'),
        ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)
            callback(id, status, sound)
            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onReadSoundFileResponse',
        },
    ],
    imports: [
        Func('i_fs_readSoundFile', [
            Var('fs_OperationId', 'id'),
            Var('fs_Url', 'url'),
            Var('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsCore],
});
({
    codeGenerator: () => Sequence([
        Func('fs_writeSoundFile', [
            Var('FloatArray[]', 'sound'),
            Var('fs_Url', 'url'),
            Var('fs_SoundInfo', 'soundInfo'),
            Var('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func('x_fs_onWriteSoundFileResponse', [
            Var('fs_OperationId', 'id'),
            Var('fs_OperationStatus', 'status'),
        ], 'void') `
            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            ${ConstVar('fs_OperationCallback', 'callback', '_FS_OPERATIONS_CALLBACKS.get(id)')}
            callback(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onWriteSoundFileResponse',
        },
    ],
    imports: [
        Func('i_fs_writeSoundFile', [
            Var('fs_OperationId', 'id'),
            Var('FloatArray[]', 'sound'),
            Var('fs_Url', 'url'),
            Var('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsCore],
});
const fsSoundStreamCore = {
    codeGenerator: () => Sequence([
        ConstVar('Map<fs_OperationId, Array<buf_SoundBuffer>>', '_FS_SOUND_STREAM_BUFFERS', 'new Map()'),
        ConstVar('Int', '_FS_SOUND_BUFFER_LENGTH', '20 * 44100'),
        Func('fs_closeSoundStream', [
            Var('fs_OperationId', 'id'),
            Var('fs_OperationStatus', 'status'),
        ], 'void') `
            if (!_FS_OPERATIONS_IDS.has(id)) {
                return
            }
            _FS_OPERATIONS_IDS.delete(id)
            _FS_OPERATIONS_CALLBACKS.get(id)(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
            // Delete this last, to give the callback 
            // a chance to save a reference to the buffer
            // If write stream, there won't be a buffer
            if (_FS_SOUND_STREAM_BUFFERS.has(id)) {
                _FS_SOUND_STREAM_BUFFERS.delete(id)
            }
            i_fs_closeSoundStream(id, status)
        `,
        Func('x_fs_onCloseSoundStream', [
            Var('fs_OperationId', 'id'),
            Var('fs_OperationStatus', 'status'),
        ], 'void') `
            fs_closeSoundStream(id, status)
        `
    ]),
    exports: [
        {
            name: 'x_fs_onCloseSoundStream',
        },
    ],
    imports: [
        Func('i_fs_closeSoundStream', [
            Var('fs_OperationId', 'id'),
            Var('fs_OperationStatus', 'status'),
        ], 'void') ``,
    ],
    dependencies: [bufCore, fsCore],
};
({
    codeGenerator: () => Sequence([
        Func('fs_openSoundReadStream', [
            Var('fs_Url', 'url'),
            Var('fs_SoundInfo', 'soundInfo'),
            Var('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            ${ConstVar('fs_OperationId', 'id', '_fs_createOperationId()')}
            ${ConstVar('Array<buf_SoundBuffer>', 'buffers', '[]')}
            for (${Var('Int', 'channel', '0')}; channel < soundInfo.channelCount; channel++) {
                buffers.push(buf_create(_FS_SOUND_BUFFER_LENGTH))
            }
            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func('x_fs_onSoundStreamData', [
            Var('fs_OperationId', 'id'),
            Var('FloatArray[]', 'block'),
        ], 'Int') `
            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')
            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)
            for (${Var('Int', 'i', '0')}; i < buffers.length; i++) {
                buf_pushBlock(buffers[i], block[i])
            }
            return buffers[0].pullAvailableLength
        `
    ]),
    exports: [
        {
            name: 'x_fs_onSoundStreamData',
        },
    ],
    imports: [
        Func('i_fs_openSoundReadStream', [
            Var('fs_OperationId', 'id'),
            Var('fs_Url', 'url'),
            Var('Message', 'info'),
        ], 'void') ``,
    ],
    dependencies: [fsSoundStreamCore, bufPushPull],
});
({
    codeGenerator: () => Sequence([
        Func('fs_openSoundWriteStream', [
            Var('fs_Url', 'url'),
            Var('fs_SoundInfo', 'soundInfo'),
            Var('fs_OperationCallback', 'callback'),
        ], 'fs_OperationId') `
            const id = _fs_createOperationId()
            _FS_SOUND_STREAM_BUFFERS.set(id, [])
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        `,
        Func('fs_sendSoundStreamData', [
            Var('fs_OperationId', 'id'),
            Var('FloatArray[]', 'block')
        ], 'void') `
            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')
            i_fs_sendSoundStreamData(id, block)
        `
    ]),
    imports: [
        Func('i_fs_openSoundWriteStream', [
            Var('fs_OperationId', 'id'),
            Var('fs_Url', 'url'),
            Var('Message', 'info'),
        ], 'void') ``,
        Func('i_fs_sendSoundStreamData', [
            Var('fs_OperationId', 'id'),
            Var('FloatArray[]', 'block'),
        ], 'void') ``,
    ],
    dependencies: [fsSoundStreamCore],
});

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
AnonFunc([Var('Message', 'm')], 'void') ``;

/*
 * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.
 *
 * This file is part of WebPd
 * (see https://github.com/sebpiq/WebPd).
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
const defaultSettingsForBuild = (rootUrl) => ({
    ...defaultSettingsForBuild$1(),
    abstractionLoader: makeUrlAbstractionLoader(rootUrl),
});
/**
 * Helper to build an abstraction loader from a root url.
 * The returned loader will :
 * - use the root url to resolve relative paths for abstractions.
 * - suffix all abstraction names with .pd if they don't already have an extension.
 *
 * @param rootUrl
 * @returns
 */
const makeUrlAbstractionLoader = (rootUrl) => makeAbstractionLoader(async (nodeType) => {
    const url = `${rootUrl}/${nodeType.endsWith('.pd') ? nodeType : `${nodeType}.pd`}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new UnknownNodeTypeError(nodeType);
    }
    return await response.text();
});

const workerSafePerformBuildStep = async (artefacts, step, workerSafeBuildSettings) => {
    const settings = {
        ...defaultSettingsForBuild(workerSafeBuildSettings.rootUrl || ''),
        audioSettings: workerSafeBuildSettings.audioSettings,
        renderAudioSettings: workerSafeBuildSettings.renderAudioSettings,
        io: workerSafeBuildSettings.io,
        abstractionLoader: workerSafeBuildSettings.rootUrl
            ? makeUrlAbstractionLoader(workerSafeBuildSettings.rootUrl)
            : localAbstractionLoader,
    };
    return performBuildStep(artefacts, step, settings);
};
const localAbstractionLoader = makeAbstractionLoader(async (nodeType) => {
    throw new UnknownNodeTypeError(nodeType);
});

onmessage = (event) => {
    const { artefacts, step, settings } = event.data;
    console.log(`BUILD WORKER ${step}`);
    workerSafePerformBuildStep(artefacts, step, settings)
        .then(result => {
        const response = {
            result, artefacts
        };
        postMessage(response);
    });
};
//# sourceMappingURL=build.worker.js.map
