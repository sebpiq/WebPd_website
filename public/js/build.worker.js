const compileAsc = async (code, bitDepth) => {
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
const Var$1 = (name) => `${name}`;
const Func$1 = (args) => `(${args.join(', ')})`;
const macros$1 = {
    Var: Var$1,
    Func: Func$1,
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
const Var = (name, typeString) => `${name}: ${typeString}`;
const Func = (args, returnType) => `(${args.join(', ')}): ${returnType}`;
const macros = {
    Var,
    Func,
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
 * Renders templated strings which contain nested arrays of strings.
 * This helper allows to use functions such as `.map` to generate several lines
 * of code, without having to use `.join('\n')`.
 * @todo : should not have to check for falsy codeLine has it should be typechecked.
 */
const renderCode = (strings, ...codeLines) => {
    let rendered = '';
    for (let i = 0; i < strings.length; i++) {
        rendered += strings[i];
        if (codeLines[i] || codeLines[i] === 0) {
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
/** Generate an integer series from 0 to `count` (non-inclusive). */
const countTo = (count) => {
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
const sked = ({ macros: { Var, Func }, target, }) => `
    ${renderIf(target === 'assemblyscript', `
            type SkedCallback = (event: SkedEvent) => void
            type SkedId = Int
            type SkedMode = Int
            type SkedEvent = string
        `)}

    /** 
     * Skeduler id that will never be used. 
     * Can be used as a "no id", or "null" value. 
     */
    const ${Var('SKED_ID_NULL', 'SkedId')} = -1
    const ${Var('SKED_ID_COUNTER_INIT', 'SkedId')} = 1

    const ${Var('_SKED_WAIT_IN_PROGRESS', 'Int')} = 0
    const ${Var('_SKED_WAIT_OVER', 'Int')} = 1

    const ${Var('_SKED_MODE_WAIT', 'Int')} = 0
    const ${Var('_SKED_MODE_SUBSCRIBE', 'Int')} = 1

    // =========================== SKED API
    class SkedRequest {
        ${Var('id', 'SkedId')}
        ${Var('mode', 'SkedMode')}
    }

    class Skeduler {
        ${Var('requests', 'Map<SkedEvent, Array<SkedRequest>>')}
        ${Var('callbacks', 'Map<SkedId, SkedCallback>')}
        ${Var('isLoggingEvents', 'boolean')}
        ${Var('eventLog', 'Set<SkedEvent>')}
        ${Var('idCounter', 'SkedId')}
    }

    /** Creates a new Skeduler. */
    function sked_create ${Func([Var('isLoggingEvents', 'boolean')], 'Skeduler')} {
        return {
            eventLog: new Set(),
            requests: new Map(),
            callbacks: new Map(),
            idCounter: SKED_ID_COUNTER_INIT,
            isLoggingEvents,
        }
    }

    /** 
     * Asks the skeduler to wait for an event to occur and trigger a callback. 
     * If the event has already occurred, the callback is triggered instantly 
     * when calling the function.
     * Once triggered, the callback is forgotten.
     * @returns an id allowing to cancel the callback with {@link sked_cancel}
     */
    function sked_wait ${Func([
    Var('skeduler', 'Skeduler'),
    Var('event', 'SkedEvent'),
    Var('callback', 'SkedCallback'),
], 'SkedId')} {
        if (skeduler.isLoggingEvents === false) {
            throw new Error("Please activate skeduler's isLoggingEvents")
        }

        if (skeduler.eventLog.has(event)) {
            callback(event)
            return SKED_ID_NULL
        } else {
            return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
        }
    }

    /** 
     * Asks the skeduler to wait for an event to occur and trigger a callback. 
     * If the event has already occurred, the callback is NOT triggered immediatelly.
     * Once triggered, the callback is forgotten.
     * @returns an id allowing to cancel the callback with {@link sked_cancel}
     */
    function sked_wait_future ${Func([
    Var('skeduler', 'Skeduler'),
    Var('event', 'SkedEvent'),
    Var('callback', 'SkedCallback'),
], 'SkedId')} {
        return _sked_createRequest(skeduler, event, callback, _SKED_MODE_WAIT)
    }

    /** 
     * Asks the skeduler to trigger a callback everytime an event occurs 
     * @returns an id allowing to cancel the callback with {@link sked_cancel}
     */
    function sked_subscribe ${Func([
    Var('skeduler', 'Skeduler'),
    Var('event', 'SkedEvent'),
    Var('callback', 'SkedCallback'),
], 'SkedId')} {
        return _sked_createRequest(skeduler, event, callback, _SKED_MODE_SUBSCRIBE)
    }

    /** Notifies the skeduler that an event has just occurred. */
    function sked_emit ${Func([Var('skeduler', 'Skeduler'), Var('event', 'SkedEvent')], 'void')} {
        if (skeduler.isLoggingEvents === true) {
            skeduler.eventLog.add(event)
        }
        if (skeduler.requests.has(event)) {
            const ${Var('requests', 'Array<SkedRequest>')} = skeduler.requests.get(event)
            const ${Var('requestsStaying', 'Array<SkedRequest>')} = []
            for (let ${Var('i', 'Int')} = 0; i < requests.length; i++) {
                const ${Var('request', 'SkedRequest')} = requests[i]
                if (skeduler.callbacks.has(request.id)) {
                    skeduler.callbacks.get(request.id)(event)
                    if (request.mode === _SKED_MODE_WAIT) {
                        skeduler.callbacks.delete(request.id)
                    } else {
                        requestsStaying.push(request)
                    }
                }
            }
            skeduler.requests.set(event, requestsStaying)
        }
    }

    /** Cancels a callback */
    function sked_cancel ${Func([Var('skeduler', 'Skeduler'), Var('id', 'SkedId')], 'void')} {
        skeduler.callbacks.delete(id)
    }

    // =========================== PRIVATE
    function _sked_createRequest ${Func([
    Var('skeduler', 'Skeduler'),
    Var('event', 'SkedEvent'),
    Var('callback', 'SkedCallback'),
    Var('mode', 'SkedMode'),
], 'SkedId')} {
        const ${Var('id', 'SkedId')} = _sked_nextId(skeduler)
        const ${Var('request', 'SkedRequest')} = {id, mode}
        skeduler.callbacks.set(id, callback)
        if (!skeduler.requests.has(event)) {
            skeduler.requests.set(event, [request])    
        } else {
            skeduler.requests.get(event).push(request)
        }
        return id
    }

    function _sked_nextId ${Func([Var('skeduler', 'Skeduler')], 'SkedId')} {
        return skeduler.idCounter++
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
const commonsCore = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        const _commons_ENGINE_LOGGED_SKEDULER = sked_create(true)
        const _commons_FRAME_SKEDULER = sked_create(false)

        function _commons_emitEngineConfigure ${Func([], 'void')} {
            sked_emit(_commons_ENGINE_LOGGED_SKEDULER, 'configure')
        }
        
        function _commons_emitFrame ${Func([Var('frame', 'Int')], 'void')} {
            sked_emit(_commons_FRAME_SKEDULER, frame.toString())
        }
    `,
    dependencies: [sked],
};
const commonsArrays = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        const ${Var('_commons_ARRAYS', 'Map<string, FloatArray>')} = new Map()
        const ${Var('_commons_ARRAYS_SKEDULER', 'Skeduler')} = sked_create(false)

        /** Gets an named array, throwing an error if the array doesn't exist. */
        function commons_getArray ${Func([Var('arrayName', 'string')], 'FloatArray')} {
            if (!_commons_ARRAYS.has(arrayName)) {
                throw new Error('Unknown array ' + arrayName)
            }
            return _commons_ARRAYS.get(arrayName)
        }

        function commons_hasArray ${Func([Var('arrayName', 'string')], 'boolean')} {
            return _commons_ARRAYS.has(arrayName)
        }

        function commons_setArray ${Func([Var('arrayName', 'string'), Var('array', 'FloatArray')], 'void')} {
            _commons_ARRAYS.set(arrayName, array)
            sked_emit(_commons_ARRAYS_SKEDULER, arrayName)
        }

        /** 
         * @param callback Called immediately if the array exists, and subsequently, everytime 
         * the array is set again.
         * @returns An id that can be used to cancel the subscription.
         */
        function commons_subscribeArrayChanges ${Func([Var('arrayName', 'string'), Var('callback', 'SkedCallback')], 'SkedId')} {
            const id = sked_subscribe(_commons_ARRAYS_SKEDULER, arrayName, callback)
            if (_commons_ARRAYS.has(arrayName)) {
                callback(arrayName)
            }
            return id
        }

        /** 
         * @param id The id received when subscribing.
         */
        function commons_cancelArrayChangesSubscription ${Func([Var('id', 'SkedId')], 'void')} {
            sked_cancel(_commons_ARRAYS_SKEDULER, id)
        }
    `,
    exports: [{ name: 'commons_getArray' }, { name: 'commons_setArray' }],
};
const commonsWaitEngineConfigure = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        /** 
         * @param callback Called when the engine is configured, or immediately if the engine
         * was already configured.
         */
        function commons_waitEngineConfigure ${Func([Var('callback', 'SkedCallback')], 'void')} {
            sked_wait(_commons_ENGINE_LOGGED_SKEDULER, 'configure', callback)
        }
    `,
    dependencies: [commonsCore],
};
const commonsWaitFrame = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        /** 
         * Schedules a callback to be called at the given frame.
         * If the frame already occurred, or is the current frame, the callback won't be executed.
         */
        function commons_waitFrame ${Func([Var('frame', 'Int'), Var('callback', 'SkedCallback')], 'SkedId')} {
            return sked_wait_future(_commons_FRAME_SKEDULER, frame.toString(), callback)
        }

        /** 
         * Cancels waiting for a frame to occur.
         */
        function commons_cancelWaitFrame ${Func([Var('id', 'SkedId')], 'void')} {
            sked_cancel(_commons_FRAME_SKEDULER, id)
        }

    `,
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
        return renderCode `${renderSwitch([
            target === 'assemblyscript',
            `
                    type FloatArray = ${FloatArray}
                    type Float = ${Float}
                    type Int = ${Int}

                    function toInt (v: Float): Int { return ${Int}(v) }
                    function toFloat (v: Int): Float { return ${Float}(v) }
                    function createFloatArray (length: Int): FloatArray {
                        return new ${FloatArray}(length)
                    }
                    function setFloatDataView (
                        dataView: DataView, 
                        position: Int, 
                        value: Float,
                    ): void { dataView.${setFloat}(position, value) }
                    function getFloatDataView (
                        dataView: DataView, 
                        position: Int, 
                    ): Float { return dataView.${getFloat}(position) }

                    // =========================== EXPORTED API
                    function x_core_createListOfArrays(): FloatArray[] {
                        const arrays: FloatArray[] = []
                        return arrays
                    }

                    function x_core_pushToListOfArrays(arrays: FloatArray[], array: FloatArray): void {
                        arrays.push(array)
                    }

                    function x_core_getListOfArraysLength(arrays: FloatArray[]): Int {
                        return arrays.length
                    }

                    function x_core_getListOfArraysElem(arrays: FloatArray[], index: Int): FloatArray {
                        return arrays[index]
                    }
                `,
        ], [
            target === 'javascript',
            `
                    const i32 = (v) => v
                    const f32 = i32
                    const f64 = i32
                    const toInt = (v) => v
                    const toFloat = (v) => v
                    const createFloatArray = (length) => 
                        new ${FloatArray}(length)
                    const setFloatDataView = (d, p, v) => d.${setFloat}(p, v)
                    const getFloatDataView = (d, p) => d.${getFloat}(p)
                `,
        ])}`;
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
const msg = {
    codeGenerator: ({ target }) => renderCode `${renderSwitch([
        target === 'assemblyscript',
        `
                    type MessageFloatToken = Float
                    type MessageCharToken = Int

                    type MessageTemplate = Array<Int>
                    type MessageHeaderEntry = Int
                    type MessageHeader = Int32Array

                    const MSG_FLOAT_TOKEN: MessageHeaderEntry = 0
                    const MSG_STRING_TOKEN: MessageHeaderEntry = 1


                    // =========================== EXPORTED API
                    function x_msg_create(templateTypedArray: Int32Array): Message {
                        const template: MessageTemplate = new Array<Int>(templateTypedArray.length)
                        for (let i: Int = 0; i < templateTypedArray.length; i++) {
                            template[i] = templateTypedArray[i]
                        }
                        return msg_create(template)
                    }

                    function x_msg_getTokenTypes(message: Message): MessageHeader {
                        return message.tokenTypes
                    }

                    function x_msg_createTemplate(length: i32): Int32Array {
                        return new Int32Array(length)
                    }


                    // =========================== MSG API
                    function msg_create(template: MessageTemplate): Message {
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

                        return new Message(buffer)
                    }

                    function msg_writeStringToken(
                        message: Message, 
                        tokenIndex: Int,
                        value: string,
                    ): void {
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
                    }

                    function msg_writeFloatToken(
                        message: Message, 
                        tokenIndex: Int,
                        value: MessageFloatToken,
                    ): void {
                        setFloatDataView(message.dataView, message.tokenPositions[tokenIndex], value)
                    }

                    function msg_readStringToken(
                        message: Message, 
                        tokenIndex: Int,
                    ): string {
                        const startPosition = message.tokenPositions[tokenIndex]
                        const endPosition = message.tokenPositions[tokenIndex + 1]
                        const stringLength: Int = (endPosition - startPosition) / sizeof<MessageCharToken>()
                        let value: string = ''
                        for (let i = 0; i < stringLength; i++) {
                            value += String.fromCodePoint(message.dataView.getInt32(startPosition + sizeof<MessageCharToken>() * i))
                        }
                        return value
                    }

                    function msg_readFloatToken(
                        message: Message, 
                        tokenIndex: Int,
                    ): MessageFloatToken {
                        return getFloatDataView(message.dataView, message.tokenPositions[tokenIndex])
                    }

                    function msg_getLength(message: Message): Int {
                        return message.tokenTypes.length
                    }

                    function msg_getTokenType(message: Message, tokenIndex: Int): Int {
                        return message.tokenTypes[tokenIndex]
                    }

                    function msg_isStringToken(
                        message: Message, 
                        tokenIndex: Int    
                    ): boolean {
                        return msg_getTokenType(message, tokenIndex) === MSG_STRING_TOKEN
                    }

                    function msg_isFloatToken(
                        message: Message, 
                        tokenIndex: Int    
                    ): boolean {
                        return msg_getTokenType(message, tokenIndex) === MSG_FLOAT_TOKEN
                    }

                    function msg_isMatching(message: Message, tokenTypes: Array<MessageHeaderEntry>): boolean {
                        if (message.tokenTypes.length !== tokenTypes.length) {
                            return false
                        }
                        for (let i: Int = 0; i < tokenTypes.length; i++) {
                            if (message.tokenTypes[i] !== tokenTypes[i]) {
                                return false
                            }
                        }
                        return true
                    }

                    function msg_floats(values: Array<Float>): Message {
                        const message: Message = msg_create(values.map<MessageHeaderEntry>(v => MSG_FLOAT_TOKEN))
                        for (let i: Int = 0; i < values.length; i++) {
                            msg_writeFloatToken(message, i, values[i])
                        }
                        return message
                    }

                    function msg_strings(values: Array<string>): Message {
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
                    }

                    function msg_display(message: Message): string {
                        let displayArray: Array<string> = []
                        for (let i: Int = 0; i < msg_getLength(message); i++) {
                            if (msg_isFloatToken(message, i)) {
                                displayArray.push(msg_readFloatToken(message, i).toString())
                            } else {
                                displayArray.push('"' + msg_readStringToken(message, i) + '"')
                            }
                        }
                        return '[' + displayArray.join(', ') + ']'
                    }


                    // =========================== PRIVATE
                    // Message header : [
                    //      <Token count>, 
                    //      <Token 1 type>,  ..., <Token N type>, 
                    //      <Token 1 start>, ..., <Token N start>, <Token N end>
                    //      ... DATA ...
                    // ]
                    class Message {
                        public dataView: DataView
                        public header: MessageHeader
                        public tokenCount: MessageHeaderEntry
                        public tokenTypes: MessageHeader
                        public tokenPositions: MessageHeader

                        constructor(messageBuffer: ArrayBuffer) {
                            const dataView = new DataView(messageBuffer)
                            const tokenCount = _msg_unpackTokenCount(dataView)
                            const header = _msg_unpackHeader(dataView, tokenCount)
                            this.dataView = dataView
                            this.tokenCount = tokenCount
                            this.header = header 
                            this.tokenTypes = _msg_unpackTokenTypes(header)
                            this.tokenPositions = _msg_unpackTokenPositions(header)
                        }
                    }

                    function _msg_computeHeaderLength(tokenCount: Int): Int {
                        return 1 + tokenCount * 2 + 1
                    }

                    function _msg_unpackTokenCount(messageDataView: DataView): MessageHeaderEntry {
                        return messageDataView.getInt32(0)
                    }

                    function _msg_unpackHeader(messageDataView: DataView, tokenCount: MessageHeaderEntry): MessageHeader {
                        const headerLength = _msg_computeHeaderLength(tokenCount)
                        // TODO : why is this \`wrap\` not working ?
                        // return Int32Array.wrap(messageDataView.buffer, 0, headerLength)
                        const messageHeader = new Int32Array(headerLength)
                        for (let i = 0; i < headerLength; i++) {
                            messageHeader[i] = messageDataView.getInt32(sizeof<MessageHeaderEntry>() * i)
                        }
                        return messageHeader
                    }

                    function _msg_unpackTokenTypes(header: MessageHeader): MessageHeader {
                        return header.slice(1, 1 + header[0])
                    }

                    function _msg_unpackTokenPositions(header: MessageHeader): MessageHeader {
                        return header.slice(1 + header[0])
                    }
                `,
    ], [
        target === 'javascript',
        `
                    const MSG_FLOAT_TOKEN = "number"
                    const MSG_STRING_TOKEN = "string"
                    const msg_create = (template) => {
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
                    }
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
            `,
    ])}`,
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
/** Helper to get node implementation or throw an error if not implemented. */
const getNodeImplementation = (nodeImplementations, nodeType) => {
    const nodeImplementation = nodeImplementations[nodeType];
    if (!nodeImplementation) {
        throw new Error(`node [${nodeType}] is not implemented`);
    }
    return {
        stateVariables: {},
        generateDeclarations: () => '',
        generateLoop: () => '',
        generateMessageReceivers: () => ({}),
        dependencies: [],
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
    const { graph, graphTraversalDeclare, codeVariableNames, inletCallerSpecs, outletListenerSpecs, } = compilation;
    const graphTraversalNodes = graphTraversalDeclare.map((nodeId) => getNode(graph, nodeId));
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
/**
 * Build graph traversal for declaring nodes.
 * This should be exhaustive so that all nodes that are connected
 * to an input or output of the graph are declared correctly.
 * Order of nodes doesn't matter.
 * @TODO : outletListeners should also be included ?
 */
const buildGraphTraversalDeclare = (graph, inletCallerSpecs) => {
    const nodesPullingSignal = Object.values(graph).filter((node) => !!node.isPullingSignal);
    const nodesPushingMessages = Object.values(graph).filter((node) => !!node.isPushingMessages);
    Object.keys(inletCallerSpecs).forEach((nodeId) => {
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
 * Build graph traversal for the declaring nodes.
 * We first put nodes that push messages, so they have the opportunity
 * to change the engine state before running the loop.
 * !!! If a node is pushing messages but also writing signal outputs,
 * it will not be ran first, and stay in the signal flow.
 */
const buildGraphTraversalLoop = (graph) => {
    const nodesPullingSignal = Object.values(graph).filter((node) => !!node.isPullingSignal);
    const nodesPushingMessages = Object.values(graph).filter((node) => !!node.isPushingMessages);
    const combined = nodesPushingMessages.map((node) => node.id);
    signalNodes(graph, nodesPullingSignal).forEach((nodeId) => {
        // If a node is already in the traversal, because it's puhsing messages,
        // we prefer to remove it and put it after so that we keep the signal traversal
        // order unchanged.
        if (combined.includes(nodeId)) {
            combined.splice(combined.indexOf(nodeId), 1);
        }
        combined.push(nodeId);
    });
    return combined;
};
const engineMinimalDependencies = () => [
    core,
    commonsCore,
    msg,
];
const collectDependenciesFromTraversal = (compilation) => {
    const { graphTraversalDeclare, graph, nodeImplementations } = compilation;
    return graphTraversalDeclare.reduce((definitions, nodeId) => [
        ...definitions,
        ...getNodeImplementation(nodeImplementations, getNode(graph, nodeId).type).dependencies,
    ], []);
};
const collectExports = (target, dependencies) => _collectExportsRecursive(dependencies)
    .filter((xprt) => !xprt.targets || xprt.targets.includes(target))
    .reduce(
// De-duplicate exports
(exports, xprt) => exports.some((otherExport) => xprt.name === otherExport.name)
    ? exports
    : [...exports, xprt], []);
const collectImports = (dependencies) => _collectImportsRecursive(dependencies).reduce(
// De-duplicate imports
(imports, imprt) => imports.some((otherImport) => imprt.name === otherImport.name)
    ? imports
    : [...imports, imprt], []);
const _collectExportsRecursive = (dependencies) => dependencies
    .filter(isGlobalDefinitionWithSettings)
    .flatMap((globalCodeDefinition) => [
    ...(globalCodeDefinition.dependencies
        ? _collectExportsRecursive(globalCodeDefinition.dependencies)
        : []),
    ...(globalCodeDefinition.exports || []),
]);
const _collectImportsRecursive = (dependencies) => dependencies
    .filter(isGlobalDefinitionWithSettings)
    .flatMap((globalCodeDefinition) => [
    ...(globalCodeDefinition.dependencies
        ? _collectImportsRecursive(globalCodeDefinition.dependencies)
        : []),
    ...(globalCodeDefinition.imports || []),
]);
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
var generateDeclarationsGlobals = ({ macros: { Var, Func }, codeVariableNames: { globs }, }) => 
// prettier-ignore
`
        let ${Var(globs.iterFrame, 'Int')} = 0
        let ${Var(globs.frame, 'Int')} = 0
        let ${Var(globs.blockSize, 'Int')} = 0
        let ${Var(globs.sampleRate, 'Float')} = 0
        function ${globs.nullMessageReceiver} ${Func([Var('m', 'Message')], 'void')} {}
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
var generateDeclarationsGraph = (compilation) => {
    const { graph, graphTraversalDeclare, macros, codeVariableNames, nodeImplementations, outletListenerSpecs, precompiledPortlets: { precompiledInlets, precompiledOutlets }, debug, } = compilation;
    const graphTraversalNodes = graphTraversalDeclare.map((nodeId) => getNode(graph, nodeId));
    const { Var, Func } = macros;
    const { globs } = codeVariableNames;
    const _isInletAlreadyHandled = (nodeId, portletId) => (precompiledInlets[nodeId] || []).includes(portletId);
    const _isOutletAlreadyHandled = (nodeId, portletId) => (precompiledOutlets[nodeId] || []).includes(portletId);
    // prettier-ignore
    return renderCode `
        ${graphTraversalNodes.map(node => {
        const { ins, outs, rcvs, snds, state } = codeVariableNames.nodes[node.id];
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        const nodeMessageReceivers = nodeImplementation.generateMessageReceivers({
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
            nodeImplementation.generateDeclarations({
                macros, globs, state, snds, node, compilation
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
            return renderCode `
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
var generateLoop$m = (compilation) => {
    const { graph, graphTraversalLoop, codeVariableNames, macros, nodeImplementations, } = compilation;
    const { globs } = codeVariableNames;
    const graphTraversalNodes = graphTraversalLoop.map((nodeId) => getNode(graph, nodeId));
    // prettier-ignore
    return renderCode `
        for (${globs.iterFrame} = 0; ${globs.iterFrame} < ${globs.blockSize}; ${globs.iterFrame}++) {
            _commons_emitFrame(${globs.frame})
            ${graphTraversalNodes.map((node) => {
        const { outs, ins, snds, state } = codeVariableNames.nodes[node.id];
        const nodeImplementation = getNodeImplementation(nodeImplementations, node.type);
        return [
            // 1. Node loop implementation
            nodeImplementation.generateLoop({
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
var generateDeclarationsDependencies = (context, dependencies) => 
// De-duplicate code
_generateDependenciesDeclarationsRecursive(context, dependencies)
    .reduce((codes, code) => (!codes.includes(code) ? [...codes, code] : codes), [])
    .join('\n');
const _generateDependenciesDeclarationsRecursive = (context, dependencies) => dependencies.flatMap((globalCodeDefinition) => isGlobalDefinitionWithSettings(globalCodeDefinition)
    ? [
        ...(globalCodeDefinition.dependencies
            ? _generateDependenciesDeclarationsRecursive(context, globalCodeDefinition.dependencies)
            : []),
        globalCodeDefinition.codeGenerator(context),
    ]
    : [globalCodeDefinition(context)]);

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
var generateInletCallers = ({ inletCallerSpecs, codeVariableNames, macros: { Var, Func }, }) => 
// Here not possible to assign directly the receiver because otherwise assemblyscript
// doesn't export a function but a global instead.
renderCode `${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => inletIds.map((inletId) => `function ${codeVariableNames.inletCallers[nodeId][inletId]} ${Func([Var('m', 'Message')], 'void')} {${codeVariableNames.nodes[nodeId].rcvs[inletId]}(m)}`))}`;

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
var generateOutletListeners = ({ outletListenerSpecs, codeVariableNames }, generateCode) => renderCode `${Object.entries(outletListenerSpecs).map(([nodeId, outletIds]) => outletIds.map((outletId) => {
    const listenerVariableName = codeVariableNames.outletListeners[nodeId][outletId];
    return generateCode(listenerVariableName, nodeId, outletId);
}))}`;

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
/**
 * Embed arrays passed to the compiler in the compiled module.
 */
var generateEmbeddedArrays = (compilation) => renderCode `
    ${Object.entries(compilation.arrays).map(([arrayName, array]) => `
        commons_setArray("${arrayName}", new ${getFloatArrayType(compilation.audioSettings.bitDepth).name}(${array.length}))
        commons_getArray("${arrayName}").set(${JSON.stringify(Array.from(array))})
    `)}
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
var generateImportsExports = (target, dependencies, generateImport, generateExport) => 
// prettier-ignore
renderCode `
        ${collectImports(dependencies).map(generateImport)}
        ${collectExports(target, dependencies).map(generateExport)}
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
var compileToJavascript = (compilation) => {
    const { codeVariableNames, outletListenerSpecs, inletCallerSpecs } = compilation;
    const globs = compilation.codeVariableNames.globs;
    const metadata = buildMetadata(compilation);
    const dependencies = [
        ...engineMinimalDependencies(),
        ...collectDependenciesFromTraversal(compilation),
    ];
    // prettier-ignore
    return renderCode `
        ${generateDeclarationsGlobals(compilation)}
        ${generateDeclarationsDependencies(compilation, dependencies)}
        ${generateDeclarationsGraph(compilation)}

        ${generateEmbeddedArrays(compilation)}

        ${generateInletCallers(compilation)}
        ${generateOutletListeners(compilation, (variableName, nodeId, outletId) => `
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
                ${generateLoop$m(compilation)}
            },
            outletListeners: {
                ${Object.entries(outletListenerSpecs).map(([nodeId, outletIds]) => renderCode `${nodeId}: {
                        ${outletIds.map(outletId => `"${outletId}": {onMessage: () => undefined},`)}
                    },`)}
            },
            inletCallers: {
                ${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => renderCode `${nodeId}: {

                        ${inletIds.map(inletId => `"${inletId}": ${codeVariableNames.inletCallers[nodeId][inletId]},`)}
                    },`)}
            },
        }

        ${generateImportsExports('javascript', dependencies, ({ name }) => `
                exports.${name} = () => { throw new Error('import for ${name} not provided') }
                const ${name} = (...args) => exports.${name}(...args)
            `, ({ name }) => `exports.${name} = ${name}`)}
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
var compileToAssemblyscript = (compilation) => {
    const { audioSettings, inletCallerSpecs, codeVariableNames, macros: { Func, Var }, } = compilation;
    const { channelCount } = audioSettings;
    const globs = compilation.codeVariableNames.globs;
    const metadata = buildMetadata(compilation);
    const dependencies = [
        ...engineMinimalDependencies(),
        ...collectDependenciesFromTraversal(compilation),
    ];
    // prettier-ignore
    return renderCode `
        ${generateDeclarationsGlobals(compilation)}
        ${generateDeclarationsDependencies(compilation, dependencies)}
        ${generateDeclarationsGraph(compilation)}

        ${generateEmbeddedArrays(compilation)}

        ${generateInletCallers(compilation)}        
        ${generateOutletListeners(compilation, (variableName) => `
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
            ${generateLoop$m(compilation)}
        }

        export {
            metadata,
            ${Object.entries(inletCallerSpecs).map(([nodeId, inletIds]) => inletIds.map(inletId => codeVariableNames.inletCallers[nodeId][inletId] + ','))}
        }

        ${generateImportsExports('assemblyscript', dependencies, ({ name, args, returns }) => `export declare function ${name} ${Func(args.map((a) => Var(a[0], a[1])), returns)}`, ({ name }) => `export { ${name} }`)}
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
const createNamespaceFromPortlets = (label, portletMap, portletType, mapFunction) => createNamespace(label, mapArray(Object.values(portletMap).filter((portlet) => portlet.type === portletType), (portlet) => [portlet.id, mapFunction(portlet)]));

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
var index = (graph, nodeImplementations, settings) => {
    const { audioSettings, arrays, inletCallerSpecs, outletListenerSpecs, target, debug, } = validateSettings(settings);
    const macros = getMacros(target);
    const codeVariableNames = generate(nodeImplementations, graph, debug);
    attachInletCallers(codeVariableNames, inletCallerSpecs);
    attachOutletListeners(codeVariableNames, outletListenerSpecs);
    const graphTraversalDeclare = buildGraphTraversalDeclare(graph, inletCallerSpecs);
    const graphTraversalLoop = buildGraphTraversalLoop(graph);
    const trimmedGraph = trimGraph(graph, graphTraversalDeclare);
    return {
        status: 0,
        code: executeCompilation({
            target,
            graph: trimmedGraph,
            graphTraversalDeclare,
            graphTraversalLoop,
            nodeImplementations,
            audioSettings,
            arrays,
            inletCallerSpecs,
            outletListenerSpecs,
            codeVariableNames,
            macros,
            debug,
            precompiledPortlets: {
                precompiledInlets: {},
                precompiledOutlets: {},
            },
        }),
    };
};
/** Asserts settings are valid (or throws error) and sets default values. */
const validateSettings = (settings) => {
    const arrays = settings.arrays || {};
    const inletCallerSpecs = settings.inletCallerSpecs || {};
    const outletListenerSpecs = settings.outletListenerSpecs || {};
    const debug = settings.debug || false;
    if (![32, 64].includes(settings.audioSettings.bitDepth)) {
        throw new InvalidSettingsError(`"bitDepth" can be only 32 or 64`);
    }
    return {
        ...settings,
        arrays,
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

var WEBPD_RUNTIME_CODE = "var WebPdRuntime = (function (exports) {\n  'use strict';\n\n  var _WebPdWorkletProcessorCode = \"/*\\n * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\\n *\\n * This file is part of WebPd\\n * (see https://github.com/sebpiq/WebPd).\\n *\\n * This program is free software: you can redistribute it and/or modify\\n * it under the terms of the GNU Lesser General Public License as published by\\n * the Free Software Foundation, either version 3 of the License, or\\n * (at your option) any later version.\\n *\\n * This program is distributed in the hope that it will be useful,\\n * but WITHOUT ANY WARRANTY; without even the implied warranty of\\n * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\\n * GNU Lesser General Public License for more details.\\n *\\n * You should have received a copy of the GNU Lesser General Public License\\n * along with this program. If not, see <http://www.gnu.org/licenses/>.\\n */\\nconst FS_CALLBACK_NAMES = [\\n    'onReadSoundFile',\\n    'onOpenSoundReadStream',\\n    'onWriteSoundFile',\\n    'onOpenSoundWriteStream',\\n    'onSoundStreamData',\\n    'onCloseSoundStream',\\n];\\nclass WasmWorkletProcessor extends AudioWorkletProcessor {\\n    constructor() {\\n        super();\\n        this.port.onmessage = this.onMessage.bind(this);\\n        this.settings = {\\n            blockSize: null,\\n            sampleRate,\\n        };\\n        this.dspConfigured = false;\\n        this.engine = null;\\n    }\\n    process(inputs, outputs) {\\n        const output = outputs[0];\\n        const input = inputs[0];\\n        if (!this.dspConfigured) {\\n            if (!this.engine) {\\n                return true;\\n            }\\n            this.settings.blockSize = output[0].length;\\n            this.engine.configure(this.settings.sampleRate, this.settings.blockSize);\\n            this.dspConfigured = true;\\n        }\\n        this.engine.loop(input, output);\\n        return true;\\n    }\\n    onMessage(messageEvent) {\\n        const message = messageEvent.data;\\n        switch (message.type) {\\n            case 'code:WASM':\\n                this.setWasm(message.payload.wasmBuffer);\\n                break;\\n            case 'code:JS':\\n                this.setJsCode(message.payload.jsCode);\\n                break;\\n            case 'inletCaller':\\n                this.engine.inletCallers[message.payload.nodeId][message.payload.portletId](message.payload.message);\\n                break;\\n            case 'fs':\\n                const returned = this.engine.fs[message.payload.functionName].apply(null, message.payload.arguments);\\n                this.port.postMessage({\\n                    type: 'fs',\\n                    payload: {\\n                        functionName: message.payload.functionName + '_return',\\n                        operationId: message.payload.arguments[0],\\n                        returned,\\n                    },\\n                });\\n                break;\\n            case 'destroy':\\n                this.destroy();\\n                break;\\n            default:\\n                new Error(`unknown message type ${message.type}`);\\n        }\\n    }\\n    // TODO : control for channelCount of wasmModule\\n    setWasm(wasmBuffer) {\\n        return AssemblyScriptWasmBindings.createEngine(wasmBuffer).then((engine) => this.setEngine(engine));\\n    }\\n    setJsCode(code) {\\n        const engine = JavaScriptBindings.createEngine(code);\\n        this.setEngine(engine);\\n    }\\n    setEngine(engine) {\\n        FS_CALLBACK_NAMES.forEach((functionName) => {\\n            ;\\n            engine.fs[functionName] = (...args) => {\\n                // We don't use transferables, because that would imply reallocating each time new array in the engine.\\n                this.port.postMessage({\\n                    type: 'fs',\\n                    payload: {\\n                        functionName,\\n                        arguments: args,\\n                    },\\n                });\\n            };\\n        });\\n        this.engine = engine;\\n        this.dspConfigured = false;\\n    }\\n    destroy() {\\n        this.process = () => false;\\n    }\\n}\\nregisterProcessor('webpd-node', WasmWorkletProcessor);\\n\";\n\n  var AssemblyScriptWasmBindingsCode = \"var AssemblyScriptWasmBindings = (function (exports) {\\n    'use strict';\\n\\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\\n    const createModule = (rawModule, bindings) => new Proxy({}, {\\n        get: (_, k) => {\\n            if (bindings.hasOwnProperty(k)) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                switch (bindingSpec.type) {\\n                    case 'raw':\\n                        if (k in rawModule) {\\n                            return rawModule[key];\\n                        }\\n                        else {\\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\\n                        }\\n                    case 'proxy':\\n                    case 'callback':\\n                        return bindingSpec.value;\\n                }\\n            }\\n            else {\\n                return undefined;\\n            }\\n        },\\n        set: (_, k, newValue) => {\\n            if (bindings.hasOwnProperty(String(k))) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                if (bindingSpec.type === 'callback') {\\n                    bindingSpec.value = newValue;\\n                }\\n                else {\\n                    throw new Error(`Binding key ${String(key)} is read-only`);\\n                }\\n            }\\n            else {\\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\\n            }\\n            return true;\\n        },\\n    });\\n\\n    const liftString = (wasmExports, pointer) => {\\n        if (!pointer)\\n            return null;\\n        pointer = pointer >>> 0;\\n        const end = (pointer +\\n            new Uint32Array(wasmExports.memory.buffer)[(pointer - 4) >>> 2]) >>>\\n            1;\\n        const memoryU16 = new Uint16Array(wasmExports.memory.buffer);\\n        let start = pointer >>> 1;\\n        let string = '';\\n        while (end - start > 1024) {\\n            string += String.fromCharCode(...memoryU16.subarray(start, (start += 1024)));\\n        }\\n        return string + String.fromCharCode(...memoryU16.subarray(start, end));\\n    };\\n    const lowerString = (wasmExports, value) => {\\n        if (value == null)\\n            return 0;\\n        const length = value.length, pointer = wasmExports.__new(length << 1, 1) >>> 0, memoryU16 = new Uint16Array(wasmExports.memory.buffer);\\n        for (let i = 0; i < length; ++i)\\n            memoryU16[(pointer >>> 1) + i] = value.charCodeAt(i);\\n        return pointer;\\n    };\\n    const readTypedArray = (wasmExports, constructor, pointer) => {\\n        if (!pointer)\\n            return null;\\n        const memoryU32 = new Uint32Array(wasmExports.memory.buffer);\\n        return new constructor(wasmExports.memory.buffer, memoryU32[(pointer + 4) >>> 2], memoryU32[(pointer + 8) >>> 2] / constructor.BYTES_PER_ELEMENT);\\n    };\\n    const lowerFloatArray = (wasmExports, bitDepth, data) => {\\n        const arrayType = getFloatArrayType(bitDepth);\\n        const arrayPointer = wasmExports.createFloatArray(data.length);\\n        const array = readTypedArray(wasmExports, arrayType, arrayPointer);\\n        array.set(data);\\n        return { array, arrayPointer };\\n    };\\n    const lowerListOfFloatArrays = (wasmExports, bitDepth, data) => {\\n        const arraysPointer = wasmExports.x_core_createListOfArrays();\\n        data.forEach((array) => {\\n            const { arrayPointer } = lowerFloatArray(wasmExports, bitDepth, array);\\n            wasmExports.x_core_pushToListOfArrays(arraysPointer, arrayPointer);\\n        });\\n        return arraysPointer;\\n    };\\n    const readListOfFloatArrays = (wasmExports, bitDepth, listOfArraysPointer) => {\\n        const listLength = wasmExports.x_core_getListOfArraysLength(listOfArraysPointer);\\n        const arrays = [];\\n        const arrayType = getFloatArrayType(bitDepth);\\n        for (let i = 0; i < listLength; i++) {\\n            const arrayPointer = wasmExports.x_core_getListOfArraysElem(listOfArraysPointer, i);\\n            arrays.push(readTypedArray(wasmExports, arrayType, arrayPointer));\\n        }\\n        return arrays;\\n    };\\n\\n    const liftMessage = (wasmExports, messagePointer) => {\\n        const messageTokenTypesPointer = wasmExports.x_msg_getTokenTypes(messagePointer);\\n        const messageTokenTypes = readTypedArray(wasmExports, Int32Array, messageTokenTypesPointer);\\n        const message = [];\\n        messageTokenTypes.forEach((tokenType, tokenIndex) => {\\n            if (tokenType === wasmExports.MSG_FLOAT_TOKEN.valueOf()) {\\n                message.push(wasmExports.msg_readFloatToken(messagePointer, tokenIndex));\\n            }\\n            else if (tokenType === wasmExports.MSG_STRING_TOKEN.valueOf()) {\\n                const stringPointer = wasmExports.msg_readStringToken(messagePointer, tokenIndex);\\n                message.push(liftString(wasmExports, stringPointer));\\n            }\\n        });\\n        return message;\\n    };\\n    const lowerMessage = (wasmExports, message) => {\\n        const template = message.reduce((template, value) => {\\n            if (typeof value === 'number') {\\n                template.push(wasmExports.MSG_FLOAT_TOKEN.valueOf());\\n            }\\n            else if (typeof value === 'string') {\\n                template.push(wasmExports.MSG_STRING_TOKEN.valueOf());\\n                template.push(value.length);\\n            }\\n            else {\\n                throw new Error(`invalid message value ${value}`);\\n            }\\n            return template;\\n        }, []);\\n        const templateArrayPointer = wasmExports.x_msg_createTemplate(template.length);\\n        const loweredTemplateArray = readTypedArray(wasmExports, Int32Array, templateArrayPointer);\\n        loweredTemplateArray.set(template);\\n        const messagePointer = wasmExports.x_msg_create(templateArrayPointer);\\n        message.forEach((value, index) => {\\n            if (typeof value === 'number') {\\n                wasmExports.msg_writeFloatToken(messagePointer, index, value);\\n            }\\n            else if (typeof value === 'string') {\\n                const stringPointer = lowerString(wasmExports, value);\\n                wasmExports.msg_writeStringToken(messagePointer, index, stringPointer);\\n            }\\n        });\\n        return messagePointer;\\n    };\\n\\n    const mapObject = (src, func) => {\\n        const dest = {};\\n        Object.entries(src).forEach(([key, srcValue], i) => {\\n            dest[key] = func(srcValue, key, i);\\n        });\\n        return dest;\\n    };\\n    const mapArray = (src, func) => {\\n        const dest = {};\\n        src.forEach((srcValue, i) => {\\n            const [key, destValue] = func(srcValue, i);\\n            dest[key] = destValue;\\n        });\\n        return dest;\\n    };\\n\\n    const instantiateWasmModule = async (wasmBuffer, wasmImports = {}) => {\\n        const instanceAndModule = await WebAssembly.instantiate(wasmBuffer, {\\n            env: {\\n                abort: (messagePointer, _, lineNumber, columnNumber) => {\\n                    const message = liftString(wasmExports, messagePointer);\\n                    lineNumber = lineNumber;\\n                    columnNumber = columnNumber;\\n                    (() => {\\n                        throw Error(`${message} at ${lineNumber}:${columnNumber}`);\\n                    })();\\n                },\\n                seed: () => {\\n                    return (() => {\\n                        return Date.now() * Math.random();\\n                    })();\\n                },\\n                'console.log': (textPointer) => {\\n                    console.log(liftString(wasmExports, textPointer));\\n                },\\n            },\\n            ...wasmImports,\\n        });\\n        const wasmExports = instanceAndModule.instance\\n            .exports;\\n        return instanceAndModule.instance;\\n    };\\n\\n    const updateWasmInOuts = (rawModule, engineData) => {\\n        engineData.wasmOutput = readTypedArray(rawModule, engineData.arrayType, rawModule.getOutput());\\n        engineData.wasmInput = readTypedArray(rawModule, engineData.arrayType, rawModule.getInput());\\n    };\\n    const createEngineLifecycleBindings = (rawModule, engineData) => {\\n        return {\\n            configure: {\\n                type: 'proxy',\\n                value: (sampleRate, blockSize) => {\\n                    engineData.metadata.audioSettings.blockSize = blockSize;\\n                    engineData.metadata.audioSettings.sampleRate = sampleRate;\\n                    engineData.blockSize = blockSize;\\n                    rawModule.configure(sampleRate, blockSize);\\n                    updateWasmInOuts(rawModule, engineData);\\n                },\\n            },\\n            loop: {\\n                type: 'proxy',\\n                value: (input, output) => {\\n                    for (let channel = 0; channel < input.length; channel++) {\\n                        engineData.wasmInput.set(input[channel], channel * engineData.blockSize);\\n                    }\\n                    updateWasmInOuts(rawModule, engineData);\\n                    rawModule.loop();\\n                    updateWasmInOuts(rawModule, engineData);\\n                    for (let channel = 0; channel < output.length; channel++) {\\n                        output[channel].set(engineData.wasmOutput.subarray(engineData.blockSize * channel, engineData.blockSize * (channel + 1)));\\n                    }\\n                },\\n            },\\n        };\\n    };\\n    const createInletCallersBindings = (rawModule, engineData) => mapObject(engineData.metadata.compilation.inletCallerSpecs, (inletIds, nodeId) => ({\\n        type: 'proxy',\\n        value: mapArray(inletIds, (inletId) => [\\n            inletId,\\n            (message) => {\\n                const messagePointer = lowerMessage(rawModule, message);\\n                rawModule[engineData.metadata.compilation.codeVariableNames\\n                    .inletCallers[nodeId][inletId]](messagePointer);\\n            },\\n        ]),\\n    }));\\n    const createOutletListenersBindings = (_, engineData) => mapObject(engineData.metadata.compilation.outletListenerSpecs, (outletIds) => ({\\n        type: 'proxy',\\n        value: mapArray(outletIds, (outletId) => [\\n            outletId,\\n            {\\n                onMessage: () => undefined,\\n            },\\n        ]),\\n    }));\\n    const outletListenersImports = (forwardReferences, metadata) => {\\n        const wasmImports = {};\\n        const { codeVariableNames } = metadata.compilation;\\n        Object.entries(metadata.compilation.outletListenerSpecs).forEach(([nodeId, outletIds]) => {\\n            outletIds.forEach((outletId) => {\\n                const listenerName = codeVariableNames.outletListeners[nodeId][outletId];\\n                wasmImports[listenerName] = (messagePointer) => {\\n                    const message = liftMessage(forwardReferences.rawModule, messagePointer);\\n                    forwardReferences.modules.outletListeners[nodeId][outletId].onMessage(message);\\n                };\\n            });\\n        });\\n        return wasmImports;\\n    };\\n    const readMetadata = async (wasmBuffer) => {\\n        const inputImports = {};\\n        const wasmModule = WebAssembly.Module.imports(new WebAssembly.Module(wasmBuffer));\\n        wasmModule\\n            .filter((imprt) => imprt.module === 'input' && imprt.kind === 'function')\\n            .forEach((imprt) => (inputImports[imprt.name] = () => undefined));\\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\\n            input: inputImports,\\n        });\\n        const wasmExports = wasmInstance.exports;\\n        const stringPointer = wasmExports.metadata.valueOf();\\n        const metadataJSON = liftString(wasmExports, stringPointer);\\n        return JSON.parse(metadataJSON);\\n    };\\n\\n    const createFsBindings = (rawModule, engineData) => ({\\n        sendReadSoundFileResponse: {\\n            type: 'proxy',\\n            value: (operationId, status, sound) => {\\n                let soundPointer = 0;\\n                if (sound) {\\n                    soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\\n                }\\n                rawModule.x_fs_onReadSoundFileResponse(operationId, status, soundPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n            },\\n        },\\n        sendWriteSoundFileResponse: {\\n            type: 'proxy',\\n            value: rawModule.x_fs_onWriteSoundFileResponse,\\n        },\\n        sendSoundStreamData: {\\n            type: 'proxy',\\n            value: (operationId, sound) => {\\n                const soundPointer = lowerListOfFloatArrays(rawModule, engineData.bitDepth, sound);\\n                const writtenFrameCount = rawModule.x_fs_onSoundStreamData(operationId, soundPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n                return writtenFrameCount;\\n            },\\n        },\\n        closeSoundStream: {\\n            type: 'proxy',\\n            value: rawModule.x_fs_onCloseSoundStream,\\n        },\\n        onReadSoundFile: { type: 'callback', value: () => undefined },\\n        onWriteSoundFile: { type: 'callback', value: () => undefined },\\n        onOpenSoundReadStream: { type: 'callback', value: () => undefined },\\n        onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\\n        onSoundStreamData: { type: 'callback', value: () => undefined },\\n        onCloseSoundStream: { type: 'callback', value: () => undefined },\\n    });\\n    const createFsImports = (forwardReferences) => {\\n        let wasmImports = {\\n            i_fs_readSoundFile: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onReadSoundFile(operationId, url, info);\\n            },\\n            i_fs_writeSoundFile: (operationId, soundPointer, urlPointer, infoPointer) => {\\n                const sound = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, soundPointer);\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onWriteSoundFile(operationId, sound, url, info);\\n            },\\n            i_fs_openSoundReadStream: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                updateWasmInOuts(forwardReferences.rawModule, forwardReferences.engineData);\\n                forwardReferences.modules.fs.onOpenSoundReadStream(operationId, url, info);\\n            },\\n            i_fs_openSoundWriteStream: (operationId, urlPointer, infoPointer) => {\\n                const url = liftString(forwardReferences.rawModule, urlPointer);\\n                const info = liftMessage(forwardReferences.rawModule, infoPointer);\\n                forwardReferences.modules.fs.onOpenSoundWriteStream(operationId, url, info);\\n            },\\n            i_fs_sendSoundStreamData: (operationId, blockPointer) => {\\n                const block = readListOfFloatArrays(forwardReferences.rawModule, forwardReferences.engineData.bitDepth, blockPointer);\\n                forwardReferences.modules.fs.onSoundStreamData(operationId, block);\\n            },\\n            i_fs_closeSoundStream: (...args) => forwardReferences.modules.fs.onCloseSoundStream(...args),\\n        };\\n        return wasmImports;\\n    };\\n\\n    const createCommonsBindings = (rawModule, engineData) => ({\\n        getArray: {\\n            type: 'proxy',\\n            value: (arrayName) => {\\n                const arrayNamePointer = lowerString(rawModule, arrayName);\\n                const arrayPointer = rawModule.commons_getArray(arrayNamePointer);\\n                return readTypedArray(rawModule, engineData.arrayType, arrayPointer);\\n            },\\n        },\\n        setArray: {\\n            type: 'proxy',\\n            value: (arrayName, array) => {\\n                const stringPointer = lowerString(rawModule, arrayName);\\n                const { arrayPointer } = lowerFloatArray(rawModule, engineData.bitDepth, array);\\n                rawModule.commons_setArray(stringPointer, arrayPointer);\\n                updateWasmInOuts(rawModule, engineData);\\n            },\\n        },\\n    });\\n\\n    const createEngine = async (wasmBuffer) => {\\n        const { rawModule, engineData, forwardReferences } = await createRawModule(wasmBuffer);\\n        const engineBindings = await createBindings(rawModule, engineData, forwardReferences);\\n        return createModule(rawModule, engineBindings);\\n    };\\n    const createRawModule = async (wasmBuffer) => {\\n        const metadata = await readMetadata(wasmBuffer);\\n        const forwardReferences = { modules: {} };\\n        const wasmImports = {\\n            ...createFsImports(forwardReferences),\\n            ...outletListenersImports(forwardReferences, metadata),\\n        };\\n        const bitDepth = metadata.audioSettings.bitDepth;\\n        const arrayType = getFloatArrayType(bitDepth);\\n        const engineData = {\\n            metadata,\\n            wasmOutput: new arrayType(0),\\n            wasmInput: new arrayType(0),\\n            arrayType,\\n            bitDepth,\\n            blockSize: 0,\\n        };\\n        const wasmInstance = await instantiateWasmModule(wasmBuffer, {\\n            input: wasmImports,\\n        });\\n        const rawModule = wasmInstance.exports;\\n        return { rawModule, engineData, forwardReferences };\\n    };\\n    const createBindings = async (rawModule, engineData, forwardReferences) => {\\n        const commons = createModule(rawModule, createCommonsBindings(rawModule, engineData));\\n        const fs = createModule(rawModule, createFsBindings(rawModule, engineData));\\n        const inletCallers = createModule(rawModule, createInletCallersBindings(rawModule, engineData));\\n        const outletListeners = createModule(rawModule, createOutletListenersBindings(rawModule, engineData));\\n        forwardReferences.modules.fs = fs;\\n        forwardReferences.modules.outletListeners = outletListeners;\\n        forwardReferences.engineData = engineData;\\n        forwardReferences.rawModule = rawModule;\\n        return {\\n            ...createEngineLifecycleBindings(rawModule, engineData),\\n            metadata: { type: 'proxy', value: engineData.metadata },\\n            commons: { type: 'proxy', value: commons },\\n            fs: { type: 'proxy', value: fs },\\n            inletCallers: { type: 'proxy', value: inletCallers },\\n            outletListeners: { type: 'proxy', value: outletListeners },\\n        };\\n    };\\n\\n    exports.createBindings = createBindings;\\n    exports.createEngine = createEngine;\\n    exports.createRawModule = createRawModule;\\n\\n    return exports;\\n\\n})({});\\n//# sourceMappingURL=assemblyscript-wasm-bindings.iife.js.map\\n\";\n\n  var JavaScriptBindingsCode = \"var JavaScriptBindings = (function (exports) {\\n    'use strict';\\n\\n    const getFloatArrayType = (bitDepth) => bitDepth === 64 ? Float64Array : Float32Array;\\n    const createModule = (rawModule, bindings) => new Proxy({}, {\\n        get: (_, k) => {\\n            if (bindings.hasOwnProperty(k)) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                switch (bindingSpec.type) {\\n                    case 'raw':\\n                        if (k in rawModule) {\\n                            return rawModule[key];\\n                        }\\n                        else {\\n                            throw new Error(`Key ${String(key)} doesn't exist in raw module`);\\n                        }\\n                    case 'proxy':\\n                    case 'callback':\\n                        return bindingSpec.value;\\n                }\\n            }\\n            else {\\n                return undefined;\\n            }\\n        },\\n        set: (_, k, newValue) => {\\n            if (bindings.hasOwnProperty(String(k))) {\\n                const key = String(k);\\n                const bindingSpec = bindings[key];\\n                if (bindingSpec.type === 'callback') {\\n                    bindingSpec.value = newValue;\\n                }\\n                else {\\n                    throw new Error(`Binding key ${String(key)} is read-only`);\\n                }\\n            }\\n            else {\\n                throw new Error(`Key ${String(k)} is not defined in bindings`);\\n            }\\n            return true;\\n        },\\n    });\\n\\n    const createRawModule = (code) => new Function(`\\n        ${code}\\n        return exports\\n    `)();\\n    const createBindings = (rawModule) => ({\\n        fs: { type: 'proxy', value: createFsModule(rawModule) },\\n        metadata: { type: 'raw' },\\n        configure: { type: 'raw' },\\n        loop: { type: 'raw' },\\n        inletCallers: { type: 'raw' },\\n        outletListeners: { type: 'raw' },\\n        commons: {\\n            type: 'proxy',\\n            value: createCommonsModule(rawModule, rawModule.metadata.audioSettings.bitDepth),\\n        },\\n    });\\n    const createEngine = (code) => {\\n        const rawModule = createRawModule(code);\\n        return createModule(rawModule, createBindings(rawModule));\\n    };\\n    const createFsModule = (rawModule) => {\\n        const fs = createModule(rawModule, {\\n            onReadSoundFile: { type: 'callback', value: () => undefined },\\n            onWriteSoundFile: { type: 'callback', value: () => undefined },\\n            onOpenSoundReadStream: { type: 'callback', value: () => undefined },\\n            onOpenSoundWriteStream: { type: 'callback', value: () => undefined },\\n            onSoundStreamData: { type: 'callback', value: () => undefined },\\n            onCloseSoundStream: { type: 'callback', value: () => undefined },\\n            sendReadSoundFileResponse: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onReadSoundFileResponse,\\n            },\\n            sendWriteSoundFileResponse: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onWriteSoundFileResponse,\\n            },\\n            sendSoundStreamData: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onSoundStreamData,\\n            },\\n            closeSoundStream: {\\n                type: 'proxy',\\n                value: rawModule.x_fs_onCloseSoundStream,\\n            },\\n        });\\n        rawModule.i_fs_openSoundWriteStream = (...args) => fs.onOpenSoundWriteStream(...args);\\n        rawModule.i_fs_sendSoundStreamData = (...args) => fs.onSoundStreamData(...args);\\n        rawModule.i_fs_openSoundReadStream = (...args) => fs.onOpenSoundReadStream(...args);\\n        rawModule.i_fs_closeSoundStream = (...args) => fs.onCloseSoundStream(...args);\\n        rawModule.i_fs_writeSoundFile = (...args) => fs.onWriteSoundFile(...args);\\n        rawModule.i_fs_readSoundFile = (...args) => fs.onReadSoundFile(...args);\\n        return fs;\\n    };\\n    const createCommonsModule = (rawModule, bitDepth) => {\\n        const floatArrayType = getFloatArrayType(bitDepth);\\n        return createModule(rawModule, {\\n            getArray: { type: 'proxy', value: rawModule.commons_getArray },\\n            setArray: {\\n                type: 'proxy',\\n                value: (arrayName, array) => rawModule.commons_setArray(arrayName, new floatArrayType(array)),\\n            },\\n        });\\n    };\\n\\n    exports.createBindings = createBindings;\\n    exports.createEngine = createEngine;\\n    exports.createRawModule = createRawModule;\\n\\n    return exports;\\n\\n})({});\\n//# sourceMappingURL=javascript-bindings.iife.js.map\\n\";\n\n  var fetchRetry$1 = function (fetch, defaults) {\n    defaults = defaults || {};\n    if (typeof fetch !== 'function') {\n      throw new ArgumentError('fetch must be a function');\n    }\n\n    if (typeof defaults !== 'object') {\n      throw new ArgumentError('defaults must be an object');\n    }\n\n    if (defaults.retries !== undefined && !isPositiveInteger(defaults.retries)) {\n      throw new ArgumentError('retries must be a positive integer');\n    }\n\n    if (defaults.retryDelay !== undefined && !isPositiveInteger(defaults.retryDelay) && typeof defaults.retryDelay !== 'function') {\n      throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');\n    }\n\n    if (defaults.retryOn !== undefined && !Array.isArray(defaults.retryOn) && typeof defaults.retryOn !== 'function') {\n      throw new ArgumentError('retryOn property expects an array or function');\n    }\n\n    var baseDefaults = {\n      retries: 3,\n      retryDelay: 1000,\n      retryOn: [],\n    };\n\n    defaults = Object.assign(baseDefaults, defaults);\n\n    return function fetchRetry(input, init) {\n      var retries = defaults.retries;\n      var retryDelay = defaults.retryDelay;\n      var retryOn = defaults.retryOn;\n\n      if (init && init.retries !== undefined) {\n        if (isPositiveInteger(init.retries)) {\n          retries = init.retries;\n        } else {\n          throw new ArgumentError('retries must be a positive integer');\n        }\n      }\n\n      if (init && init.retryDelay !== undefined) {\n        if (isPositiveInteger(init.retryDelay) || (typeof init.retryDelay === 'function')) {\n          retryDelay = init.retryDelay;\n        } else {\n          throw new ArgumentError('retryDelay must be a positive integer or a function returning a positive integer');\n        }\n      }\n\n      if (init && init.retryOn) {\n        if (Array.isArray(init.retryOn) || (typeof init.retryOn === 'function')) {\n          retryOn = init.retryOn;\n        } else {\n          throw new ArgumentError('retryOn property expects an array or function');\n        }\n      }\n\n      // eslint-disable-next-line no-undef\n      return new Promise(function (resolve, reject) {\n        var wrappedFetch = function (attempt) {\n          // As of node 18, this is no longer needed since node comes with native support for fetch:\n          /* istanbul ignore next */\n          var _input =\n            typeof Request !== 'undefined' && input instanceof Request\n              ? input.clone()\n              : input;\n          fetch(_input, init)\n            .then(function (response) {\n              if (Array.isArray(retryOn) && retryOn.indexOf(response.status) === -1) {\n                resolve(response);\n              } else if (typeof retryOn === 'function') {\n                try {\n                  // eslint-disable-next-line no-undef\n                  return Promise.resolve(retryOn(attempt, null, response))\n                    .then(function (retryOnResponse) {\n                      if(retryOnResponse) {\n                        retry(attempt, null, response);\n                      } else {\n                        resolve(response);\n                      }\n                    }).catch(reject);\n                } catch (error) {\n                  reject(error);\n                }\n              } else {\n                if (attempt < retries) {\n                  retry(attempt, null, response);\n                } else {\n                  resolve(response);\n                }\n              }\n            })\n            .catch(function (error) {\n              if (typeof retryOn === 'function') {\n                try {\n                  // eslint-disable-next-line no-undef\n                  Promise.resolve(retryOn(attempt, error, null))\n                    .then(function (retryOnResponse) {\n                      if(retryOnResponse) {\n                        retry(attempt, error, null);\n                      } else {\n                        reject(error);\n                      }\n                    })\n                    .catch(function(error) {\n                      reject(error);\n                    });\n                } catch(error) {\n                  reject(error);\n                }\n              } else if (attempt < retries) {\n                retry(attempt, error, null);\n              } else {\n                reject(error);\n              }\n            });\n        };\n\n        function retry(attempt, error, response) {\n          var delay = (typeof retryDelay === 'function') ?\n            retryDelay(attempt, error, response) : retryDelay;\n          setTimeout(function () {\n            wrappedFetch(++attempt);\n          }, delay);\n        }\n\n        wrappedFetch(0);\n      });\n    };\n  };\n\n  function isPositiveInteger(value) {\n    return Number.isInteger(value) && value >= 0;\n  }\n\n  function ArgumentError(message) {\n    this.name = 'ArgumentError';\n    this.message = message;\n  }\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const fetchRetry = fetchRetry$1(fetch);\n  /**\n   * Note : the audio worklet feature is available only in secure context.\n   * This function will fail when used in insecure context (non-https, etc ...)\n   * @see https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet\n   */\n  const addModule = async (context, processorCode) => {\n      const blob = new Blob([processorCode], { type: 'text/javascript' });\n      const workletProcessorUrl = URL.createObjectURL(blob);\n      return context.audioWorklet.addModule(workletProcessorUrl);\n  };\n  // TODO : testing\n  const fetchFile = async (url) => {\n      let response;\n      try {\n          response = await fetchRetry(url, { retries: 3 });\n      }\n      catch (err) {\n          throw new FileError(response.status, err.toString());\n      }\n      if (!response.ok) {\n          const responseText = await response.text();\n          throw new FileError(response.status, responseText);\n      }\n      return response.arrayBuffer();\n  };\n  const audioBufferToArray = (audioBuffer) => {\n      const sound = [];\n      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {\n          sound.push(audioBuffer.getChannelData(channel));\n      }\n      return sound;\n  };\n  // TODO : testing\n  const fixSoundChannelCount = (sound, targetChannelCount) => {\n      if (sound.length === 0) {\n          throw new Error(`Received empty sound`);\n      }\n      const floatArrayType = sound[0].constructor;\n      const frameCount = sound[0].length;\n      const fixedSound = sound.slice(0, targetChannelCount);\n      while (sound.length < targetChannelCount) {\n          fixedSound.push(new floatArrayType(frameCount));\n      }\n      return fixedSound;\n  };\n  const urlDirName = (patchUrl) => {\n      if (isExternalUrl(patchUrl)) {\n          return new URL('.', patchUrl).href;\n      }\n      else {\n          return new URL('.', new URL(patchUrl, document.URL).href).href;\n      }\n  };\n  const resolveRelativeUrl = (rootUrl, relativeUrl) => {\n      return new URL(relativeUrl, rootUrl).href;\n  };\n  // REF : https://stackoverflow.com/questions/10687099/how-to-test-if-a-url-string-is-absolute-or-relative\n  const isExternalUrl = (urlString) => {\n      try {\n          const url = new URL(urlString);\n          if (url.origin !== new URL(document.URL, document.baseURI).origin) {\n              return true;\n          }\n      }\n      catch (_e) {\n          new URL(urlString, window.document.baseURI);\n      }\n      return false;\n  };\n  class FileError extends Error {\n      constructor(status, msg) {\n          super(`Error ${status} : ${msg}`);\n      }\n  }\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  // Concatenate WorkletProcessor code with the Wasm bindings it needs\n  const WebPdWorkletProcessorCode = AssemblyScriptWasmBindingsCode + ';\\n' + JavaScriptBindingsCode + ';\\n' + _WebPdWorkletProcessorCode;\n  const registerWebPdWorkletNode = (context) => {\n      return addModule(context, WebPdWorkletProcessorCode);\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const FILES = {};\n  const STREAMS = {};\n  class FakeStream {\n      constructor(url, sound) {\n          this.url = url;\n          this.sound = sound;\n          this.frameCount = sound[0].length;\n          this.readPosition = 0;\n      }\n  }\n  const read = async (url) => {\n      if (FILES[url]) {\n          return FILES[url];\n      }\n      const arrayBuffer = await fetchFile(url);\n      return {\n          type: 'binary',\n          data: arrayBuffer,\n      };\n  };\n  // TODO : testing\n  const readSound = async (url, context) => {\n      let fakeFile = FILES[url] || (await read(url));\n      switch (fakeFile.type) {\n          case 'binary':\n              const audioBuffer = await context.decodeAudioData(fakeFile.data);\n              return audioBufferToArray(audioBuffer);\n          case 'sound':\n              // We copy the data here o it can be manipulated freely by the host.\n              // e.g. if the buffer is sent as transferrable to the node we don't want the original to be transferred.\n              return fakeFile.data.map((array) => array.slice());\n      }\n  };\n  const writeSound = async (sound, url) => {\n      FILES[url] = {\n          type: 'sound',\n          data: sound,\n      };\n  };\n  const readStreamSound = async (operationId, url, channelCount, context) => {\n      const sound = await readSound(url, context);\n      STREAMS[operationId] = new FakeStream(url, fixSoundChannelCount(sound, channelCount));\n      return STREAMS[operationId];\n  };\n  const writeStreamSound = async (operationId, url, channelCount) => {\n      const emptySound = [];\n      for (let channel = 0; channel < channelCount; channel++) {\n          emptySound.push(new Float32Array(0));\n      }\n      STREAMS[operationId] = new FakeStream(url, emptySound);\n      FILES[url] = {\n          type: 'sound',\n          data: emptySound,\n      };\n      return STREAMS[operationId];\n  };\n  const getStream = (operationId) => {\n      return STREAMS[operationId];\n  };\n  const killStream = (operationId) => {\n      console.log('KILL STREAM', operationId);\n      delete STREAMS[operationId];\n  };\n  const pullBlock = (stream, frameCount) => {\n      const block = stream.sound.map((array) => array.slice(stream.readPosition, stream.readPosition + frameCount));\n      stream.readPosition += frameCount;\n      return block;\n  };\n  const pushBlock = (stream, block) => {\n      stream.sound = stream.sound.map((channelData, channel) => {\n          const concatenated = new Float32Array(channelData.length + block[channel].length);\n          concatenated.set(channelData);\n          concatenated.set(block[channel], channelData.length);\n          return concatenated;\n      });\n      stream.frameCount = stream.sound[0].length;\n      FILES[stream.url].data = stream.sound;\n  };\n  var fakeFs = {\n      writeSound,\n      readSound,\n      readStreamSound,\n      writeStreamSound,\n      pullBlock,\n      pushBlock,\n  };\n\n  var closeSoundStream = async (node, payload, settings) => {\n      if (payload.functionName === 'onCloseSoundStream') {\n          killStream(payload.arguments[0]);\n      }\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const FS_OPERATION_SUCCESS = 0;\n  const FS_OPERATION_FAILURE = 1;\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var readSoundFile = async (node, payload, settings) => {\n      if (payload.functionName === 'onReadSoundFile') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          let operationStatus = FS_OPERATION_SUCCESS;\n          let sound = null;\n          try {\n              sound = await fakeFs.readSound(absoluteUrl, node.context);\n          }\n          catch (err) {\n              operationStatus = FS_OPERATION_FAILURE;\n              console.error(err);\n          }\n          if (sound) {\n              sound = fixSoundChannelCount(sound, channelCount);\n          }\n          node.port.postMessage({\n              type: 'fs',\n              payload: {\n                  functionName: 'sendReadSoundFileResponse',\n                  arguments: [operationId, operationStatus, sound],\n              },\n          }, \n          // Add as transferables to avoid copies between threads\n          sound.map((array) => array.buffer));\n      }\n      else if (payload.functionName === 'sendReadSoundFileResponse_return') ;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  const BUFFER_HIGH = 10 * 44100;\n  const BUFFER_LOW = BUFFER_HIGH / 2;\n  var readSoundStream = async (node, payload, settings) => {\n      if (payload.functionName === 'onOpenSoundReadStream') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          try {\n              const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n              await fakeFs.readStreamSound(operationId, absoluteUrl, channelCount, node.context);\n          }\n          catch (err) {\n              console.error(err);\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'closeSoundStream',\n                      arguments: [operationId, FS_OPERATION_FAILURE],\n                  },\n              });\n              return;\n          }\n          streamLoop(node, operationId, 0);\n      }\n      else if (payload.functionName === 'sendSoundStreamData_return') {\n          const stream = getStream(payload.operationId);\n          if (!stream) {\n              throw new Error(`unknown stream ${payload.operationId}`);\n          }\n          streamLoop(node, payload.operationId, payload.returned);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          const stream = getStream(payload.operationId);\n          if (stream) {\n              killStream(payload.operationId);\n          }\n      }\n  };\n  const streamLoop = (node, operationId, framesAvailableInEngine) => {\n      const sampleRate = node.context.sampleRate;\n      const secondsToThreshold = Math.max(framesAvailableInEngine - BUFFER_LOW, 10) / sampleRate;\n      const framesToSend = BUFFER_HIGH -\n          (framesAvailableInEngine - secondsToThreshold * sampleRate);\n      setTimeout(() => {\n          const stream = getStream(operationId);\n          if (!stream) {\n              console.log(`stream ${operationId} was maybe closed`);\n              return;\n          }\n          if (stream.readPosition < stream.frameCount) {\n              const block = pullBlock(stream, framesToSend);\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'sendSoundStreamData',\n                      arguments: [operationId, block],\n                  },\n              }, \n              // Add as transferables to avoid copies between threads\n              block.map((array) => array.buffer));\n          }\n          else {\n              node.port.postMessage({\n                  type: 'fs',\n                  payload: {\n                      functionName: 'closeSoundStream',\n                      arguments: [operationId, FS_OPERATION_SUCCESS],\n                  },\n              });\n          }\n      }, secondsToThreshold * 1000);\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var writeSoundFile = async (node, payload, settings) => {\n      if (payload.functionName === 'onWriteSoundFile') {\n          const [operationId, sound, url, [channelCount]] = payload.arguments;\n          const fixedSound = fixSoundChannelCount(sound, channelCount);\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          await fakeFs.writeSound(fixedSound, absoluteUrl);\n          let operationStatus = FS_OPERATION_SUCCESS;\n          node.port.postMessage({\n              type: 'fs',\n              payload: {\n                  functionName: 'sendWriteSoundFileResponse',\n                  arguments: [operationId, operationStatus],\n              },\n          });\n      }\n      else if (payload.functionName === 'sendWriteSoundFileResponse_return') ;\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  var writeSoundStream = async (_, payload, settings) => {\n      if (payload.functionName === 'onOpenSoundWriteStream') {\n          const [operationId, url, [channelCount]] = payload.arguments;\n          const absoluteUrl = resolveRelativeUrl(settings.rootUrl, url);\n          await fakeFs.writeStreamSound(operationId, absoluteUrl, channelCount);\n      }\n      else if (payload.functionName === 'onSoundStreamData') {\n          const [operationId, sound] = payload.arguments;\n          const stream = getStream(operationId);\n          if (!stream) {\n              throw new Error(`unknown stream ${operationId}`);\n          }\n          pushBlock(stream, sound);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          const stream = getStream(payload.operationId);\n          if (stream) {\n              killStream(payload.operationId);\n          }\n      }\n  };\n\n  var index = async (node, messageEvent, settings) => {\n      const message = messageEvent.data;\n      const { payload } = message;\n      if (message.type !== 'fs') {\n          throw new Error(`Unknown message type from node ${message.type}`);\n      }\n      if (payload.functionName === 'onReadSoundFile' ||\n          payload.functionName === 'sendReadSoundFileResponse_return') {\n          readSoundFile(node, payload, settings);\n      }\n      else if (payload.functionName === 'onOpenSoundReadStream' ||\n          payload.functionName === 'sendSoundStreamData_return') {\n          readSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'onWriteSoundFile' ||\n          payload.functionName === 'sendWriteSoundFileResponse_return') {\n          writeSoundFile(node, payload, settings);\n      }\n      else if (payload.functionName === 'onOpenSoundWriteStream' ||\n          payload.functionName === 'onSoundStreamData') {\n          writeSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'closeSoundStream_return') {\n          writeSoundStream(node, payload, settings);\n          readSoundStream(node, payload, settings);\n      }\n      else if (payload.functionName === 'onCloseSoundStream') {\n          closeSoundStream(node, payload);\n      }\n      else {\n          throw new Error(`Unknown callback ${payload.functionName}`);\n      }\n  };\n\n  /*\n   * Copyright (c) 2022-2023 Sébastien Piquemal <sebpiq@protonmail.com>, Chris McCormick.\n   *\n   * This file is part of WebPd\n   * (see https://github.com/sebpiq/WebPd).\n   *\n   * This program is free software: you can redistribute it and/or modify\n   * it under the terms of the GNU Lesser General Public License as published by\n   * the Free Software Foundation, either version 3 of the License, or\n   * (at your option) any later version.\n   *\n   * This program is distributed in the hope that it will be useful,\n   * but WITHOUT ANY WARRANTY; without even the implied warranty of\n   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n   * GNU Lesser General Public License for more details.\n   *\n   * You should have received a copy of the GNU Lesser General Public License\n   * along with this program. If not, see <http://www.gnu.org/licenses/>.\n   */\n  // TODO : manage transferables\n  class WebPdWorkletNode extends AudioWorkletNode {\n      constructor(context) {\n          super(context, 'webpd-node', {\n              numberOfOutputs: 1,\n              outputChannelCount: [2],\n          });\n      }\n      destroy() {\n          this.port.postMessage({\n              type: 'destroy',\n              payload: {},\n          });\n      }\n  }\n\n  exports.WebPdWorkletNode = WebPdWorkletNode;\n  exports.fsWeb = index;\n  exports.registerWebPdWorkletNode = registerWebPdWorkletNode;\n  exports.urlDirName = urlDirName;\n\n  return exports;\n\n})({});\n";

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
const stateVariables$X = {};
// ------------------------------- node builder ------------------------------ //
const builder$V = {
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$l = ({ node, ins, outs }) => `
    ${outs.$0} = ${Object.keys(node.inlets)
    .map((inletId) => ins[inletId])
    .join(' + ')}
`;
// ------------------------------------------------------------------- //
const nodeImplementation$N = { generateLoop: generateLoop$l, stateVariables: stateVariables$X };

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
const coldFloatInlet = (messageName, storageName) => {
    return `if (msg_isMatching(${messageName}, [MSG_FLOAT_TOKEN])) {
        ${storageName} = msg_readFloatToken(${messageName}, 0)
        return
    }`;
};
const coldStringInlet = (messageName, storageName) => {
    return `if (msg_isMatching(${messageName}, [MSG_STRING_TOKEN])) {
        ${storageName} = msg_readStringToken(${messageName}, 0)
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
const stateVariables$W = {
    currentValue: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$U = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$F = ({ node: { args }, state, macros: { Var } }) => `
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$k = ({ outs, state }) => `
    ${outs.$0} = ${state.currentValue}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$H = ({ state, globs }) => ({
    '0': coldFloatInlet(globs.m, state.currentValue),
});
// ------------------------------------------------------------------- //
const nodeImplementation$M = {
    generateLoop: generateLoop$k,
    stateVariables: stateVariables$W,
    generateMessageReceivers: generateMessageReceivers$H,
    generateDeclarations: generateDeclarations$F,
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
const stateVariables$V = {};
// ------------------------------- node builder ------------------------------ //
const builder$T = {
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$G = ({ globs, snds }) => ({
    '0': `
    if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${snds.$0}(m)
        return
    } else {
        ${snds.$1}(m)
        return
    }`,
});
// ------------------------------------------------------------------- //
const nodeImplementation$L = {
    stateVariables: stateVariables$V,
    generateMessageReceivers: generateMessageReceivers$G,
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
            ...builder$V.build(mixerNodeArgs),
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
            ...builder$U.build(sigNodeArgs),
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
            ...builder$T.build(routeMsgArgs),
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
    if (!artefacts.compiledJs && !artefacts.wasm) {
        throw new Error(`Needs at least compiledJs or wasm to run`);
    }
    const compiledPatchFilename = artefacts.compiledJs
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
                await WebPdRuntime.registerWebPdWorkletNode(audioContext)

                // Fetch the patch code
                response = await fetch('${compiledPatchFilename}')
                patch = await ${artefacts.compiledJs ?
            'response.text()' : 'response.arrayBuffer()'}

                // Get audio input
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
                const sourceNode = audioContext.createMediaStreamSource(stream)
                webpdNode = new WebPdRuntime.WebPdWorkletNode(audioContext)
                sourceNode.connect(webpdNode)
                webpdNode.connect(audioContext.destination)

                // Setup filesystem management
                webpdNode.port.onmessage = (message) => 
                    WebPdRuntime.fsWeb(webpdNode, message, { 
                        rootUrl: WebPdRuntime.urlDirName(location.pathname) 
                    })

                // Send code to the worklet
                ${artefacts.compiledJs ? `
                webpdNode.port.postMessage({
                    type: 'code:JS',
                    payload: {
                        jsCode: patch,
                    },
                })` : `
                webpdNode.port.postMessage({
                    type: 'code:WASM',
                    payload: {
                        wasmBuffer: patch,
                    },
                })`}

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
                    type: 'inletCaller',
                    payload: {
                        nodeId,
                        portletId,
                        message,
                    },
                })
            }
            
            // Here is an index of objects IDs to which you can send messages, with hints so you can find the right ID.
            // Note that by default only GUI objects (bangs, sliders, etc ...) are available.${artefacts.dspGraph
            && artefacts.dspGraph.inletCallerSpecs
            && Object.keys(artefacts.dspGraph.inletCallerSpecs).length ?
            Object.entries(artefacts.dspGraph.inletCallerSpecs)
                .flatMap(([nodeId, portletIds]) => portletIds.map(portletId => {
                const pdNode = resolvePdNodeFromGraphNodeId(artefacts.pdJson, nodeId);
                if (!pdNode) {
                    throw new Error(`Failed to resolve pd node`);
                }
                return `
            //  - nodeId "${nodeId}" portletId "${portletId}"
            //      * type "${pdNode.type}"
            //      * args ${JSON.stringify(pdNode.args)}`
                    + (pdNode.layout.label ? `
            //      * label "${pdNode.layout.label}"` : '');
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
    if (artefacts.compiledJs) {
        generatedApp[compiledPatchFilename] = artefacts.compiledJs;
    }
    else {
        generatedApp[compiledPatchFilename] = artefacts.wasm;
    }
    return generatedApp;
};
const resolvePdNodeFromGraphNodeId = (pd, graphNodeId) => {
    let node = null;
    Object.entries(pd.patches).some(([patchId, patch]) => {
        node = Object.values(patch.nodes).find((node) => buildGraphNodeId(patchId, node.id) === graphNodeId);
        return !!node;
    });
    return node;
};

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
const collectGuiControlsInletCallerSpecs = (controls, graph) => {
    const inletCallerSpecs = {};
    traverseGuiControls(controls, (control) => {
        const nodeId = buildGraphNodeId(control.patch.id, control.node.id);
        const portletId = '0';
        // Important because some nodes are deleted at dsp-graph compilation.
        // and if we declare inletCallerSpec for them it will cause error.
        // TODO : maybe the compiler should detect this instead of doing it here ?
        if (!graph[nodeId]) {
            return;
        }
        inletCallerSpecs[nodeId] = inletCallerSpecs[nodeId] || [];
        inletCallerSpecs[nodeId].push(portletId);
    });
    return inletCallerSpecs;
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
const createInletCallersBindings = (rawModule, engineData) => mapObject(engineData.metadata.compilation.inletCallerSpecs, (inletIds, nodeId) => ({
    type: 'proxy',
    value: mapArray(inletIds, (inletId) => [
        inletId,
        (message) => {
            const messagePointer = lowerMessage(rawModule, message);
            rawModule[engineData.metadata.compilation.codeVariableNames
                .inletCallers[nodeId][inletId]](messagePointer);
        },
    ]),
}));
const createOutletListenersBindings = (_, engineData) => mapObject(engineData.metadata.compilation.outletListenerSpecs, (outletIds) => ({
    type: 'proxy',
    value: mapArray(outletIds, (outletId) => [
        outletId,
        {
            onMessage: () => undefined,
        },
    ]),
}));
const outletListenersImports = (forwardReferences, metadata) => {
    const wasmImports = {};
    const { codeVariableNames } = metadata.compilation;
    Object.entries(metadata.compilation.outletListenerSpecs).forEach(([nodeId, outletIds]) => {
        outletIds.forEach((outletId) => {
            const listenerName = codeVariableNames.outletListeners[nodeId][outletId];
            wasmImports[listenerName] = (messagePointer) => {
                const message = liftMessage(forwardReferences.rawModule, messagePointer);
                forwardReferences.modules.outletListeners[nodeId][outletId].onMessage(message);
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
const createEngine$1 = async (wasmBuffer) => {
    const { rawModule, engineData, forwardReferences } = await createRawModule(wasmBuffer);
    const engineBindings = await createBindings(rawModule, engineData, forwardReferences);
    return createModule(rawModule, engineBindings);
};
const createRawModule = async (wasmBuffer) => {
    // We need to read metadata before everything, because it is used by other initialization functions
    const metadata = await readMetadata(wasmBuffer);
    const forwardReferences = { modules: {} };
    const wasmImports = {
        ...createFsImports(forwardReferences),
        ...outletListenersImports(forwardReferences, metadata),
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
const createBindings = async (rawModule, engineData, forwardReferences) => {
    // Create bindings for core modules
    const commons = createModule(rawModule, createCommonsBindings(rawModule, engineData));
    const fs = createModule(rawModule, createFsBindings(rawModule, engineData));
    const inletCallers = createModule(rawModule, createInletCallersBindings(rawModule, engineData));
    const outletListeners = createModule(rawModule, createOutletListenersBindings(rawModule, engineData));
    // Update forward refs for use in Wasm imports
    forwardReferences.modules.fs = fs;
    forwardReferences.modules.outletListeners = outletListeners;
    forwardReferences.engineData = engineData;
    forwardReferences.rawModule = rawModule;
    // Build the full module
    return {
        ...createEngineLifecycleBindings(rawModule, engineData),
        metadata: { type: 'proxy', value: engineData.metadata },
        commons: { type: 'proxy', value: commons },
        fs: { type: 'proxy', value: fs },
        inletCallers: { type: 'proxy', value: inletCallers },
        outletListeners: { type: 'proxy', value: outletListeners },
    };
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
    if (!artefacts.wasm && !artefacts.compiledJs) {
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
            return new Function(`
                ${getArtefact(artefacts, 'compiledJs')}
                return exports
            `)();
        case 'assemblyscript':
            return createEngine$1(getArtefact(artefacts, 'wasm'));
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
const stateVariablesTabBase = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    funcSetArrayName: 1,
};
const translateArgsTabBase = (pdNode) => ({
    arrayName: assertOptionalString(pdNode.args[0]) || '',
});
const declareTabBase = ({ state, node, macros: { Func, Var } }) => `
    let ${Var(state.array, 'FloatArray')} = createFloatArray(0)
    let ${Var(state.arrayName, 'string')} = "${node.args.arrayName}"
    let ${Var(state.arrayChangesSubscription, 'SkedId')} = SKED_ID_NULL

    function ${state.funcSetArrayName} ${Func([
    Var('arrayName', 'string')
], 'void')} {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
        })
    }

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`;
const prepareIndexCode = (value, { state }) => `toInt(Math.min(
        Math.max(
            0, Math.floor(${value})
        ), toFloat(${state.array}.length - 1)
    ))`;
const messageSetArrayCode = ({ globs, state, }) => `else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))
        return

    }`;

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
const stateVariables$U = {
    ...stateVariablesTabBase,
    index: 1,
    funcSetIndex: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$S = {
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
const generateDeclarations$E = (context) => {
    const { state, macros: { Var, Func } } = context;
    return `
        let ${Var(state.index, 'Int')} = 0
        ${declareTabBase(context)}

        function ${state.funcSetIndex} ${Func([
        Var('index', 'Float')
    ], 'void')} {
            ${state.index} = ${prepareIndexCode('index', context)}
        }
    `;
};
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$F = (context) => {
    const { state, globs } = context;
    return {
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {        
            if (${state.array}.length === 0) {
                return

            } else {
                ${state.array}[${state.index}] = msg_readFloatToken(${globs.m}, 0)
                return
            }
            return 

        } ${messageSetArrayCode(context)}
        `,
        '1': coldFloatInletWithSetter(globs.m, state.funcSetIndex)
    };
};
// ------------------------------------------------------------------- //
const nodeImplementation$K = {
    generateDeclarations: generateDeclarations$E,
    generateMessageReceivers: generateMessageReceivers$F,
    stateVariables: stateVariables$U,
    dependencies: [commonsWaitEngineConfigure, commonsArrays]
};

const EMPTY_BUS_NAME = 'empty';
const stateVariables$T = {
    value: 1,
    funcPrepareStoreValue: 1,
    funcPrepareStoreValueBang: 1,
    funcSetReceiveBusName: 1,
    sendBusName: 1,
    receiveBusName: 1,
    funcMessageReceiver: 1,
};
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
const declareControlSendReceive = ({ node, state, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.receiveBusName, 'string')} = "${node.args.receiveBusName}"
    let ${Var(state.sendBusName, 'string')} = "${node.args.sendBusName}"

    function ${state.funcSetReceiveBusName} ${Func([
    Var('busName', 'string')
], 'void')} {
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusUnsubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
        ${state.receiveBusName} = busName
        if (${state.receiveBusName} !== "${EMPTY_BUS_NAME}") {
            msgBusSubscribe(${state.receiveBusName}, ${state.funcMessageReceiver})
        }
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetReceiveBusName}("${args.receiveBusName}")
    })
`;
const messageSetSendReceive = ({ globs, state }) => `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'receive'
    ) {
        ${state.funcSetReceiveBusName}(msg_readStringToken(${globs.m}, 1))
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'send'
    ) {
        ${state.sendBusName} = msg_readStringToken(${globs.m}, 1)
        return
    }
`;

// TODO : unit tests
const signalBuses = ({ macros: { Var, Func } }) => `
    const ${Var('SIGNAL_BUSES', 'Map<string, Float>')} = new Map()
    SIGNAL_BUSES.set('', 0)

    function addAssignSignalBus ${Func([Var('busName', 'string'), Var('value', 'Float')], 'Float')} {
        const ${Var('newValue', 'Float')} = SIGNAL_BUSES.get(busName) + value
        SIGNAL_BUSES.set(
            busName,
            newValue,
        )
        return newValue
    }

    function setSignalBus ${Func([
    Var('busName', 'string'),
    Var('value', 'Float'),
], 'void')} {
        SIGNAL_BUSES.set(
            busName,
            value,
        )
    }

    function resetSignalBus ${Func([
    Var('busName', 'string')
], 'void')} {
        SIGNAL_BUSES.set(busName, 0)
    }

    function readSignalBus ${Func([Var('busName', 'string')], 'Float')} {
        return SIGNAL_BUSES.get(busName)
    }
`;
// TODO : unit tests
const messageBuses = {
    codeGenerator: ({ macros: { Var, Func } }) => `
    const ${Var('MSG_BUSES', 'Map<string, Array<(m: Message) => void>>')} = new Map()

    function msgBusPublish ${Func([Var('busName', 'string'), Var('message', 'Message')], 'void')} {
        let ${Var('i', 'Int')} = 0
        const ${Var('callbacks', 'Array<(m: Message) => void>')} = MSG_BUSES.has(busName) ? MSG_BUSES.get(busName): []
        for (i = 0; i < callbacks.length; i++) {
            callbacks[i](message)
        }
    }

    function msgBusSubscribe ${Func([Var('busName', 'string'), Var('callback', '(m: Message) => void')], 'void')} {
        if (!MSG_BUSES.has(busName)) {
            MSG_BUSES.set(busName, [])
        }
        MSG_BUSES.get(busName).push(callback)
    }

    function msgBusUnsubscribe ${Func([Var('busName', 'string'), Var('callback', '(m: Message) => void')], 'void')} {
        if (!MSG_BUSES.has(busName)) {
            return
        }
        const ${Var('callbacks', 'Array<(m: Message) => void>')} = MSG_BUSES.get(busName)
        const ${Var('found', 'Int')} = callbacks.indexOf(callback) !== -1
        if (found !== -1) {
            callbacks.splice(found, 1)
        }
    }
`,
    dependencies: [msg],
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
    codeGenerator: ({ macros: { Func, Var } }) => `
    function msg_isBang ${Func([Var('message', 'Message')], 'boolean')} {
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

    function msg_emptyToBang ${Func([Var('message', 'Message')], 'Message')} {
        if (msg_getLength(message) === 0) {
            return msg_bang()
        } else {
            return message
        }
    }
`,
    dependencies: [msg],
};
const msgUtils = {
    codeGenerator: ({ macros: { Func, Var } }) => `

    function msg_copyTemplate ${Func([Var('src', 'Message'), Var('start', 'Int'), Var('end', 'Int')], 'MessageTemplate')} {
        const ${Var('template', 'MessageTemplate')} = []
        for (let ${Var('i', 'Int')} = start; i < end; i++) {
            const ${Var('tokenType', 'Int')} = msg_getTokenType(src, i)
            template.push(tokenType)
            if (tokenType === MSG_STRING_TOKEN) {
                template.push(msg_readStringToken(src, i).length)
            }
        }
        return template
    }

    function msg_copyMessage ${Func([
        Var('src', 'Message'),
        Var('dest', 'Message'),
        Var('srcStart', 'Int'),
        Var('srcEnd', 'Int'),
        Var('destStart', 'Int'),
    ], 'void')} {
        let ${Var('i', 'Int')} = srcStart
        let ${Var('j', 'Int')} = destStart
        for (i, j; i < srcEnd; i++, j++) {
            if (msg_getTokenType(src, i) === MSG_STRING_TOKEN) {
                msg_writeStringToken(dest, j, msg_readStringToken(src, i))
            } else {
                msg_writeFloatToken(dest, j, msg_readFloatToken(src, i))
            }
        }
    }

    function msg_slice ${Func([Var('message', 'Message'), Var('start', 'Int'), Var('end', 'Int')], 'Message')} {
        if (msg_getLength(message) <= start) {
            throw new Error('message empty')
        }
        const ${Var('template', 'MessageTemplate')} = msg_copyTemplate(message, start, end)
        const ${Var('newMessage', 'Message')} = msg_create(template)
        msg_copyMessage(message, newMessage, start, end, 0)
        return newMessage
    }

    function msg_concat  ${Func([Var('message1', 'Message'), Var('message2', 'Message')], 'Message')} {
        const ${Var('newMessage', 'Message')} = msg_create(
            msg_copyTemplate(message1, 0, msg_getLength(message1))
                .concat(msg_copyTemplate(message2, 0, msg_getLength(message2))))
        msg_copyMessage(message1, newMessage, 0, msg_getLength(message1), 0)
        msg_copyMessage(message2, newMessage, 0, msg_getLength(message2), msg_getLength(message1))
        return newMessage
    }

    function msg_shift ${Func([Var('message', 'Message')], 'Message')} {
        switch (msg_getLength(message)) {
            case 0:
                throw new Error('message empty')
            case 1:
                return msg_create([])
            default:
                return msg_slice(message, 1, msg_getLength(message))
        }
    }
`,
    dependencies: [msg],
};
const stringMsgUtils = {
    codeGenerator: ({ macros: { Func, Var } }) => `
    function msg_isAction ${Func([Var('message', 'Message'), Var('action', 'string')], 'boolean')} {
        return msg_isMatching(message, [MSG_STRING_TOKEN])
            && msg_readStringToken(message, 0) === action
    }
`,
    dependencies: [msg],
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
const makeNodeImplementation$9 = ({ prepareStoreValue, prepareStoreValueBang, }) => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations = (context) => {
        const { node, state, snds, node: { id, args }, compilation: { codeVariableNames: { nodes } }, macros: { Var, Func } } = context;
        return `
            let ${Var(state.value, 'Float')} = ${node.args.initValue}

            ${renderIf(prepareStoreValue, () => `function ${state.funcPrepareStoreValue} ${Func([
            Var('value', 'Float')
        ], 'Float')} {
                    return ${prepareStoreValue(node.args)}
                }`)}

            ${renderIf(prepareStoreValueBang, () => `function ${state.funcPrepareStoreValueBang} ${Func([
            Var('value', 'Float')
        ], 'Float')} {
                    return ${prepareStoreValueBang(node.args)}
                }`)}

            function ${state.funcMessageReceiver} ${Func([
            Var('m', 'Message'),
        ], 'void')} {
                if (msg_isMatching(m, [MSG_FLOAT_TOKEN])) {
                    ${prepareStoreValue ?
            `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 0))`
            : `${state.value} = msg_readFloatToken(m, 0)`}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (msg_isBang(m)) {
                    ${renderIf(prepareStoreValueBang, () => `${state.value} = ${state.funcPrepareStoreValueBang}(${state.value})`)}
                    const ${Var('outMessage', 'Message')} = msg_floats([${state.value}])
                    ${nodes[id].snds.$0}(outMessage)
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, outMessage)
                    }

                } else if (
                    msg_isMatching(m, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN]) 
                    && msg_readStringToken(m, 0) === 'set'
                ) {
                    ${prepareStoreValue ?
            `${state.value} = ${state.funcPrepareStoreValue}(msg_readFloatToken(m, 1))`
            : `${state.value} = msg_readFloatToken(m, 1)`}
                }
            
                ${messageSetSendReceive(context)}
            }

            ${declareControlSendReceive(context)}

            ${renderIf(args.outputOnLoad, `commons_waitFrame(0, () => ${snds.$0}(msg_floats([${state.value}])))`)}
        `;
    };
    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers = (context) => {
        const { globs, state } = context;
        return {
            '0': `
                ${state.funcMessageReceiver}(${globs.m})
                return
            `
        };
    };
    return {
        generateMessageReceivers,
        generateDeclarations,
        stateVariables: stateVariables$T,
        dependencies: [
            bangUtils,
            messageBuses,
            commonsWaitEngineConfigure,
            commonsWaitFrame,
        ],
    };
};
// ------------------------------------------------------------------- //
const nodeImplementations$b = {
    'tgl': makeNodeImplementation$9({
        prepareStoreValueBang: ({ maxValue }) => `value === 0 ? ${maxValue}: 0`
    }),
    'nbx': makeNodeImplementation$9({
        prepareStoreValue: ({ minValue, maxValue }) => `Math.min(Math.max(value,${minValue}),${maxValue})`
    }),
    'hsl': makeNodeImplementation$9({}),
    'hradio': makeNodeImplementation$9({}),
};
nodeImplementations$b['vsl'] = nodeImplementations$b['hsl'];
nodeImplementations$b['vradio'] = nodeImplementations$b['hradio'];
const builders$b = {
    'tgl': builderWithoutMin,
    'nbx': builderWithInit,
    'hsl': builderWithInit,
    'vsl': builderWithInit,
    'hradio': builderWithoutMin,
    'vradio': builderWithoutMin,
};

const MAX_MIDI_FREQ = Math.pow(2, (1499 - 69) / 12) * 440;
// Also possible to use optimized version, but gives approximate results : 8.17579891564 * Math.exp(0.0577622650 * value)
const mtof = ({ macros: { Func, Var } }) => `
    function mtof ${Func([
    Var('value', 'Float'),
], 'Float')} {
        return value <= -1500 ? 0: (value > 1499 ? ${MAX_MIDI_FREQ} : Math.pow(2, (value - 69) / 12) * 440)
    }
`;
// optimized version of formula : 12 * Math.log(freq / 440) / Math.LN2 + 69
// which is the same as : Math.log(freq / mtof(0)) * (12 / Math.LN2) 
// which is the same as : Math.log(freq / 8.1757989156) * (12 / Math.LN2) 
const ftom = ({ macros: { Func, Var } }) => `
    function ftom ${Func([
    Var('value', 'Float'),
], 'Float')} {
        return value <= 0 ? -1500: 12 * Math.log(value / 440) / Math.LN2 + 69
    }
`;
// TODO : tests (see in binop)
const pow = ({ macros: { Func, Var } }) => `
    function pow ${Func([
    Var('leftOp', 'Float'),
    Var('rightOp', 'Float'),
], 'Float')} {
        return leftOp > 0 || (Math.round(rightOp) === rightOp) ? Math.pow(leftOp, rightOp): 0
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
const stateVariables$S = {
    leftOp: 1,
    rightOp: 1,
    funcSetRightOp: 1,
    funcSetLeftOp: 1,
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
            '0': { type: 'message', id: '0' },
            '1': { type: 'message', id: '1' },
        },
        outlets: {
            '0': { type: 'message', id: '0' },
        },
    }),
});
const makeNodeImplementation$8 = ({ generateOperation, dependencies = [], prepareLeftOp = 'value', prepareRightOp = 'value', }) => {
    // ------------------------------ generateDeclarations ------------------------------ //
    const generateDeclarations = ({ state, macros: { Var, Func }, node: { args }, }) => `
        let ${Var(state.leftOp, 'Float')} = 0
        let ${Var(state.rightOp, 'Float')} = 0

        const ${state.funcSetLeftOp} = ${Func([Var('value', 'Float')], 'void')} => {
            ${state.leftOp} = ${prepareLeftOp}
        }

        const ${state.funcSetRightOp} = ${Func([Var('value', 'Float')], 'void')} => {
            ${state.rightOp} = ${prepareRightOp}
        }

        ${state.funcSetLeftOp}(0)
        ${state.funcSetRightOp}(${args.value})
    `;
    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers = ({ state, globs, snds, }) => ({
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
        generateDeclarations,
        generateMessageReceivers,
        stateVariables: stateVariables$S,
        dependencies: [bangUtils, ...dependencies],
    };
};
// ------------------------------------------------------------------- //
const nodeImplementations$a = {
    '+': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} + ${state.rightOp}`,
    }),
    '-': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} - ${state.rightOp}`,
    }),
    '*': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} * ${state.rightOp}`,
    }),
    '/': makeNodeImplementation$8({
        generateOperation: (state) => `${state.rightOp} !== 0 ? ${state.leftOp} / ${state.rightOp}: 0`,
    }),
    'max': makeNodeImplementation$8({
        generateOperation: (state) => `Math.max(${state.leftOp}, ${state.rightOp})`,
    }),
    'min': makeNodeImplementation$8({
        generateOperation: (state) => `Math.min(${state.leftOp}, ${state.rightOp})`,
    }),
    mod: makeNodeImplementation$8({
        prepareLeftOp: `value > 0 ? Math.floor(value): Math.ceil(value)`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        // Modulo in Pd works so that negative values passed to the [mod] function cycle seamlessly :
        // -3 % 3 = 0 ; -2 % 3 = 1 ; -1 % 3 = 2 ; 0 % 3 = 0 ; 1 % 3 = 1 ; ...
        // So we need to translate the leftOp so that it is > 0 in order for the javascript % function to work.
        generateOperation: (state) => `${state.rightOp} !== 0 ? (${state.rightOp} + (${state.leftOp} % ${state.rightOp})) % ${state.rightOp}: 0`,
    }),
    // Legacy modulo
    '%': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} % ${state.rightOp}`,
    }),
    pow: makeNodeImplementation$8({
        generateOperation: (state) => `pow(${state.leftOp}, ${state.rightOp})`,
        dependencies: [pow],
    }),
    log: makeNodeImplementation$8({
        generateOperation: (state) => `Math.log(${state.leftOp}) / Math.log(${state.rightOp})`,
    }),
    '||': makeNodeImplementation$8({
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) => `${state.leftOp} || ${state.rightOp} ? 1: 0`,
    }),
    '&&': makeNodeImplementation$8({
        prepareLeftOp: `Math.floor(Math.abs(value))`,
        prepareRightOp: `Math.floor(Math.abs(value))`,
        generateOperation: (state) => `${state.leftOp} && ${state.rightOp} ? 1: 0`,
    }),
    '>': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} > ${state.rightOp} ? 1: 0`,
    }),
    '>=': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} >= ${state.rightOp} ? 1: 0`,
    }),
    '<': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} < ${state.rightOp} ? 1: 0`,
    }),
    '<=': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} <= ${state.rightOp} ? 1: 0`,
    }),
    '==': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} == ${state.rightOp} ? 1: 0`,
    }),
    '!=': makeNodeImplementation$8({
        generateOperation: (state) => `${state.leftOp} != ${state.rightOp} ? 1: 0`,
    }),
};
const builders$a = {
    '+': makeBuilder$1(0),
    '-': makeBuilder$1(0),
    '*': makeBuilder$1(1),
    '/': makeBuilder$1(1),
    'max': makeBuilder$1(0),
    'min': makeBuilder$1(1),
    mod: makeBuilder$1(0),
    '%': makeBuilder$1(0),
    pow: makeBuilder$1(0),
    log: makeBuilder$1(Math.E),
    '||': makeBuilder$1(0),
    '&&': makeBuilder$1(0),
    '>': makeBuilder$1(0),
    '>=': makeBuilder$1(0),
    '<': makeBuilder$1(0),
    '<=': makeBuilder$1(0),
    '==': makeBuilder$1(0),
    '!=': makeBuilder$1(0),
};

/**
 * A helper to perform a build step on a given artefacts object.
 * If the build is successful, the artefacts object is updated in place with
 * the newly built artefact.
 *
 * Beware that this can only build one step at a time. If targetting a given format
 * requires multiple steps, you need to call this function multiple times with intermediate targets.
 *
 * @see buildFromPatch
 *
 * @param artefacts
 * @param target
 * @param settings
 */
const performBuildStep = async (artefacts, target, { nodeBuilders, nodeImplementations, audioSettings, renderAudioSettings, inletCallerSpecs, abstractionLoader, }) => {
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
                artefacts.dspGraph = {
                    graph: toDspGraphResult.graph,
                    arrays: toDspGraphResult.arrays,
                    pd: toDspGraphResult.pd,
                };
                // If inletCallerSpecs are not defined, we infer them by 
                // discovering UI controls and generating inlet callers for each one.
                if (!inletCallerSpecs) {
                    const { controls } = discoverGuiControls(artefacts.dspGraph.pd);
                    artefacts.dspGraph.inletCallerSpecs = collectGuiControlsInletCallerSpecs(controls, artefacts.dspGraph.graph);
                }
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
        case 'compiledJs':
        case 'compiledAsc':
            const compileCodeResult = index(artefacts.dspGraph.graph, nodeImplementations, {
                target: target === 'compiledJs'
                    ? 'javascript'
                    : 'assemblyscript',
                audioSettings,
                inletCallerSpecs: inletCallerSpecs || artefacts.dspGraph.inletCallerSpecs,
                arrays: artefacts.dspGraph.arrays,
            });
            {
                if (target === 'compiledJs') {
                    artefacts.compiledJs = compileCodeResult.code;
                }
                else {
                    artefacts.compiledAsc = compileCodeResult.code;
                }
                return { status: 0, warnings: [] };
            }
        case 'wasm':
            try {
                artefacts.wasm = await compileAsc(getArtefact(artefacts, 'compiledAsc'), audioSettings.bitDepth);
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
        case 'appTemplate':
            artefacts.appTemplate = appGenerator('bare-bones', artefacts);
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
const stateVariables$R = {};
// TODO : set message not supported
// ------------------------------- node builder ------------------------------ //
const builder$R = {
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$j = ({ ins, globs, node, compilation: { audioSettings, target }, }) => node.args.channelMapping
    // Save the original index
    .map((destination, i) => [destination, i])
    // Ignore channels that are out of bounds
    .filter(([destination]) => 0 <= destination && destination < audioSettings.channelCount.out)
    .map(([destination, i]) => target === 'javascript'
    ? `${globs.output}[${destination}][${globs.iterFrame}] = ${ins[`${i}`]}`
    : `${globs.output}[${globs.iterFrame} + ${globs.blockSize} * ${destination}] = ${ins[`${i}`]}`)
    .join('\n') + '\n';
// ------------------------------------------------------------------- //
const nodeImplementation$J = { generateLoop: generateLoop$j, stateVariables: stateVariables$R };

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
const stateVariables$Q = {};
// TODO : set message not supported
// ------------------------------- node builder ------------------------------ //
const builder$Q = {
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$i = ({ outs, globs, node, compilation: { audioSettings, target }, }) => node.args.channelMapping
    // Save the original index 
    .map((source, i) => [source, i])
    // Ignore channels that are out of bounds
    .filter(([source]) => 0 <= source && source < audioSettings.channelCount.in)
    .map(([source, i]) => target === 'javascript'
    ? `${outs[`${i}`]} = ${globs.input}[${source}][${globs.iterFrame}]`
    : `${outs[`${i}`]} = ${globs.input}[${globs.iterFrame} + ${globs.blockSize} * ${source}]`)
    .join('\n') + '\n';
// ------------------------------------------------------------------- //
const nodeImplementation$I = { generateLoop: generateLoop$i, stateVariables: stateVariables$Q };

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
const stateVariables$P = {};
// ------------------------------- node builder ------------------------------ //
const builder$P = {
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$E = ({ globs, snds }) => ({
    '0': `
    if (msg_isBang(${globs.m})) { 
        ${snds.$0}(msg_floats([${globs.sampleRate}])) 
        return
    }`,
});
// ------------------------------------------------------------------- //
const nodeImplementation$H = {
    stateVariables: stateVariables$P,
    generateMessageReceivers: generateMessageReceivers$E,
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
const stateVariables$O = {
    phase: 1,
    J: 1,
    funcSetPhase: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$O = {
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
const makeNodeImplementation$7 = ({ coeff, generateOperation, }) => {
    // ------------------------------ generateDeclarations ------------------------------ //
    const generateDeclarations = ({ state, globs, macros: { Var, Func }, }) => `
        let ${Var(state.phase, 'Float')} = 0
        let ${Var(state.J, 'Float')}

        function ${state.funcSetPhase} ${Func([
        Var('phase', 'Float')
    ], 'void')} { ${state.phase} = phase % 1.0${coeff ? ` * ${coeff}` : ''} }

        commons_waitEngineConfigure(() => {
            ${state.J} = ${coeff ? `${coeff}` : '1'} / ${globs.sampleRate}
        })
    `;
    // ------------------------------- generateLoop ------------------------------ //
    const generateLoop = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperation(state.phase)}
        ${state.phase} += (${state.J} * ${ins.$0})
    `;
    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers = ({ globs, state }) => ({
        '1': coldFloatInletWithSetter(globs.m, state.funcSetPhase),
    });
    return {
        generateDeclarations,
        generateMessageReceivers,
        generateLoop,
        stateVariables: stateVariables$O,
        dependencies: [commonsWaitEngineConfigure]
    };
};
// ------------------------------------------------------------------- //
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
    'osc~': builder$O,
    'phasor~': builder$O,
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
const stateVariables$N = {
    minValue: 1,
    maxValue: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$N = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$D = ({ node: { args }, state, macros: { Var } }) => `
    let ${Var(state.minValue, 'Float')} = ${args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${args.maxValue}
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$h = ({ ins, outs, state }) => `
    ${outs.$0} = Math.max(Math.min(${state.maxValue}, ${ins.$0}), ${state.minValue})
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$D = ({ state, globs }) => ({
    '1': coldFloatInlet(globs.m, state.minValue),
    '2': coldFloatInlet(globs.m, state.maxValue),
});
// ------------------------------------------------------------------- //
const nodeImplementation$G = {
    generateLoop: generateLoop$h,
    stateVariables: stateVariables$N,
    generateMessageReceivers: generateMessageReceivers$D,
    generateDeclarations: generateDeclarations$D,
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
const stateVariables$M = {
    signalMemory: 1,
    controlMemory: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$M = {
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
const generateDeclarations$C = ({ state, macros: { Var } }) => `
    let ${Var(state.signalMemory, 'Float')} = 0
    let ${Var(state.controlMemory, 'Float')} = 0
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$g = ({ ins, outs, state }) => `
    ${state.signalMemory} = ${outs.$0} = ${ins.$1} < ${state.controlMemory} ? ${ins.$0}: ${state.signalMemory}
    ${state.controlMemory} = ${ins.$1}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$C = ({ state, globs }) => ({
    '0_message': `
        if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'set'
        ) {
            ${state.signalMemory} = msg_readFloatToken(${globs.m}, 1)
            return

        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'reset'
        ) {
            ${state.controlMemory} = msg_readFloatToken(${globs.m}, 1)
            return

        } else if (
            msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])
            && msg_readStringToken(${globs.m}, 0) === 'reset'
        ) {
            ${state.controlMemory} = 1e20
            return
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$F = {
    generateLoop: generateLoop$g,
    stateVariables: stateVariables$M,
    generateMessageReceivers: generateMessageReceivers$C,
    generateDeclarations: generateDeclarations$C,
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
const stateVariables$L = {
    currentValue: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$L = {
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
const generateDeclarations$B = ({ state, macros: { Var } }) => `
    let ${Var(state.currentValue, 'Float')} = 0
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$f = ({ ins, state }) => `
    ${state.currentValue} = ${ins.$0}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$B = ({ state, globs, snds }) => ({
    '0_message': `
        if (msg_isBang(${globs.m})) {
            ${snds.$0}(msg_floats([${state.currentValue}]))
            return 
        }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$E = {
    generateLoop: generateLoop$f,
    stateVariables: stateVariables$L,
    generateMessageReceivers: generateMessageReceivers$B,
    generateDeclarations: generateDeclarations$B,
    dependencies: [bangUtils]
};

const point = ({ macros: { Var } }) => `
    class Point {
        ${Var('x', 'Float')}
        ${Var('y', 'Float')}
    }
`;
const interpolateLin = {
    codeGenerator: ({ macros: { Var, Func } }) => `
    function interpolateLin ${Func([Var('x', 'Float'), Var('p0', 'Point'), Var('p1', 'Point')], 'Float')} {
        return p0.y + (x - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
    }
`,
    dependencies: [point],
};

const linesUtils = {
    codeGenerator: ({ macros: { Var, Func } }) => `

    class LineSegment {
        ${Var('p0', 'Point')}
        ${Var('p1', 'Point')}
        ${Var('dx', 'Float')}
        ${Var('dy', 'Float')}
    }

    function computeSlope ${Func([Var('p0', 'Point'), Var('p1', 'Point')], 'Float')} {
        return p1.x !== p0.x ? (p1.y - p0.y) / (p1.x - p0.x) : 0
    }

    function removePointsBeforeFrame ${Func([Var('points', 'Array<Point>'), Var('frame', 'Float')], 'Array<Point>')} {
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

    function insertNewLinePoints ${Func([Var('points', 'Array<Point>'), Var('p0', 'Point'), Var('p1', 'Point')], 'Array<Point>')} {
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

    function computeFrameAjustedPoints ${Func([Var('points', 'Array<Point>')], 'Array<Point>')} {
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

    function computeLineSegments ${Func([Var('points', 'Array<Point>')], 'Array<LineSegment>')} {
        const ${Var('lineSegments', 'Array<LineSegment>')} = []
        let ${Var('i', 'Int')} = 0
        let ${Var('p0', 'Point')}
        let ${Var('p1', 'Point')}

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
    }

`,
    dependencies: [interpolateLin],
};

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
const stateVariables$K = {
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
const builder$K = {
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
const generateDeclarations$A = ({ globs, state, macros: { Var, Func } }) => `
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
        const ${Var('endFrame', 'Float')} = startFrame + ${state.nextDurationSamp}
        if (endFrame === toFloat(${globs.frame})) {
            ${state.currentValue} = targetValue
            ${state.lineSegments} = []
        } else {
            ${state.points} = insertNewLinePoints(
                ${state.points}, 
                {x: startFrame, y: ${state.currentValue}},
                {x: endFrame, y: targetValue}
            )
            ${state.lineSegments} = computeLineSegments(
                computeFrameAjustedPoints(${state.points}))
        }
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$e = ({ outs, state, globs }) => `
    if (${state.lineSegments}.length) {
        if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p0.x) {

        // This should come first to handle vertical lines
        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p1.y
            ${state.lineSegments}.shift()

        } else if (toFloat(${globs.frame}) === ${state.lineSegments}[0].p0.x) {
            ${state.currentValue} = ${state.lineSegments}[0].p0.y

        } else if (toFloat(${globs.frame}) < ${state.lineSegments}[0].p1.x) {
            ${state.currentValue} += ${state.lineSegments}[0].dy

        }
    }
    ${outs.$0} = ${state.currentValue}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$A = ({ state, globs }) => ({
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

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.points} = []
        ${state.lineSegments} = []
        return
    }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetNextDelay),
});
// ------------------------------------------------------------------- //
const nodeImplementation$D = {
    generateLoop: generateLoop$e,
    stateVariables: stateVariables$K,
    generateMessageReceivers: generateMessageReceivers$A,
    generateDeclarations: generateDeclarations$A,
    dependencies: [linesUtils, computeUnitInSamples, stringMsgUtils]
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
const stateVariables$J = {
    // Current value used only between 2 lines
    currentValue: 1,
    currentLine: 1,
    defaultLine: 1,
    nextDurationSamp: 1,
    funcSetNewLine: 1,
    funcSetNextDuration: 1,
    funcStopCurrentLine: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$J = {
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
const generateDeclarations$z = ({ globs, state, node: { args }, macros: { Var, Func }, }) => `
    const ${Var(state.defaultLine, 'LineSegment')} = {
        p0: {x: -1, y: 0},
        p1: {x: -1, y: 0},
        dx: 1,
        dy: 0,
    }
    let ${Var(state.currentLine, 'LineSegment')} = ${state.defaultLine}
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
    let ${Var(state.nextDurationSamp, 'Float')} = 0

    function ${state.funcSetNewLine} ${Func([
    Var('targetValue', 'Float'),
], 'void')} {
        const ${Var('startFrame', 'Float')} = toFloat(${globs.frame})
        const ${Var('endFrame', 'Float')} = toFloat(${globs.frame}) + ${state.nextDurationSamp}
        if (endFrame === toFloat(${globs.frame})) {
            ${state.currentLine} = ${state.defaultLine}
            ${state.currentValue} = targetValue
            ${state.nextDurationSamp} = 0
        } else {
            ${state.currentLine} = {
                p0: {
                    x: startFrame, 
                    y: ${state.currentValue},
                }, 
                p1: {
                    x: endFrame, 
                    y: targetValue,
                }, 
                dx: 1,
                dy: 0,
            }
            ${state.currentLine}.dy = computeSlope(${state.currentLine}.p0, ${state.currentLine}.p1)
            ${state.nextDurationSamp} = 0
        }
    }

    function ${state.funcSetNextDuration} ${Func([
    Var('durationMsec', 'Float'),
], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcStopCurrentLine} ${Func([], 'void')} {
        ${state.currentLine}.p1.x = -1
        ${state.currentLine}.p1.y = ${state.currentValue}
    }
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$z = ({ globs, state, macros: { Var } }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        switch (msg_getLength(${globs.m})) {
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                ${state.funcSetNewLine}(msg_readFloatToken(${globs.m}, 0))
        }
        return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStopCurrentLine}()
        return

    }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
});
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$d = ({ outs, state, globs }) => `
    ${outs.$0} = ${state.currentValue}
    if (toFloat(${globs.frame}) < ${state.currentLine}.p1.x) {
        ${state.currentValue} += ${state.currentLine}.dy
        if (toFloat(${globs.frame} + 1) >= ${state.currentLine}.p1.x) {
            ${state.currentValue} = ${state.currentLine}.p1.y
        }
    }
`;
// ------------------------------------------------------------------- //
const nodeImplementation$C = {
    generateDeclarations: generateDeclarations$z,
    generateMessageReceivers: generateMessageReceivers$z,
    generateLoop: generateLoop$d,
    stateVariables: stateVariables$J,
    dependencies: [stringMsgUtils, computeUnitInSamples, linesUtils]
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
const stateVariables$I = {
    currentValue: 1,
    nextSamp: 1,
    nextSampInt: 1,
    currentLine: 1,
    nextDurationSamp: 1,
    grainSamp: 1,
    skedId: 1,
    funcSetNewLine: 1,
    funcSetNextDuration: 1,
    funcSetGrain: 1,
    funcStopCurrentLine: 1,
    funcSetNextSamp: 1,
    funcIncrementTime: 1,
    funcScheduleNextTick: 1,
};
const MIN_GRAIN_MSEC = 20;
// ------------------------------- node builder ------------------------------ //
const builder$I = {
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
const generateDeclarations$y = ({ globs, state, snds, node: { args }, macros: { Var, Func }, }) => `
    let ${Var(state.currentLine, 'LineSegment')} = {
        p0: {x: -1, y: 0},
        p1: {x: -1, y: 0},
        dx: 1,
        dy: 0,
    }
    let ${Var(state.currentValue, 'Float')} = ${args.initValue}
    let ${Var(state.nextSamp, 'Float')} = -1
    let ${Var(state.nextSampInt, 'Int')} = -1
    let ${Var(state.grainSamp, 'Float')} = 0
    let ${Var(state.nextDurationSamp, 'Float')} = 0
    let ${Var(state.skedId, 'SkedId')} = SKED_ID_NULL

    function ${state.funcSetNewLine} ${Func([
    Var('targetValue', 'Float'),
], 'void')} {
        ${state.currentLine} = {
            p0: {
                x: toFloat(${globs.frame}), 
                y: ${state.currentValue},
            }, 
            p1: {
                x: toFloat(${globs.frame}) + ${state.nextDurationSamp}, 
                y: targetValue,
            }, 
            dx: ${state.grainSamp}
        }
        ${state.nextDurationSamp} = 0
        ${state.currentLine}.dy = computeSlope(${state.currentLine}.p0, ${state.currentLine}.p1) * ${state.grainSamp}
    }

    function ${state.funcSetNextDuration} ${Func([
    Var('durationMsec', 'Float'),
], 'void')} {
        ${state.nextDurationSamp} = computeUnitInSamples(${globs.sampleRate}, durationMsec, 'msec')
    }

    function ${state.funcSetGrain} ${Func([
    Var('grainMsec', 'Float'),
], 'void')} {
        ${state.grainSamp} = computeUnitInSamples(${globs.sampleRate}, Math.max(grainMsec, ${MIN_GRAIN_MSEC}), 'msec')
    }

    function ${state.funcStopCurrentLine} ${Func([], 'void')} {
        if (${state.skedId} !== SKED_ID_NULL) {
            commons_cancelWaitFrame(${state.skedId})
            ${state.skedId} = SKED_ID_NULL
        }
        if (${globs.frame} < ${state.nextSampInt}) {
            ${state.funcIncrementTime}(-1 * (${state.nextSamp} - toFloat(${globs.frame})))
        }
        ${state.funcSetNextSamp}(-1)
    }

    function ${state.funcSetNextSamp} ${Func([
    Var('currentSamp', 'Float'),
], 'void')} {
        ${state.nextSamp} = currentSamp
        ${state.nextSampInt} = toInt(Math.round(currentSamp))
    }

    function ${state.funcIncrementTime} ${Func([
    Var('incrementSamp', 'Float'),
], 'void')} {
        if (incrementSamp === ${state.currentLine}.dx) {
            ${state.currentValue} += ${state.currentLine}.dy
        } else {
            ${state.currentValue} += interpolateLin(
                incrementSamp,
                {x: 0, y: 0},
                {x: ${state.currentLine}.dx, y: ${state.currentLine}.dy},
            )
        }
        ${state.funcSetNextSamp}((${state.nextSamp} !== -1 ? ${state.nextSamp}: toFloat(${globs.frame})) + incrementSamp)
    }

    function ${state.funcScheduleNextTick} ${Func([], 'void')} {
        ${state.skedId} = commons_waitFrame(${state.nextSampInt}, () => {
            ${snds.$0}(msg_floats([${state.currentValue}]))
            if (toFloat(${globs.frame}) >= ${state.currentLine}.p1.x) {
                ${state.currentValue} = ${state.currentLine}.p1.y
                ${state.funcStopCurrentLine}()
            } else {
                ${state.funcIncrementTime}(${state.currentLine}.dx)
                ${state.funcScheduleNextTick}()
            }
        })
    }

    commons_waitEngineConfigure(() => {
        ${state.funcSetGrain}(${args.timeGrainMsec})
    })
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$y = ({ snds, globs, state, macros: { Var } }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
        || msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])
    ) {
        ${state.funcStopCurrentLine}()
        switch (msg_getLength(${globs.m})) {
            case 3:
                ${state.funcSetGrain}(msg_readFloatToken(${globs.m}, 2))
            case 2:
                ${state.funcSetNextDuration}(msg_readFloatToken(${globs.m}, 1))
            case 1:
                const ${Var('targetValue', 'Float')} = msg_readFloatToken(${globs.m}, 0)
                if (${state.nextDurationSamp} === 0) {
                    ${state.currentValue} = targetValue
                    ${snds.$0}(msg_floats([targetValue]))
                } else {
                    ${snds.$0}(msg_floats([${state.currentValue}]))
                    ${state.funcSetNewLine}(targetValue)
                    ${state.funcIncrementTime}(${state.currentLine}.dx)
                    ${state.funcScheduleNextTick}()
                }
                
        }
        return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStopCurrentLine}()
        return

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcStopCurrentLine}()
        ${state.currentValue} = msg_readFloatToken(${globs.m}, 1)
        return
    }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetNextDuration),
    '2': coldFloatInletWithSetter(globs.m, state.funcSetGrain),
});
// ------------------------------------------------------------------- //
const nodeImplementation$B = {
    generateDeclarations: generateDeclarations$y,
    generateMessageReceivers: generateMessageReceivers$y,
    stateVariables: stateVariables$I,
    dependencies: [
        stringMsgUtils,
        computeUnitInSamples,
        linesUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
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
const stateVariables$H = {};
// ------------------------------- node builder ------------------------------ //
const builder$H = {
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
// ------------------------------- generateLoop ------------------------------ //
const makeNodeImplementation$6 = ({ generateOperation, dependencies = [], }) => {
    const generateLoop = ({ ins, outs }) => `
        ${outs.$0} = ${generateOperation(ins.$0)}
    `;
    return { generateLoop, stateVariables: stateVariables$H, dependencies };
};
// ------------------------------------------------------------------- //
const nodeImplementations$8 = {
    'abs~': makeNodeImplementation$6({ generateOperation: (input) => `Math.abs(${input})` }),
    'cos~': makeNodeImplementation$6({ generateOperation: (input) => `Math.cos(${input} * 2 * Math.PI)` }),
    'wrap~': makeNodeImplementation$6({ generateOperation: (input) => `(1 + (${input} % 1)) % 1` }),
    'sqrt~': makeNodeImplementation$6({ generateOperation: (input) => `${input} >= 0 ? Math.pow(${input}, 0.5): 0` }),
    'mtof~': makeNodeImplementation$6({ generateOperation: (input) => `mtof(${input})`, dependencies: [mtof] }),
    'ftom~': makeNodeImplementation$6({ generateOperation: (input) => `ftom(${input})`, dependencies: [ftom] }),
};
const builders$8 = {
    'abs~': builder$H,
    'cos~': builder$H,
    'wrap~': builder$H,
    'sqrt~': builder$H,
    'mtof~': builder$H,
    'ftom~': builder$H,
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
const stateVariables$G = stateVariablesTabBase;
// ------------------------------- node builder ------------------------------ //
const builder$G = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations$x = declareTabBase;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$x = (context) => {
    const { snds, state, globs } = context;
    return {
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {        
            if (${state.array}.length === 0) {
                ${snds.$0}(msg_floats([0]))

            } else {
                ${snds.$0}(msg_floats([${state.array}[${prepareIndexCode(`msg_readFloatToken(${globs.m}, 0)`, context)}]]))
            }
            return 

        } ${messageSetArrayCode(context)}
        `,
    };
};
// ------------------------------------------------------------------- //
const nodeImplementation$A = {
    generateDeclarations: generateDeclarations$x,
    generateMessageReceivers: generateMessageReceivers$x,
    stateVariables: stateVariables$G,
    dependencies: [commonsWaitEngineConfigure, commonsArrays]
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
const stateVariables$F = {
    array: 1,
    arrayName: 1,
    arrayChangesSubscription: 1,
    readPosition: 1,
    readUntil: 1,
    funcSetArrayName: 1,
    funcStop: 1,
    funcPlay: 1,
};
// TODO : Should work also if array was set the play started
// ------------------------------- node builder ------------------------------ //
const builder$F = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations$w = ({ state, node, macros: { Func, Var } }) => `
    let ${Var(state.array, 'FloatArray')} = createFloatArray(0)
    let ${Var(state.arrayName, 'string')} = "${node.args.arrayName}"
    let ${Var(state.arrayChangesSubscription, 'SkedId')} = SKED_ID_NULL
    let ${Var(state.readPosition, 'Int')} = 0
    let ${Var(state.readUntil, 'Int')} = 0

    function ${state.funcSetArrayName} ${Func([
    Var('arrayName', 'string')
], 'void')} {
        if (${state.arrayChangesSubscription} != SKED_ID_NULL) {
            commons_cancelArrayChangesSubscription(${state.arrayChangesSubscription})
        }
        ${state.arrayName} = arrayName
        ${state.array} = createFloatArray(0)
        ${state.funcStop}()
        commons_subscribeArrayChanges(arrayName, () => {
            ${state.array} = commons_getArray(${state.arrayName})
            ${state.readPosition} = ${state.array}.length
            ${state.readUntil} = ${state.array}.length
        })
    }

    function ${state.funcPlay} ${Func([
    Var('playFrom', 'Int'),
    Var('playTo', 'Int'),
], 'void')} {
        ${state.readPosition} = playFrom
        ${state.readUntil} = toInt(Math.min(
            toFloat(playTo), 
            toFloat(${state.array}.length),
        ))
    }

    function ${state.funcStop} ${Func([], 'void')} {
        ${state.readPosition} = 0
        ${state.readUntil} = 0
    }

    commons_waitEngineConfigure(() => {
        if (${state.arrayName}.length) {
            ${state.funcSetArrayName}(${state.arrayName})
        }
    })
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$c = ({ state, snds, outs }) => `
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$w = ({ state, globs, macros: { Var } }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.funcPlay}(0, ${state.array}.length)
        return 
        
    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcStop}()
        return 

    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_STRING_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'set'
    ) {
        ${state.funcSetArrayName}(msg_readStringToken(${globs.m}, 1))   
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.funcPlay}(
            toInt(msg_readFloatToken(${globs.m}, 0)), 
            ${state.array}.length
        )
        return 

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN, MSG_FLOAT_TOKEN])) {
        const ${Var('fromSample', 'Int')} = toInt(msg_readFloatToken(${globs.m}, 0))
        ${state.funcPlay}(
            fromSample,
            fromSample + toInt(msg_readFloatToken(${globs.m}, 1)),
        )
        return
    }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$z = {
    generateDeclarations: generateDeclarations$w,
    generateMessageReceivers: generateMessageReceivers$w,
    generateLoop: generateLoop$c,
    stateVariables: stateVariables$F,
    dependencies: [
        bangUtils,
        commonsWaitEngineConfigure,
        commonsArrays,
        stringMsgUtils,
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
const bufCore = ({ macros: { Var, Func } }) => `
    /**
     * Ring buffer 
     */
    class buf_SoundBuffer {
        ${Var('data', 'FloatArray')}
        ${Var('length', 'Int')}
        ${Var('writeCursor', 'Int')}
        ${Var('pullAvailableLength', 'Int')}

        constructor (${Var('length', 'Int')}) {
            this.length = length
            this.data = createFloatArray(length)
            this.writeCursor = 0
            this.pullAvailableLength = 0
        }
    }

    /** Erases all the content from the buffer */
    function buf_create ${Func([Var('length', 'Int')], 'buf_SoundBuffer')} {
        return new buf_SoundBuffer(length)
    }

    /** Erases all the content from the buffer */
    function buf_clear ${Func([Var('buffer', 'buf_SoundBuffer')], 'void')} {
        buffer.data.fill(0)
    }
`;
const bufPushPull = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        /**
         * Pushes a block to the buffer, throwing an error if the buffer is full. 
         * If the block is written successfully, {@link buf_SoundBuffer#writeCursor} 
         * is moved corresponding with the length of data written.
         * 
         * @todo : Optimize by allowing to read/write directly from host
         */
        function buf_pushBlock ${Func([Var('buffer', 'buf_SoundBuffer'), Var('block', 'FloatArray')], 'Int')} {
            if (buffer.pullAvailableLength + block.length > buffer.length) {
                throw new Error('buffer full')
            }

            let ${Var('left', 'Int')} = block.length
            while (left > 0) {
                const lengthToWrite = toInt(Math.min(
                    toFloat(buffer.length - buffer.writeCursor), 
                    toFloat(left)
                ))
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
        }

        /**
         * Pulls a single sample from the buffer. 
         * This is a destructive operation, and the sample will be 
         * unavailable for subsequent readers with the same operation.
         */
        function buf_pullSample ${Func([Var('buffer', 'buf_SoundBuffer')], 'Float')} {
            if (buffer.pullAvailableLength <= 0) {
                return 0
            }
            const ${Var('readCursor', 'Int')} = buffer.writeCursor - buffer.pullAvailableLength
            buffer.pullAvailableLength -= 1
            return buffer.data[readCursor >= 0 ? readCursor : buffer.length + readCursor]
        }
    `,
    dependencies: [bufCore],
};
const bufWriteRead = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        /**
         * Writes a sample at \`@link writeCursor\` and increments \`writeCursor\` by one.
         */
        function buf_writeSample ${Func([Var('buffer', 'buf_SoundBuffer'), Var('value', 'Float')], 'void')} {
            buffer.data[buffer.writeCursor] = value
            buffer.writeCursor = (buffer.writeCursor + 1) % buffer.length
        }

        /**
         * Reads the sample at position \`writeCursor - offset\`.
         * @param offset Must be between 0 (for reading the last written sample)
         *  and {@link buf_SoundBuffer#length} - 1. A value outside these bounds will not cause 
         *  an error, but might cause unexpected results.
         */
        function buf_readSample ${Func([Var('buffer', 'buf_SoundBuffer'), Var('offset', 'Int')], 'Float')} {
            // R = (buffer.writeCursor - 1 - offset) -> ideal read position
            // W = R % buffer.length -> wrap it so that its within buffer length bounds (but could be negative)
            // (W + buffer.length) % buffer.length -> if W negative, (W + buffer.length) shifts it back to positive.
            return buffer.data[(buffer.length + ((buffer.writeCursor - 1 - offset) % buffer.length)) % buffer.length]
        }
    `,
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
const FS_OPERATION_SUCCESS = 0;
const FS_OPERATION_FAILURE = 1;
const fsCore = {
    codeGenerator: ({ macros: { Var, Func }, target }) => `
        ${renderIf(target === 'assemblyscript', `
                type fs_OperationId = Int
                type fs_OperationStatus = Int
                type fs_OperationCallback = (id: fs_OperationId, status: fs_OperationStatus) => void
                type fs_OperationSoundCallback = (id: fs_OperationId, status: fs_OperationStatus, sound: FloatArray[]) => void
                type fs_Url = string
            `)}

        const ${Var('FS_OPERATION_SUCCESS', 'Int')} = ${FS_OPERATION_SUCCESS}
        const ${Var('FS_OPERATION_FAILURE', 'Int')} = ${FS_OPERATION_FAILURE}
        
        const ${Var('_FS_OPERATIONS_IDS', 'Set<fs_OperationId>')} = new Set()
        const ${Var('_FS_OPERATIONS_CALLBACKS', 'Map<fs_OperationId, fs_OperationCallback>')} = new Map()
        const ${Var('_FS_OPERATIONS_SOUND_CALLBACKS', 'Map<fs_OperationId, fs_OperationSoundCallback>')} = new Map()

        // We start at 1, because 0 is what ASC uses when host forgets to pass an arg to 
        // a function. Therefore we can get false negatives when a test happens to expect a 0.
        let ${Var('_FS_OPERATION_COUNTER', 'Int')} = 1

        class fs_SoundInfo {
            ${Var('channelCount', 'Int')}
            ${Var('sampleRate', 'Int')}
            ${Var('bitDepth', 'Int')}
            ${Var('encodingFormat', 'string')}
            ${Var('endianness', 'string')}
            ${Var('extraOptions', 'string')}
        }

        function fs_soundInfoToMessage ${Func([Var('soundInfo', 'fs_SoundInfo')], 'Message')} {
            const ${Var('info', 'Message')} = msg_create([
                MSG_FLOAT_TOKEN,
                MSG_FLOAT_TOKEN,
                MSG_FLOAT_TOKEN,
                MSG_STRING_TOKEN,
                soundInfo.encodingFormat.length,
                MSG_STRING_TOKEN,
                soundInfo.endianness.length,
                MSG_STRING_TOKEN,
                soundInfo.extraOptions.length
            ])
            msg_writeFloatToken(info, 0, toFloat(soundInfo.channelCount))
            msg_writeFloatToken(info, 1, toFloat(soundInfo.sampleRate))
            msg_writeFloatToken(info, 2, toFloat(soundInfo.bitDepth))
            msg_writeStringToken(info, 3, soundInfo.encodingFormat)
            msg_writeStringToken(info, 4, soundInfo.endianness)
            msg_writeStringToken(info, 5, soundInfo.extraOptions)
            return info
        }

        function _fs_assertOperationExists ${Func([Var('id', 'fs_OperationId'), Var('operationName', 'string')], 'void')} {
            if (!_FS_OPERATIONS_IDS.has(id)) {
                throw new Error(operationName + ' operation unknown : ' + id.toString())
            }
        }

        function _fs_createOperationId ${Func([], 'fs_OperationId')} {
            const ${Var('id', 'fs_OperationId')} = _FS_OPERATION_COUNTER++
            _FS_OPERATIONS_IDS.add(id)
            return id
        }   
    `,
    dependencies: [msg],
};
const fsReadSoundFile = {
    codeGenerator: ({ macros: { Func, Var } }) => `
        function fs_readSoundFile ${Func([
        Var('url', 'fs_Url'),
        Var('soundInfo', 'fs_SoundInfo'),
        Var('callback', 'fs_OperationSoundCallback'),
    ], 'fs_OperationId')} {
            const ${Var('id', 'fs_OperationId')} = _fs_createOperationId()
            _FS_OPERATIONS_SOUND_CALLBACKS.set(id, callback)
            i_fs_readSoundFile(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        }

        function x_fs_onReadSoundFileResponse ${Func([
        Var('id', 'fs_OperationId'),
        Var('status', 'fs_OperationStatus'),
        Var('sound', 'FloatArray[]'),
    ], 'void')} {
            _fs_assertOperationExists(id, 'x_fs_onReadSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_SOUND_CALLBACKS.get(id)
            callback(id, status, sound)
            _FS_OPERATIONS_SOUND_CALLBACKS.delete(id)
        }
    `,
    exports: [
        {
            name: 'x_fs_onReadSoundFileResponse',
        },
    ],
    imports: [
        {
            name: 'i_fs_readSoundFile',
            args: [
                ['id', 'fs_OperationId'],
                ['url', 'fs_Url'],
                ['info', 'Message'],
            ],
            returns: 'void',
        },
    ],
    dependencies: [fsCore],
};
const fsWriteSoundFile = {
    codeGenerator: ({ macros: { Func, Var } }) => `
        function fs_writeSoundFile ${Func([
        Var('sound', 'FloatArray[]'),
        Var('url', 'fs_Url'),
        Var('soundInfo', 'fs_SoundInfo'),
        Var('callback', 'fs_OperationCallback'),
    ], 'fs_OperationId')} {
            const id = _fs_createOperationId()
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_writeSoundFile(id, sound, url, fs_soundInfoToMessage(soundInfo))
            return id
        }

        function x_fs_onWriteSoundFileResponse ${Func([Var('id', 'fs_OperationId'), Var('status', 'fs_OperationStatus')], 'void')} {
            _fs_assertOperationExists(id, 'x_fs_onWriteSoundFileResponse')
            _FS_OPERATIONS_IDS.delete(id)
            // Finish cleaning before calling the callback in case it would throw an error.
            const callback = _FS_OPERATIONS_CALLBACKS.get(id)
            callback(id, status)
            _FS_OPERATIONS_CALLBACKS.delete(id)
        }
    `,
    exports: [
        {
            name: 'x_fs_onWriteSoundFileResponse',
        },
    ],
    imports: [
        {
            name: 'i_fs_writeSoundFile',
            args: [
                ['id', 'fs_OperationId'],
                ['sound', 'FloatArray[]'],
                ['url', 'fs_Url'],
                ['info', 'Message'],
            ],
            returns: 'void',
        },
    ],
    dependencies: [fsCore],
};
const fsSoundStreamCore = {
    codeGenerator: ({ macros: { Func, Var } }) => `
        const ${Var('_FS_SOUND_STREAM_BUFFERS', 'Map<fs_OperationId, Array<buf_SoundBuffer>>')} = new Map()

        const ${Var('_FS_SOUND_BUFFER_LENGTH', 'Int')} = 20 * 44100

        function fs_closeSoundStream ${Func([Var('id', 'fs_OperationId'), Var('status', 'fs_OperationStatus')], 'void')} {
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
        }

        function x_fs_onCloseSoundStream ${Func([Var('id', 'fs_OperationId'), Var('status', 'fs_OperationStatus')], 'void')} {
            fs_closeSoundStream(id, status)
        }
    `,
    exports: [
        {
            name: 'x_fs_onCloseSoundStream',
        },
    ],
    imports: [
        {
            name: 'i_fs_closeSoundStream',
            args: [
                ['id', 'fs_OperationId'],
                ['status', 'fs_OperationStatus'],
            ],
            returns: 'void',
        },
    ],
    dependencies: [bufCore, fsCore],
};
const fsReadSoundStream = {
    codeGenerator: ({ macros: { Var, Func } }) => `
        function fs_openSoundReadStream ${Func([
        Var('url', 'fs_Url'),
        Var('soundInfo', 'fs_SoundInfo'),
        Var('callback', 'fs_OperationCallback'),
    ], 'fs_OperationId')} {
            const id = _fs_createOperationId()
            const ${Var('buffers', 'Array<buf_SoundBuffer>')} = []
            for (let channel = 0; channel < soundInfo.channelCount; channel++) {
                buffers.push(new buf_SoundBuffer(_FS_SOUND_BUFFER_LENGTH))
            }
            _FS_SOUND_STREAM_BUFFERS.set(id, buffers)
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundReadStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        }

        function x_fs_onSoundStreamData ${Func([Var('id', 'fs_OperationId'), Var('block', 'FloatArray[]')], 'Int')} {
            _fs_assertOperationExists(id, 'x_fs_onSoundStreamData')
            const buffers = _FS_SOUND_STREAM_BUFFERS.get(id)
            for (let ${Var('i', 'Int')} = 0; i < buffers.length; i++) {
                buf_pushBlock(buffers[i], block[i])
            }
            return buffers[0].pullAvailableLength
        }
    `,
    exports: [
        {
            name: 'x_fs_onSoundStreamData',
        },
    ],
    imports: [
        {
            name: 'i_fs_openSoundReadStream',
            args: [
                ['id', 'fs_OperationId'],
                ['url', 'fs_Url'],
                ['info', 'Message'],
            ],
            returns: 'void',
        },
    ],
    dependencies: [fsSoundStreamCore, bufPushPull],
};
const fsWriteSoundStream = {
    codeGenerator: ({ macros: { Func, Var } }) => `
        function fs_openSoundWriteStream ${Func([
        Var('url', 'fs_Url'),
        Var('soundInfo', 'fs_SoundInfo'),
        Var('callback', 'fs_OperationCallback'),
    ], 'fs_OperationId')} {
            const id = _fs_createOperationId()
            _FS_SOUND_STREAM_BUFFERS.set(id, [])
            _FS_OPERATIONS_CALLBACKS.set(id, callback)
            i_fs_openSoundWriteStream(id, url, fs_soundInfoToMessage(soundInfo))
            return id
        }

        function fs_sendSoundStreamData ${Func([Var('id', 'fs_OperationId'), Var('block', 'FloatArray[]')], 'void')} {
            _fs_assertOperationExists(id, 'fs_sendSoundStreamData')
            i_fs_sendSoundStreamData(id, block)
        }
    `,
    imports: [
        {
            name: 'i_fs_openSoundWriteStream',
            args: [
                ['id', 'fs_OperationId'],
                ['url', 'fs_Url'],
                ['info', 'Message'],
            ],
            returns: 'void',
        },
        {
            name: 'i_fs_sendSoundStreamData',
            args: [
                ['id', 'fs_OperationId'],
                ['block', 'FloatArray[]'],
            ],
            returns: 'void',
        },
    ],
    dependencies: [fsSoundStreamCore],
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
    codeGenerator: ({ macros: { Func, Var } }) => `
    function parseSoundFileOpenOpts ${Func([Var('m', 'Message'), Var('soundInfo', 'fs_SoundInfo')], 'Set<Int>')} {
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
    }
`,
    dependencies: [msg, fsCore],
};
// TODO : unit testing
const parseReadWriteFsOpts = {
    codeGenerator: ({ macros: { Func, Var } }) => `
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
`,
    dependencies: [msg, fsCore],
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
const stateVariables$E = {
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
const builder$E = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations$v = ({ macros: { Var }, state, }) => `
    let ${Var(state.buffers, 'Array<buf_SoundBuffer>')} = []
    let ${Var(state.streamOperationId, 'fs_OperationId')} = -1
    let ${Var(state.readingStatus, 'Int')} = 0
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$b = ({ state, snds, outs, node: { args: { channelCount }, }, }) => renderCode `
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$v = ({ node, state, globs, macros: { Var }, }) => ({
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
                sampleRate: toInt(${globs.sampleRate}),
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
        
    } else if (msg_isAction(${globs.m}, 'print')) {
        console.log('[readsf~] reading = ' + ${state.readingStatus}.toString())
        return
    }    
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$y = {
    generateDeclarations: generateDeclarations$v,
    generateMessageReceivers: generateMessageReceivers$v,
    generateLoop: generateLoop$b,
    stateVariables: stateVariables$E,
    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        bangUtils,
        stringMsgUtils,
        fsReadSoundStream,
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
const stateVariables$D = {
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
const builder$D = {
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
    configureMessageToSignalConnection: (inletId) => {
        if (inletId === '0') {
            return { reroutedMessageInletId: '0_message' };
        }
        return undefined;
    },
};
// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations$u = ({ state, node: { args }, macros: { Func, Var } }) => renderCode `
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$a = ({ state, ins, node: { args } }) => renderCode `
    if (${state.isWriting} === true) {
        ${countTo(args.channelCount).map((i) => `${state.block}[${i}][${state.cursor}] = ${ins[i]}`)}
        ${state.cursor}++
        if (${state.cursor} === ${BLOCK_SIZE}) {
            ${state.funcFlushBlock}()
        }
    }
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$u = ({ node, state, globs, macros: { Var } }) => ({
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
                sampleRate: toInt(${globs.sampleRate}),
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

    } else if (msg_isAction(${globs.m}, 'start')) {
            ${state.isWriting} = true
            return

    } else if (msg_isAction(${globs.m}, 'stop')) {
        ${state.funcFlushBlock}()
        ${state.isWriting} = false
        return

    } else if (msg_isAction(${globs.m}, 'print')) {
        console.log('[writesf~] writing = ' + ${state.isWriting}.toString())
        return
    }    
    `
});
// ------------------------------------------------------------------- //
const nodeImplementation$x = {
    generateDeclarations: generateDeclarations$u,
    generateMessageReceivers: generateMessageReceivers$u,
    generateLoop: generateLoop$a,
    stateVariables: stateVariables$D,
    dependencies: [
        parseSoundFileOpenOpts,
        parseReadWriteFsOpts,
        stringMsgUtils,
        fsWriteSoundStream,
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
const stateVariables$C = {
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
const builder$C = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$t = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$9 = ({ ins, outs, state }) => `
    ${state.y} = ${ins.$0} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$t = ({ state, globs }) => ({
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
const nodeImplementation$w = {
    generateLoop: generateLoop$9,
    stateVariables: stateVariables$C,
    generateMessageReceivers: generateMessageReceivers$t,
    generateDeclarations: generateDeclarations$t,
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
const stateVariables$B = {
    busName: 1,
    funcSetBusName: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$B = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$s = ({ state, node: { args }, macros: { Var, Func } }) => `
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$8 = ({ ins, state }) => `
    addAssignSignalBus(${state.busName}, ${ins.$0})
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$s = ({ state, globs }) => ({
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
const nodeImplementation$v = {
    generateLoop: generateLoop$8,
    generateMessageReceivers: generateMessageReceivers$s,
    stateVariables: stateVariables$B,
    generateDeclarations: generateDeclarations$s,
    dependencies: [signalBuses]
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
const stateVariables$A = {
    busName: 1,
    funcSetBusName: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$A = {
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
const generateDeclarations$r = ({ state, node: { args }, macros: { Var, Func } }) => `
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$7 = ({ outs, state }) => `
    ${outs.$0} = readSignalBus(${state.busName})
    resetSignalBus(${state.busName})
`;
// ------------------------------------------------------------------- //
const nodeImplementation$u = {
    generateLoop: generateLoop$7,
    stateVariables: stateVariables$A,
    generateDeclarations: generateDeclarations$r,
    dependencies: [signalBuses]
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
const stateVariables$z = {
    busName: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$z = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$q = ({ state, node: { args }, macros: { Var } }) => `
    const ${Var(state.busName, 'string')} = "${args.busName}"
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$6 = ({ ins, state }) => `
    setSignalBus(${state.busName}, ${ins.$0})
`;
// ------------------------------------------------------------------- //
const nodeImplementation$t = {
    generateLoop: generateLoop$6,
    stateVariables: stateVariables$z,
    generateDeclarations: generateDeclarations$q,
    dependencies: [signalBuses]
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
const stateVariables$y = {
    busName: 1,
    funcSetBusName: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$y = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$p = ({ state, node: { args }, macros: { Var, Func } }) => `
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$5 = ({ outs, state }) => `
    ${outs.$0} = readSignalBus(${state.busName})
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$r = ({ state, globs }) => ({
    '0': `
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
const nodeImplementation$s = {
    generateLoop: generateLoop$5,
    generateMessageReceivers: generateMessageReceivers$r,
    stateVariables: stateVariables$y,
    generateDeclarations: generateDeclarations$p,
    dependencies: [signalBuses]
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
const stateVariables$x = {
    rate: 1,
    sampleRatio: 1,
    skedId: 1,
    realNextTick: 1,
    funcSetRate: 1,
    funcScheduleNextTick: 1,
    funcStop: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$x = {
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
const generateDeclarations$o = ({ state, globs, snds, node: { args }, macros: { Func, Var }, }) => 
// Time units are all expressed in samples here
`
        let ${Var(state.rate, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.skedId, 'Int')} = SKED_ID_NULL
        let ${Var(state.realNextTick, 'Float')} = -1

        function ${state.funcSetRate} ${Func([
    Var('rate', 'Float')
], 'void')} {
            ${state.rate} = Math.max(rate, 0)
        }

        function ${state.funcScheduleNextTick} ${Func([], 'void')} {
            ${snds.$0}(msg_bang())
            ${state.realNextTick} = ${state.realNextTick} + ${state.rate} * ${state.sampleRatio}
            ${state.skedId} = commons_waitFrame(toInt(Math.round(${state.realNextTick})), () => {
                ${state.funcScheduleNextTick}()
            })
        }

        function ${state.funcStop} ${Func([], 'void')} {
            if (${state.skedId} !== SKED_ID_NULL) {
                commons_cancelWaitFrame(${state.skedId})
                ${state.skedId} = SKED_ID_NULL
            }
            ${state.realNextTick} = 0
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetRate}(${args.rate})
        })
    `;
// ------------------------------ generateMessageReceivers ------------------------------ //
const generateMessageReceivers$q = ({ state, globs, snds }) => ({
    '0': `
    if (msg_getLength(${globs.m}) === 1) {
        if (
            (msg_isFloatToken(${globs.m}, 0) && msg_readFloatToken(${globs.m}, 0) === 0)
            || msg_isAction(${globs.m}, 'stop')
        ) {
            ${state.funcStop}()
            return

        } else if (
            msg_isFloatToken(${globs.m}, 0)
            || msg_isBang(${globs.m})
        ) {
            ${state.realNextTick} = toFloat(${globs.frame})
            ${state.funcScheduleNextTick}()
            return
        }
    }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetRate),
});
// ------------------------------------------------------------------- //
const nodeImplementation$r = {
    generateDeclarations: generateDeclarations$o,
    generateMessageReceivers: generateMessageReceivers$q,
    stateVariables: stateVariables$x,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        stringMsgUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
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
const stateVariables$w = {
    resetTime: 1,
    sampleRatio: 1
};
// ------------------------------- node builder ------------------------------ //
const builder$w = {
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
const generateDeclarations$n = ({ state, globs, node: { args }, macros: { Var }, }) => `
    let ${Var(state.sampleRatio, 'Float')} = 0
    let ${Var(state.resetTime, 'Int')} = 0

    commons_waitEngineConfigure(() => {
        ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
    })
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$p = ({ snds, globs, state, }) => ({
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
const nodeImplementation$q = {
    stateVariables: stateVariables$w,
    generateDeclarations: generateDeclarations$n,
    generateMessageReceivers: generateMessageReceivers$p,
    dependencies: [computeUnitInSamples, bangUtils, commonsWaitEngineConfigure]
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
const stateVariables$v = {
    funcSetDelay: 1,
    funcScheduleDelay: 1,
    funcStopDelay: 1,
    delay: 1,
    scheduledBang: 1,
    sampleRatio: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$v = {
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
// ------------------------------ generateDeclarations ------------------------------ //
const generateDeclarations$m = ({ state, snds, globs, node: { args }, macros: { Func, Var } }) => `
        let ${Var(state.delay, 'Float')} = 0
        let ${Var(state.sampleRatio, 'Float')} = 1
        let ${Var(state.scheduledBang, 'SkedId')} = SKED_ID_NULL

        const ${state.funcSetDelay} = ${Func([
    Var('delay', 'Float')
], 'void')} => {
            ${state.delay} = Math.max(0, delay)
        }

        const ${state.funcScheduleDelay} = ${Func([], 'void')} => {
            if (${state.scheduledBang} !== SKED_ID_NULL) {
                ${state.funcStopDelay}()
            }
            ${state.scheduledBang} = commons_waitFrame(toInt(
                Math.round(
                    toFloat(${globs.frame}) + ${state.delay} * ${state.sampleRatio})),
                () => ${snds.$0}(msg_bang())
            )
        }

        const ${state.funcStopDelay} = ${Func([], 'void')} => {
            commons_cancelWaitFrame(${state.scheduledBang})
            ${state.scheduledBang} = SKED_ID_NULL
        }

        commons_waitEngineConfigure(() => {
            ${state.sampleRatio} = computeUnitInSamples(${globs.sampleRate}, ${args.unitAmount}, "${args.unit}")
            ${state.funcSetDelay}(${args.delay})
        })
    `;
// ------------------------------ generateMessageReceivers ------------------------------ //
const generateMessageReceivers$o = ({ state, globs, macros: { Var } }) => ({
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
const nodeImplementation$p = {
    generateDeclarations: generateDeclarations$m,
    generateMessageReceivers: generateMessageReceivers$o,
    stateVariables: stateVariables$v,
    dependencies: [
        computeUnitInSamples,
        bangUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
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
    translateArgs: ({ args: [init, receive, send] }) => ({
        outputOnLoad: !!init,
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
};
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$l = (context) => {
    const { state, snds, node: { id, args }, macros: { Var, Func }, compilation: { codeVariableNames: { nodes } } } = context;
    return `
        function ${state.funcMessageReceiver} ${Func([
        Var('m', 'Message'),
    ], 'void')} {
            ${messageSetSendReceive(context)}
            else {
                const ${Var('outMessage', 'Message')} = msg_bang()
                ${nodes[id].snds.$0}(outMessage)
                if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                    msgBusPublish(${state.sendBusName}, outMessage)
                }
                return
            }
        }

        ${declareControlSendReceive(context)}

        ${renderIf(args.outputOnLoad, `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`)}
    `;
};
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$n = (context) => {
    const { state, globs } = context;
    return ({
        '0': `
            ${state.funcMessageReceiver}(${globs.m})
            return
        `,
    });
};
// ------------------------------------------------------------------- //
const nodeImplementation$o = {
    generateDeclarations: generateDeclarations$l,
    generateMessageReceivers: generateMessageReceivers$n,
    stateVariables: stateVariables$T,
    dependencies: [
        bangUtils,
        messageBuses,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
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
const builder$t = {
    translateArgs: ({ args: [_, __, receive, send] }) => ({
        sendBusName: assertOptionalString(send) || EMPTY_BUS_NAME,
        receiveBusName: assertOptionalString(receive) || EMPTY_BUS_NAME,
    }),
    build,
};
const makeNodeImplementation$5 = ({ initValue, messageMatch, }) => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations = (context) => {
        const { state, globs, macros: { Var, Func }, node: { id }, compilation: { codeVariableNames: { nodes } } } = context;
        return `
            let ${Var(state.value, 'Message')} = ${initValue}
            
            function ${state.funcMessageReceiver} ${Func([
            Var('m', 'Message'),
        ], 'void')} {
                ${messageSetSendReceive(context)}
                else if (msg_isBang(m)) {
                    ${nodes[id].snds.$0}(${state.value})
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, ${state.value})
                    }
                    return
                
                } else if (
                    msg_getTokenType(${globs.m}, 0) === MSG_STRING_TOKEN
                    && msg_readStringToken(${globs.m}, 0) === 'set'
                ) {
                    const ${Var('setMessage', 'Message')} = msg_slice(${globs.m}, 1, msg_getLength(${globs.m}))
                    ${renderIf(messageMatch, () => `if (${messageMatch('setMessage')}) {`)} 
                            ${state.value} = setMessage    
                            return
                    ${renderIf(messageMatch, () => '}')}

                } ${messageMatch ?
            `else if (${messageMatch('m')}) {` :
            `else {`}
                
                    ${state.value} = m
                    ${nodes[id].snds.$0}(${state.value})
                    if (${state.sendBusName} !== "${EMPTY_BUS_NAME}") {
                        msgBusPublish(${state.sendBusName}, ${state.value})
                    }
                    return

                }
                throw new Error('unsupported message ' + msg_display(m))
            }

            ${declareControlSendReceive(context)}
        `;
    };
    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers = (context) => {
        const { state, globs } = context;
        return ({
            '0': `
                ${state.funcMessageReceiver}(${globs.m})
                return
            `,
        });
    };
    // ------------------------------------------------------------------- //
    return {
        generateDeclarations,
        generateMessageReceivers,
        stateVariables: stateVariables$T,
        dependencies: [
            bangUtils,
            messageBuses,
            msgUtils,
            commonsWaitEngineConfigure,
        ],
    };
};
const builders$7 = {
    'floatatom': builder$t,
    'symbolatom': builder$t,
    'listbox': builder$t,
};
const nodeImplementations$7 = {
    'floatatom': makeNodeImplementation$5({
        initValue: `msg_floats([0])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_FLOAT_TOKEN])`
    }),
    'symbolatom': makeNodeImplementation$5({
        initValue: `msg_strings([''])`,
        messageMatch: (m) => `msg_isMatching(${m}, [MSG_STRING_TOKEN])`
    }),
    'listbox': makeNodeImplementation$5({
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
const stateVariables$u = {};
// ------------------------------- node builder ------------------------------ //
const builder$s = {
    translateArgs: () => ({}),
    build: () => ({
        inlets: {},
        outlets: { '0': { type: 'message', id: '0' } },
        isPushingMessages: true
    }),
};
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$k = ({ snds }) => `commons_waitFrame(0, () => ${snds.$0}(msg_bang()))`;
// ------------------------------------------------------------------- //
const nodeImplementation$n = {
    generateDeclarations: generateDeclarations$k,
    stateVariables: stateVariables$u,
    dependencies: [bangUtils, commonsWaitFrame],
};

const roundFloatAsPdInt = ({ macros: { Func, Var } }) => `
    function roundFloatAsPdInt ${Func([
    Var('value', 'Float'),
], 'Float')} {
        return value > 0 ? Math.floor(value): Math.ceil(value)
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
const stateVariables$t = {
    value: 1,
    funcSetValue: 1,
};
// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder$r = {
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
const makeGenerateDeclarations = (prepareValueCode = 'value') => ({ node: { args }, state, macros: { Var, Func } }) => `
        let ${Var(state.value, 'Float')} = 0

        const ${state.funcSetValue} = ${Func([
    Var('value', 'Float')
], 'void')} => { ${state.value} = ${prepareValueCode} }
        
        ${state.funcSetValue}(${args.value})
    `;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$m = ({ snds, globs, state, }) => ({
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
    float: builder$r,
    f: { aliasTo: 'float' },
    int: builder$r,
    i: { aliasTo: 'int' },
};
const nodeImplementations$6 = {
    float: {
        generateDeclarations: makeGenerateDeclarations(),
        generateMessageReceivers: generateMessageReceivers$m,
        stateVariables: stateVariables$t,
        dependencies: [bangUtils],
    },
    int: {
        generateDeclarations: makeGenerateDeclarations('roundFloatAsPdInt(value)'),
        generateMessageReceivers: generateMessageReceivers$m,
        stateVariables: stateVariables$t,
        dependencies: [roundFloatAsPdInt, bangUtils],
    },
};

const stateVariables$s = {};
// ------------------------------- node builder ------------------------------ //
const builder$q = {
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
    // ------------------------------- generateMessageReceivers ------------------------------ //
    const generateMessageReceivers = ({ globs, snds, macros: { Var } }) => ({
        '0': `
        if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
            const ${Var('value', 'Float')} = msg_readFloatToken(${globs.m}, 0)
            ${snds.$0}(msg_floats([${operationCode}]))
            return
        }
        `
    });
    return { generateMessageReceivers, stateVariables: stateVariables$s, dependencies };
};
// ------------------------------------------------------------------- //
const nodeImplementations$5 = {
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
const builders$5 = {
    'abs': builder$q,
    'cos': builder$q,
    'wrap': builder$q,
    'sqrt': builder$q,
    'mtof': builder$q,
    'ftom': builder$q,
    'rmstodb': builder$q,
    'dbtorms': builder$q,
    'powtodb': builder$q,
    'dbtopow': builder$q,
    'vu': builder$q,
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
const stateVariables$r = {
    leftOp: 1,
    rightOp: 1,
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
const makeNodeImplementation$3 = ({ generateOperation, dependencies = [], }) => {
    const generateLoop = ({ ins, outs }) => `${outs.$0} = ${generateOperation(ins.$0, ins.$1)}`;
    return { generateLoop, stateVariables: stateVariables$r, dependencies };
};
// ------------------------------------------------------------------- //
const nodeImplementations$4 = {
    '+~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} + ${rightOp}` }),
    '-~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} - ${rightOp}` }),
    '*~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${leftOp} * ${rightOp}` }),
    '/~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `${rightOp} !== 0 ? ${leftOp} / ${rightOp} : 0` }),
    'min~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `Math.min(${leftOp}, ${rightOp})` }),
    'max~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `Math.max(${leftOp}, ${rightOp})` }),
    'pow~': makeNodeImplementation$3({ generateOperation: (leftOp, rightOp) => `pow(${leftOp}, ${rightOp})`, dependencies: [pow] }),
};
const builders$4 = {
    '+~': makeBuilder(0),
    '-~': makeBuilder(0),
    '*~': makeBuilder(0),
    '/~': makeBuilder(0),
    'min~': makeBuilder(0),
    'max~': makeBuilder(0),
    'pow~': makeBuilder(0),
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
const stateVariables$q = {};
// TODO : implement seed
// ------------------------------- node builder ------------------------------ //
const builder$p = {
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
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$4 = ({ outs }) => `
    ${outs.$0} = Math.random() * 2 - 1
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$l = ({ globs }) => ({
    '0': `
    if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'seed'
    ) {
        console.log('WARNING : seed not implemented yet for [noise~]')
        return
    }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$m = { generateLoop: generateLoop$4, generateMessageReceivers: generateMessageReceivers$l, stateVariables: stateVariables$q };

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
    codeGenerator: ({ macros: { Var, Func } }) => `
    const ${Var('DELAY_BUFFERS', 'Map<string, buf_SoundBuffer>')} = new Map()
    const ${Var('DELAY_BUFFERS_SKEDULER', 'Skeduler')} = sked_create(true)
    const ${Var('DELAY_BUFFERS_NULL', 'buf_SoundBuffer')} = buf_create(1)

    function DELAY_BUFFERS_set ${Func([Var('delayName', 'string'), Var('buffer', 'buf_SoundBuffer')], 'void')} {
        DELAY_BUFFERS.set(delayName, buffer)
        sked_emit(DELAY_BUFFERS_SKEDULER, delayName)
    }

    function DELAY_BUFFERS_get ${Func([
        Var('delayName', 'string'),
        Var('callback', '(event: string) => void'),
    ], 'void')} {
        sked_wait(DELAY_BUFFERS_SKEDULER, delayName, callback)
    }

    function DELAY_BUFFERS_delete ${Func([Var('delayName', 'string')], 'void')} {
        DELAY_BUFFERS.delete(delayName)
    }
`,
    dependencies: [bufCore, sked],
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
const stateVariables$p = {
    delayName: 1,
    buffer: 1,
    funcSetDelayName: 1,
};
// TODO : Implement 4-point interpolation for delread4
// ------------------------------- node builder ------------------------------ //
const builder$o = {
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
const makeNodeImplementation$2 = () => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations = ({ state, node: { args }, macros: { Var, Func } }) => `
        let ${Var(state.delayName, 'string')} = ""
        let ${Var(state.buffer, 'buf_SoundBuffer')} = DELAY_BUFFERS_NULL

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
                })
            }
        }

        commons_waitEngineConfigure(() => {
            if ("${args.delayName}".length) {
                ${state.funcSetDelayName}("${args.delayName}")
            }
        })
    `;
    // ------------------------------- generateLoop ------------------------------ //
    const generateLoop = ({ globs, outs, ins, state }) => `
        ${outs.$0} = buf_readSample(${state.buffer}, toInt(Math.round(
            Math.min(
                Math.max(computeUnitInSamples(${globs.sampleRate}, ${ins.$0}, "msec"), 0), 
                toFloat(${state.buffer}.length - 1)
            )
        )))
    `;
    // ------------------------------------------------------------------- //
    return {
        generateLoop,
        stateVariables: stateVariables$p,
        generateDeclarations,
        dependencies: [
            computeUnitInSamples,
            delayBuffers,
            commonsWaitEngineConfigure,
            bufWriteRead,
        ],
    };
};
const builders$3 = {
    'delread~': builder$o,
    'delread4~': builder$o,
};
const nodeImplementations$3 = {
    'delread~': makeNodeImplementation$2(),
    'delread4~': makeNodeImplementation$2(),
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
const stateVariables$o = {
    delayName: 1,
    buffer: 1,
    funcSetDelayName: 1,
};
// TODO : default maxDurationMsec in Pd ? 
// ------------------------------- node builder ------------------------------ //
const builder$n = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$j = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
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
            toInt(Math.ceil(computeUnitInSamples(
                ${globs.sampleRate}, 
                ${args.maxDurationMsec},
                "msec"
            )))
        )
        if ("${args.delayName}".length) {
            ${state.funcSetDelayName}("${args.delayName}")
        }
    })
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$3 = ({ ins, state }) => `
    buf_writeSample(${state.buffer}, ${ins.$0})
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$k = ({ state, globs }) => ({
    '0_message': `
        if (msg_isAction(${globs.m}, 'clear')) {
            buf_clear(${state.buffer})
            return
        }
    `
});
// ------------------------------------------------------------------- //
const nodeImplementation$l = {
    generateLoop: generateLoop$3,
    stateVariables: stateVariables$o,
    generateMessageReceivers: generateMessageReceivers$k,
    generateDeclarations: generateDeclarations$j,
    dependencies: [computeUnitInSamples, delayBuffers, stringMsgUtils]
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
const stateVariables$n = {
    lastInput: 1,
    lastOutput: 1,
};
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$m = {
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
const makeNodeImplementation$1 = ({ generateOperation, }) => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations = ({ state, macros: { Var }, }) => `
        let ${Var(state.lastOutput, 'Float')} = 0
        let ${Var(state.lastInput, 'Float')} = 0
    `;
    // ------------------------------- generateLoop ------------------------------ //
    const generateLoop = ({ ins, state, outs }) => `
        ${state.lastOutput} = ${outs.$0} = ${generateOperation(ins.$0, ins.$1, state.lastOutput, state.lastInput)}
        ${state.lastInput} = ${ins.$0}
    `;
    return {
        generateLoop,
        stateVariables: stateVariables$n,
        generateDeclarations,
    };
};
// ------------------------------------------------------------------- //
const builders$2 = {
    'rpole~': builder$m,
    'rzero~': builder$m,
    'rzero_rev~': builder$m,
};
const nodeImplementations$2 = {
    'rpole~': makeNodeImplementation$1({
        generateOperation: (input, coeff, lastOutput) => `${input} + ${coeff} * ${lastOutput}`,
    }),
    'rzero~': makeNodeImplementation$1({
        generateOperation: (input, coeff, _, lastInput) => `${input} - ${coeff} * ${lastInput}`,
    }),
    'rzero_rev~': makeNodeImplementation$1({
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
const stateVariables$m = {
    lastInputRe: 1,
    lastInputIm: 1,
    lastOutputRe: 1,
    lastOutputIm: 1,
};
// TODO : tests + cleaner implementations
// TODO : separate cfilters with lastInputRe lastInputIm from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$l = {
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
const makeNodeImplementation = ({ generateOperationRe, generateOperationIm, }) => {
    // ------------------------------- generateDeclarations ------------------------------ //
    const generateDeclarations = ({ state, macros: { Var }, }) => `
        let ${Var(state.lastOutputRe, 'Float')} = 0
        let ${Var(state.lastOutputIm, 'Float')} = 0
        let ${Var(state.lastInputRe, 'Float')} = 0
        let ${Var(state.lastInputIm, 'Float')} = 0
    `;
    // ------------------------------- generateLoop ------------------------------ //
    const generateLoop = ({ ins, state, outs }) => `
        ${outs.$0} = ${generateOperationRe(ins.$0, ins.$1, ins.$2, ins.$3, state.lastOutputRe, state.lastOutputIm, state.lastInputRe, state.lastInputIm)}
        ${state.lastOutputIm} = ${outs.$1} = ${generateOperationIm(ins.$0, ins.$1, ins.$2, ins.$3, state.lastOutputRe, state.lastOutputIm, state.lastInputRe, state.lastInputIm)}
        ${state.lastOutputRe} = ${outs.$0}
        ${state.lastInputRe} = ${ins.$0}
        ${state.lastInputIm} = ${ins.$1}
    `;
    return {
        generateLoop,
        stateVariables: stateVariables$m,
        generateDeclarations,
    };
};
// ------------------------------------------------------------------- //
const builders$1 = {
    'cpole~': builder$l,
    'czero~': builder$l,
};
const nodeImplementations$1 = {
    'cpole~': makeNodeImplementation({
        // *outre++ = nextre + lastre * coefre - lastim * coefim
        generateOperationRe: (inputRe, _, coeffRe, coeffIm, lastOutputRe, lastOutputIm) => `${inputRe} + ${lastOutputRe} * ${coeffRe} - ${lastOutputIm} * ${coeffIm}`,
        // *outim++ = nextim + lastre * coefim + lastim * coefre;
        generateOperationIm: (_, inputIm, coeffRe, coeffIm, lastOutputRe, lastOutputIm) => `${inputIm} + ${lastOutputRe} * ${coeffIm} + ${lastOutputIm} * ${coeffRe}`,
    }),
    'czero~': makeNodeImplementation({
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
const stateVariables$l = {
    current: 1,
    previous: 1,
    coeff: 1,
    normal: 1,
};
// TODO : very inneficient compute coeff at each iter
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
    configureMessageToSignalConnection: (inletId, nodeArgs) => {
        if (inletId === '1') {
            return { initialSignalValue: nodeArgs.initValue };
        }
        return undefined;
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$i = ({ state, macros: { Var }, }) => `
    let ${Var(state.previous, 'Float')} = 0
    let ${Var(state.current, 'Float')} = 0
    let ${Var(state.coeff, 'Float')} = 0
    let ${Var(state.normal, 'Float')} = 0
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$2 = ({ ins, state, outs, globs }) => `
    ${state.coeff} = Math.min(Math.max(1 - ${ins.$1} * (2 * Math.PI) / ${globs.sampleRate}, 0), 1)
    ${state.normal} = 0.5 * (1 + ${state.coeff})
    ${state.current} = ${ins.$0} + ${state.coeff} * ${state.previous}
    ${outs.$0} = ${state.normal} * (${state.current} - ${state.previous})
    ${state.previous} = ${state.current}
`;
const nodeImplementation$k = {
    generateLoop: generateLoop$2,
    stateVariables: stateVariables$l,
    generateDeclarations: generateDeclarations$i,
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
const stateVariables$k = {
    coeff: 1,
    previous: 1,
    funcSetFreq: 1,
};
// TODO : very inneficient compute coeff at each iter
// TODO : tests + cleaner implementations
// TODO : separate rfilters with lastInput from the ones that don't need
// ------------------------------- node builder ------------------------------ //
const builder$j = {
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
const generateDeclarations$h = ({ state, macros: { Var }, }) => `
    let ${Var(state.previous, 'Float')} = 0
    let ${Var(state.coeff, 'Float')} = 0
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop$1 = ({ ins, state, outs, globs }) => `
    ${state.coeff} = Math.max(Math.min(freq * 2 * Math.PI / ${globs.sampleRate}, 1), 0)
    ${state.previous} = ${outs.$0} = ${state.coeff} * ${ins.$0} + (1 - ${state.coeff}) * ${state.previous}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$j = ({ globs, state }) => ({
    '1': coldFloatInletWithSetter(globs.m, state.funcSetFreq),
});
const nodeImplementation$j = {
    generateLoop: generateLoop$1,
    stateVariables: stateVariables$k,
    generateMessageReceivers: generateMessageReceivers$j,
    generateDeclarations: generateDeclarations$h,
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
const stateVariables$j = {
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
};
// TODO : this uses bp~ implementation, not vcf. Rewrite using pd's implementation : 
// https://github.com/pure-data/pure-data/blob/master/src/d_osc.c
// ------------------------------- node builder ------------------------------ //
const builder$i = {
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
const generateDeclarations$g = ({ state, globs, node: { args }, macros: { Var, Func } }) => `
    let ${Var(state.frequency, 'Float')} = ${args.frequency}
    let ${Var(state.Q, 'Float')} = ${args.Q}
    let ${Var(state.coef1, 'Float')} = 0
    let ${Var(state.coef2, 'Float')} = 0
    let ${Var(state.gain, 'Float')} = 0
    let ${Var(state.y, 'Float')} = 0
    let ${Var(state.ym1, 'Float')} = 0
    let ${Var(state.ym2, 'Float')} = 0

    function ${state.funcUpdateCoefs} ${Func([], 'void')} {
        let ${Var('omega', 'Float')} = ${state.frequency} * (2.0 * Math.PI) / ${globs.sampleRate}
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
`;
// ------------------------------- generateLoop ------------------------------ //
const generateLoop = ({ ins, outs, state }) => `
    ${state.funcSetFrequency}(${ins.$1})
    ${state.y} = ${ins.$0} + ${state.coef1} * ${state.ym1} + ${state.coef2} * ${state.ym2}
    ${outs.$1} = ${outs.$0} = ${state.gain} * ${state.y}
    ${state.ym2} = ${state.ym1}
    ${state.ym1} = ${state.y}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$i = ({ state, globs }) => ({
    '2': coldFloatInletWithSetter(globs.m, state.funcSetQ),
});
// ------------------------------------------------------------------- //
const nodeImplementation$i = {
    generateLoop,
    stateVariables: stateVariables$j,
    generateMessageReceivers: generateMessageReceivers$i,
    generateDeclarations: generateDeclarations$g,
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
const stateVariables$i = {
    outTemplates: 1,
    outMessages: 1,
    messageTransferFunctions: 1
};
// TODO : msg [ symbol $1 ( has the fllowing behavior :
//      sends "" when receiving a number
//      sends <string> when receiving a string
// ------------------------------- node builder ------------------------------ //
const builder$h = {
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
const generateDeclarations$f = (context) => {
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$h = ({ snds, state, globs, macros: { Var, Func }, }) => {
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
const nodeImplementation$h = { generateDeclarations: generateDeclarations$f, generateMessageReceivers: generateMessageReceivers$h, stateVariables: stateVariables$i };
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
            outTemplateCode += renderCode `
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
const stateVariables$h = {
    currentList: 1,
    splitPoint: 1,
    funcSetSplitPoint: 1
};
// TODO : implement missing list operations
// ------------------------------- node builder ------------------------------ //
const builder$g = {
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
            inlets: mapArray(countTo(inletCount), (i) => [`${i}`, { type: 'message', id: `${i}` }]),
            outlets: mapArray(countTo(outletCount), (i) => [`${i}`, { type: 'message', id: `${i}` }]),
        };
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$e = ({ state, node: { args }, macros: { Var, Func }, }) => {
    switch (args.operation) {
        case 'split':
            return `
                let ${Var(state.splitPoint, 'Int')} = ${args.operationArgs[0]}

                function ${state.funcSetSplitPoint} ${Func([
                Var('value', 'Float')
            ], 'void')} {
                    ${state.splitPoint} = toInt(value)
                }
            `;
        case 'trim':
        case 'length':
            return ``;
        case 'append':
        case 'prepend':
            return `
                let ${Var(state.currentList, 'Message')} = msg_create([])
                {
                    const ${Var('template', 'MessageTemplate')} = [${args.operationArgs.map((arg) => typeof arg === 'string' ?
                `MSG_STRING_TOKEN,${arg.length}`
                : `MSG_FLOAT_TOKEN`).join(',')}]
        
                    ${state.currentList} = msg_create(template)
        
                    ${args.operationArgs.map((arg, i) => typeof arg === 'string' ?
                `msg_writeStringToken(${state.currentList}, ${i}, "${arg}")`
                : `msg_writeFloatToken(${state.currentList}, ${i}, ${arg})`)}
                }
            `;
        default:
            throw Error(`unknown operation ${args.operation}`);
    }
};
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$g = ({ snds, globs, state, macros: { Var }, node: { args } }) => {
    const prepareInMessage = `const ${Var('inMessage', 'Message')} = msg_isBang(${globs.m}) ? msg_create([]): ${globs.m}`;
    switch (args.operation) {
        case 'split':
            return {
                '0': `
                ${prepareInMessage}
                if (msg_getLength(inMessage) < ${state.splitPoint}) {
                    ${snds.$2}(${globs.m})
                    return
                } else if (msg_getLength(inMessage) === ${state.splitPoint}) {
                    ${snds.$1}(msg_bang())
                    ${snds.$0}(${globs.m})
                    return
                }
                const ${Var('outMessage1', 'Message')} = msg_slice(inMessage, ${state.splitPoint}, msg_getLength(inMessage))
                const ${Var('outMessage0', 'Message')} = msg_slice(inMessage, 0, ${state.splitPoint})
                ${snds.$1}(msg_getLength(outMessage1) === 0 ? msg_bang(): outMessage1)
                ${snds.$0}(msg_getLength(outMessage0) === 0 ? msg_bang(): outMessage0)
                return
                `,
                '1': coldFloatInletWithSetter(globs.m, state.funcSetSplitPoint),
            };
        case 'trim':
            return {
                '0': `
                ${snds.$0}(${globs.m})
                return
                `
            };
        case 'length':
            return {
                '0': `
                if (msg_isBang(${globs.m})) {
                    ${snds.$0}(msg_floats([0]))
                } else {
                    ${snds.$0}(msg_floats([toFloat(msg_getLength(${globs.m}))]))
                }
                return
                `
            };
        case 'append':
        case 'prepend':
            const appendPrependOutMessageCode = args.operation === 'prepend' ?
                `msg_concat(${state.currentList}, ${globs.m})`
                : `msg_concat(${globs.m}, ${state.currentList})`;
            return {
                '0': `
                if (msg_isBang(${globs.m})) {
                    ${snds.$0}(msg_getLength(${state.currentList}) === 0 ? msg_bang(): ${state.currentList})
                } else {
                    ${snds.$0}(msg_getLength(${state.currentList}) === 0 && msg_getLength(${globs.m}) === 0 ? msg_bang(): ${appendPrependOutMessageCode})
                }
                return
                `,
                '1': `
                ${prepareInMessage}
                ${state.currentList} = inMessage
                return
                `
            };
        case 'length':
        default:
            throw new Error(`unknown list operation ${args.operation}`);
    }
};
// ------------------------------------------------------------------- //
const nodeImplementation$g = {
    generateMessageReceivers: generateMessageReceivers$g,
    stateVariables: stateVariables$h,
    generateDeclarations: generateDeclarations$e,
    dependencies: [bangUtils, msgUtils]
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
const stateVariables$g = {
    value: 1,
};
// TODO: proper support for $ args
// TODO: simple number - shortcut for float
// ------------------------------- node builder ------------------------------ //
const builder$f = {
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
const generateDeclarations$d = ({ node: { args }, state, macros: { Var } }) => `
    let ${Var(state.value, 'string')} = "${args.value}"
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$f = ({ snds, globs, state, }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${snds.$0}(msg_strings([${state.value}]))
        return

    } else if (msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])) {
        ${state.value} = msg_readStringToken(${globs.m}, 0)
        ${snds.$0}(msg_strings([${state.value}]))
        return

    }
    `,
    '1': `
    if (msg_isMatching(${globs.m}, [MSG_STRING_TOKEN])) {
        ${state.value} = msg_readStringToken(${globs.m}, 0)
        return 
    }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$f = {
    generateMessageReceivers: generateMessageReceivers$f,
    stateVariables: stateVariables$g,
    generateDeclarations: generateDeclarations$d,
    dependencies: [bangUtils, messageBuses]
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
const stateVariables$f = {
    busName: 1,
};
// ------------------------------- node builder ------------------------------ //
const builder$e = {
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$c = ({ state, macros: { Var }, node: { args }, }) => `
    let ${Var(state.busName, 'string')} = "${args.busName}"
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$e = ({ state, globs, }) => ({
    '0': `
    msgBusPublish(${state.busName}, ${globs.m})
    return
    `,
    '1': coldStringInlet(globs.m, state.busName)
});
// ------------------------------------------------------------------- //
const nodeImplementation$e = {
    stateVariables: stateVariables$f,
    generateDeclarations: generateDeclarations$c,
    generateMessageReceivers: generateMessageReceivers$e,
    dependencies: [messageBuses, commonsWaitEngineConfigure],
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
const stateVariables$e = {};
// ------------------------------- node builder ------------------------------ //
const builder$d = {
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
const generateDeclarations$b = ({ compilation: { codeVariableNames: { nodes } }, node: { id, args }, }) => `
    commons_waitEngineConfigure(() => {
        msgBusSubscribe("${args.busName}", ${nodes[id].snds.$0})
    })
`;
// ------------------------------------------------------------------- //
const nodeImplementation$d = {
    stateVariables: stateVariables$e,
    generateDeclarations: generateDeclarations$b,
    dependencies: [messageBuses, commonsWaitEngineConfigure],
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
const stateVariables$d = {
    operations: 1,
    buildMessage1: 1,
};
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
const sharedCode = ({ macros: { Var } }) => renderCode `
    class SoundfilerOperation {
        ${Var('url', 'string')}
        ${Var('arrayNames', 'Array<string>')}
        ${Var('resize', 'boolean')}
        ${Var('maxSize', 'Float')}
        ${Var('framesToWrite', 'Float')}
        ${Var('skip', 'Float')}
        ${Var('soundInfo', 'fs_SoundInfo')}
    }
`;
const generateDeclarations$a = ({ state, macros: { Func, Var } }) => `
    const ${Var(state.operations, 'Map<fs_OperationId, SoundfilerOperation>')} = new Map()

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
        msg_writeFloatToken(m, 0, toFloat(soundInfo.sampleRate))
        msg_writeFloatToken(m, 1, -1) // TODO IMPLEMENT headersize
        msg_writeFloatToken(m, 2, toFloat(soundInfo.channelCount))
        msg_writeFloatToken(m, 3, Math.round(toFloat(soundInfo.bitDepth) / 8))
        msg_writeStringToken(m, 4, soundInfo.endianness)
        return m
    }
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$d = ({ state, globs, snds, macros: { Func, Var } }) => ({
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
            sampleRate: toInt(${globs.sampleRate}),
            bitDepth: 32,
            encodingFormat: '',
            endianness: '',
            extraOptions: '',
        }
        const ${Var('operation', 'SoundfilerOperation')} = {
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
                const ${Var('operation', 'SoundfilerOperation')} = ${state.operations}.get(id)
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
                const ${Var('operation', 'SoundfilerOperation')} = ${state.operations}.get(id)
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
const nodeImplementation$c = {
    generateDeclarations: generateDeclarations$a,
    generateMessageReceivers: generateMessageReceivers$d,
    stateVariables: stateVariables$d,
    dependencies: [
        sharedCode,
        parseSoundFileOpenOpts,
        commonsArrays,
        fsReadSoundFile,
        fsWriteSoundFile,
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
const stateVariables$c = {};
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$c = ({ globs, node: { args } }) => ({
    '0': `
        console.log("${args.prefix} " + msg_display(${globs.m}))
        return
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$b = { generateMessageReceivers: generateMessageReceivers$c, stateVariables: stateVariables$c };

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
const stateVariables$b = {};
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$b = ({ snds, globs, node: { args: { typeArguments } } }) => ({
    '0': renderCode `
        ${typeArguments.reverse().map((typeArg, i) => `${snds[typeArguments.length - i - 1]}(${renderMessageTransfer(typeArg, globs.m, 0)})`)}
        return
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$a = {
    generateMessageReceivers: generateMessageReceivers$b,
    stateVariables: stateVariables$b,
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
const stateVariables$a = {
    currentValue: 1,
};
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$9 = ({ node, state, macros: { Var }, }) => `let ${Var(state.currentValue, 'Float')} = ${node.args.initValue}`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$a = ({ snds, globs, state, macros: { Var }, }) => ({
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
const nodeImplementation$9 = {
    generateMessageReceivers: generateMessageReceivers$a,
    stateVariables: stateVariables$a,
    generateDeclarations: generateDeclarations$9,
    dependencies: [bangUtils],
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
const stateVariables$9 = {
    threshold: 1
};
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
const generateDeclarations$8 = ({ node, state, macros: { Var }, }) => `
    let ${Var(state.threshold, 'Float')} = ${node.args.threshold}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$9 = ({ snds, globs, state, macros: { Var } }) => ({
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
const nodeImplementation$8 = { generateMessageReceivers: generateMessageReceivers$9, stateVariables: stateVariables$9, generateDeclarations: generateDeclarations$8 };

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
const stateVariables$8 = {
    minValue: 1,
    maxValue: 1,
};
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$7 = ({ node, state, macros: { Var }, }) => `
    let ${Var(state.minValue, 'Float')} = ${node.args.minValue}
    let ${Var(state.maxValue, 'Float')} = ${node.args.maxValue}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$8 = ({ snds, globs, state }) => ({
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
const nodeImplementation$7 = {
    generateMessageReceivers: generateMessageReceivers$8,
    stateVariables: stateVariables$8,
    generateDeclarations: generateDeclarations$7,
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
const stateVariables$7 = {
    filterType: 1,
    floatFilter: 1,
    stringFilter: 1,
};
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
            outlets: mapArray(args.filters.length ? countTo(args.filters.length + 1) : [0, 1], (_, i) => [`${i}`, { type: 'message', id: `${i}` }]),
        };
    },
};
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$6 = ({ node: { args }, state, macros: { Var }, }) => renderCode `
    ${renderIf(args.filters.length === 1, `
        let ${Var(state.floatFilter, 'Float')} = ${typeof args.filters[0] === 'number' ? args.filters[0] : 0}
        let ${Var(state.stringFilter, 'string')} = "${args.filters[0]}"
        let ${Var(state.filterType, 'Int')} = ${typeof args.filters[0] === 'number' ? 'MSG_FLOAT_TOKEN' : 'MSG_STRING_TOKEN'}
    `)}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$7 = ({ snds, globs, state, node: { args } }) => {
    if (args.filters.length > 1) {
        return {
            '0': renderCode `
        
            ${args.filters.map((filter, i) => renderSwitch([filter === 'float', `
                    if (msg_isFloatToken(${globs.m}, 0)) {
                        ${snds[i]}(${globs.m})
                        return
                    }
                `], [filter === 'symbol', `
                    if (msg_isStringToken(${globs.m}, 0)) {
                        ${snds[i]}(${globs.m})
                        return
                    }
                `], [filter === 'list', `
                    if (msg_getLength(${globs.m}).length > 1) {
                        ${snds[i]}(${globs.m})
                        return
                    }
                `], [filter === 'bang', `
                    if (msg_isBang(${globs.m})) {
                        ${snds[i]}(${globs.m})
                        return
                    }
                `], [typeof filter === 'number', `
                    if (
                        msg_isFloatToken(${globs.m}, 0)
                        && msg_readFloatToken(${globs.m}, 0) === ${filter}
                    ) {
                        ${snds[i]}(msg_emptyToBang(msg_shift(${globs.m})))
                        return
                    }
                `], [typeof filter === 'string', `
                    if (
                        msg_isStringToken(${globs.m}, 0) 
                        && msg_readStringToken(${globs.m}, 0) === "${filter}"
                    ) {
                        ${snds[i]}(msg_emptyToBang(msg_shift(${globs.m})))
                        return
                    }`
            ]))}

            ${snds[args.filters.length]}(${globs.m})
            return
            `
        };
    }
    else {
        return {
            '0': `
            if (${state.filterType} === MSG_STRING_TOKEN) {
                if (
                    (${state.stringFilter} === 'float'
                        && msg_isFloatToken(${globs.m}, 0))
                    || (${state.stringFilter} === 'symbol'
                        && msg_isStringToken(${globs.m}, 0))
                    || (${state.stringFilter} === 'list'
                        && msg_getLength(${globs.m}) > 1)
                    || (${state.stringFilter} === 'bang' 
                        && msg_isBang(${globs.m}))
                ) {
                    ${snds.$0}(${globs.m})
                    return
                
                } else if (
                    msg_isStringToken(${globs.m}, 0)
                    && msg_readStringToken(${globs.m}, 0) === ${state.stringFilter}
                ) {
                    ${snds.$0}(msg_emptyToBang(msg_shift(${globs.m})))
                    return
                }

            } else if (
                msg_isFloatToken(${globs.m}, 0)
                && msg_readFloatToken(${globs.m}, 0) === ${state.floatFilter}
            ) {
                ${snds.$0}(msg_emptyToBang(msg_shift(${globs.m})))
                return
            }
        
            ${snds.$1}(${globs.m})
            return
            `,
            '1': `
            ${state.filterType} = msg_getTokenType(${globs.m}, 0)
            if (${state.filterType} === MSG_STRING_TOKEN) {
                ${state.stringFilter} = msg_readStringToken(${globs.m}, 0)
            } else {
                ${state.floatFilter} = msg_readFloatToken(${globs.m}, 0)
            }
            return
            `
        };
    }
};
// ------------------------------------------------------------------- //
const nodeImplementation$6 = {
    generateMessageReceivers: generateMessageReceivers$7,
    stateVariables: stateVariables$7,
    generateDeclarations: generateDeclarations$6,
    dependencies: [bangUtils, msgUtils]
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
const stateVariables$6 = {
    isClosed: 1,
    funcSetIsClosed: 1,
};
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
const generateDeclarations$5 = ({ node, state, macros: { Var, Func }, }) => `
    let ${Var(state.isClosed, 'Float')} = ${node.args.isClosed ? 'true' : 'false'}

    function ${state.funcSetIsClosed} ${Func([
    Var('value', 'Float'),
], 'void')} {
        ${state.isClosed} = (value === 0)
    }
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$6 = ({ snds, globs, state }) => ({
    '0': `
    if (!${state.isClosed}) {
        ${snds.$0}(${globs.m})
    }
    return
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetIsClosed),
});
// ------------------------------------------------------------------- //
const nodeImplementation$5 = {
    generateMessageReceivers: generateMessageReceivers$6,
    stateVariables: stateVariables$6,
    generateDeclarations: generateDeclarations$5,
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
const stateVariables$5 = {
    continueIter: 1,
};
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
const generateDeclarations$4 = ({ state, macros: { Var }, }) => `
    let ${Var(state.continueIter, 'boolean')} = true
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$5 = ({ snds, globs, state, macros: { Var } }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${state.continueIter} = true
        while (${state.continueIter}) {
            ${snds[0]}(msg_bang())
        }
        return

    } else if (msg_isMatching(${globs.m}, [MSG_FLOAT_TOKEN])) {
        ${state.continueIter} = true
        let ${Var('maxIterCount', 'Int')} = toInt(msg_readFloatToken(${globs.m}, 0))
        let ${Var('iterCount', 'Int')} = 0
        while (${state.continueIter} && iterCount++ < maxIterCount) {
            ${snds[0]}(msg_bang())
        }
        return
    }
    `,
    '1': `
    if (msg_isBang(${globs.m})) {
        ${state.continueIter} = false
        return
    }
    `,
});
// ------------------------------------------------------------------- //
const nodeImplementation$4 = {
    generateMessageReceivers: generateMessageReceivers$5,
    stateVariables: stateVariables$5,
    generateDeclarations: generateDeclarations$4,
    dependencies: [bangUtils],
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
const stateVariables$4 = {
    maxValue: 1,
    funcSetMaxValue: 1,
};
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
const generateDeclarations$3 = ({ node, state, macros: { Var, Func }, }) => `
    let ${Var(state.maxValue, 'Float')} = ${node.args.maxValue}

    function ${state.funcSetMaxValue} ${Func([
    Var('maxValue', 'Float')
], 'void')} {
        ${state.maxValue} = Math.max(maxValue, 0)
    }
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$4 = ({ snds, globs, state }) => ({
    '0': `
    if (msg_isBang(${globs.m})) {
        ${snds['0']}(msg_floats([Math.floor(Math.random() * ${state.maxValue})]))
        return
    } else if (
        msg_isMatching(${globs.m}, [MSG_STRING_TOKEN, MSG_FLOAT_TOKEN])
        && msg_readStringToken(${globs.m}, 0) === 'seed'
    ) {
        console.log('WARNING : seed not implemented yet for [random]')
        return
    }
    `,
    '1': coldFloatInletWithSetter(globs.m, state.funcSetMaxValue),
});
// ------------------------------------------------------------------- //
const nodeImplementation$3 = {
    generateMessageReceivers: generateMessageReceivers$4,
    stateVariables: stateVariables$4,
    generateDeclarations: generateDeclarations$3,
    dependencies: [bangUtils],
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
const stateVariables$3 = {
    delay: 1,
    scheduledMessages: 1,
    outputMessages: 1,
    funcScheduleMessage: 1,
    funcSetDelay: 1,
    funcSendMessages: 1,
    funcWaitFrameCallback: 1,
    funcClear: 1,
};
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
        isPullingSignal: true,
    }),
};
// ------------------------------- dependencies ------------------------------ //
const pipeGlobalCode = ({ macros: { Var } }) => `
    class pipe_ScheduledMessage {
        ${Var('message', 'Message')}
        ${Var('frame', 'Int')}
        ${Var('skedId', 'SkedId')}
    }
`;
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations$2 = ({ state, globs, snds, node: { args }, macros: { Var, Func }, }) => renderCode `
    let ${state.delay} = 0
    const ${Var(state.outputMessages, 'Array<Message>')} = [${args.typeArguments
    .map(([_, value]) => typeof value === 'number' ?
    `msg_floats([${value}])`
    : `msg_strings(["${value}"])`).join(',')}]
    let ${Var(state.scheduledMessages, 'Array<pipe_ScheduledMessage>')} = []

    const ${state.funcScheduleMessage} = ${Func([
    Var('inMessage', 'Message')
], 'void')} => {
        let ${Var('insertIndex', 'Int')} = 0
        let ${Var('frame', 'Int')} = ${globs.frame} + ${state.delay}
        let ${Var('skedId', 'SkedId')} = SKED_ID_NULL
        let ${Var('scheduledMessage', 'pipe_ScheduledMessage')} = {
            message: msg_create([]),
            frame: frame,
            skedId: SKED_ID_NULL,
        }

        ${''
// !!! Array.splice insertion is not supported by assemblyscript, so : 
// 1. We grow arrays to their post-insertion size by using `push`
// 2. We use `copyWithin` to move old elements to their final position.
}
        while (
            insertIndex < ${state.scheduledMessages}.length 
            && ${state.scheduledMessages}[insertIndex].frame <= frame
        ) {
            insertIndex++
        }

        ${countTo(args.typeArguments.length).map(_ => `${state.scheduledMessages}.push(scheduledMessage)`)}
        ${state.scheduledMessages}.copyWithin(
            (insertIndex + 1) * ${args.typeArguments.length}, 
            insertIndex * ${args.typeArguments.length}
        )

        ${''
// If there was not yet a callback scheduled for that frame, we schedule it.
}
        if (
            insertIndex === 0 || 
            (
                insertIndex > 0 
                && ${state.scheduledMessages}[insertIndex - 1].frame !== frame
            )
        ) {
            skedId = commons_waitFrame(frame, ${state.funcWaitFrameCallback})
        }

        ${''
// Finally, schedule a message for each outlet
}
        ${args.typeArguments.reverse()
    .map(([typeArg], i) => [args.typeArguments.length - i - 1, typeArg])
    .map(([iReverse, typeArg], i) => `
                    scheduledMessage = ${state.scheduledMessages}[insertIndex + ${i}] = {
                        message: msg_create([]),
                        frame: frame,
                        skedId: skedId,
                    }
                    if (msg_getLength(inMessage) > ${iReverse}) {
                        scheduledMessage.message = ${renderMessageTransfer(typeArg, 'inMessage', iReverse)}
                        ${state.outputMessages}[${iReverse}] = scheduledMessage.message
                    } else {
                        scheduledMessage.message = ${state.outputMessages}[${iReverse}]
                    }
                `)}
    }

    const ${state.funcSendMessages} = ${Func([Var('toFrame', 'Int')], 'void')} => {
        while (
            ${state.scheduledMessages}.length 
            && ${state.scheduledMessages}[0].frame <= toFrame
        ) {
            ${countTo(args.typeArguments.length)
    .reverse()
    .map((i) => `${snds[i]}(${state.scheduledMessages}.shift().message)`)}
        }
    }

    const ${state.funcWaitFrameCallback} = ${Func([
    Var('event', 'SkedEvent')
], 'void')} => {
        ${state.funcSendMessages}(${globs.frame})
    }

    const ${state.funcClear} = ${Func([], 'void')} => {
        let ${Var('i', 'Int')} = 0
        const ${Var('length', 'Int')} = ${state.scheduledMessages}.length
        for (i; i < length; i++) {
            commons_cancelWaitFrame(${state.scheduledMessages}[i].skedId)
        }
        ${state.scheduledMessages} = []
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$3 = ({ node, snds, globs, state }) => ({
    '0': renderCode `
    if (msg_isBang(${globs.m})) {
        ${state.funcScheduleMessage}(msg_create([]))
        return

    } else if (msg_isAction(${globs.m}, 'clear')) {
        ${state.funcClear}()
        return 

    } else if (msg_isAction(${globs.m}, 'flush')) {
        if (${state.scheduledMessages}.length) {
            ${state.funcSendMessages}(${state.scheduledMessages}[${state.scheduledMessages}.length - 1].frame)
        }
        return

    } else {
        ${state.funcScheduleMessage}(${globs.m})
        return
    }
    `,
    ...mapArray(node.args.typeArguments.slice(1), ([typeArg], i) => [
        `${i + 1}`,
        `${state.outputMessages}[${i + 1}] = ${renderMessageTransfer(typeArg, globs.m, 0)}
            return`
    ]),
    [node.args.typeArguments.length]: coldFloatInletWithSetter(globs.m, state.funcSetDelay)
});
// ------------------------------------------------------------------- //
const nodeImplementation$2 = {
    generateMessageReceivers: generateMessageReceivers$3,
    stateVariables: stateVariables$3,
    generateDeclarations: generateDeclarations$2,
    dependencies: [
        pipeGlobalCode,
        messageTokenToFloat,
        messageTokenToString,
        bangUtils,
        stringMsgUtils,
        commonsWaitEngineConfigure,
        commonsWaitFrame,
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
const stateVariables$2 = {
    floatValues: 1,
    stringValues: 1,
};
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
const generateDeclarations$1 = ({ node: { args }, state, macros: { Var }, }) => renderCode `
    const ${Var(state.floatValues, 'Array<Float>')} = [${args.typeArguments.map(([typeArg, defaultValue]) => `${typeArg === 'float' ? defaultValue : 0}`).join(',')}]
    const ${Var(state.stringValues, 'Array<string>')} = [${args.typeArguments.map(([typeArg, defaultValue]) => `${typeArg === 'symbol' ? `"${defaultValue}"` : '""'}`).join(',')}]
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$2 = ({ snds, globs, state, node, macros: { Var } }) => ({
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
const nodeImplementation$1 = {
    generateMessageReceivers: generateMessageReceivers$2,
    stateVariables: stateVariables$2,
    generateDeclarations: generateDeclarations$1,
    dependencies: [messageTokenToString, messageTokenToFloat, bangUtils]
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
const stateVariables$1 = {};
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
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers$1 = ({ snds, globs, node: { args } }) => ({
    '0': renderCode `
    ${args.typeArguments.map((t, i) => [t, i]).reverse().map(([t, reversedI]) => `
            if (
                msg_getLength(${globs.m}) >= ${reversedI + 1}
            ) {
                if (msg_getTokenType(${globs.m}, ${reversedI}) === ${t === 'float' ? 'MSG_FLOAT_TOKEN' : 'MSG_STRING_TOKEN'}) {
                    ${renderSwitch([t === 'float', `${snds[reversedI]}(msg_floats([msg_readFloatToken(${globs.m}, ${reversedI})]))`], [t === 'symbol', `${snds[reversedI]}(msg_strings([msg_readStringToken(${globs.m}, ${reversedI})]))`])}
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
    generateMessageReceivers: generateMessageReceivers$1,
    stateVariables: stateVariables$1,
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
const stateVariables = {
    floatInputs: 1,
    stringInputs: 1,
    outputs: 1,
};
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
// ------------------------------- generateDeclarations ------------------------------ //
const generateDeclarations = ({ node: { args, type }, state, macros: { Var }, }) => {
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
// ------------------------------- generateLoop ------------------------------ //
const loopExprTilde = ({ node: { args }, state, outs, ins, }) => `
    ${args.tokenizedExpressions.map((tokens, i) => `${outs[i]} = ${renderTokenizedExpression(state, ins, tokens)}`)}
`;
// ------------------------------- generateMessageReceivers ------------------------------ //
const generateMessageReceivers = ({ snds, globs, state, node: { args, type }, macros: { Var }, }) => {
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
const nodeImplementations = {
    'expr': {
        generateMessageReceivers,
        stateVariables,
        generateDeclarations,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            commonsArrays,
        ],
    },
    'expr~': {
        generateMessageReceivers,
        stateVariables,
        generateDeclarations,
        generateLoop: loopExprTilde,
        dependencies: [
            messageTokenToString,
            messageTokenToFloat,
            roundFloatAsPdInt,
            bangUtils,
            commonsArrays,
        ],
    },
};
const builders = {
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
const NODE_BUILDERS = {
    ...nodeBuilders,
    ...builders$4,
    ...builders$8,
    ...builders$9,
    ...builders$2,
    ...builders$1,
    ...builders$3,
    'noise~': builder$p,
    'snapshot~': builder$L,
    'sig~': builder$U,
    'samphold~': builder$M,
    'clip~': builder$N,
    'vline~': builder$K,
    'line~': builder$J,
    'dac~': builder$R,
    'adc~': builder$Q,
    'samplerate~': builder$P,
    'tabplay~': builder$F,
    'readsf~': builder$E,
    'writesf~': builder$D,
    'vd~': { aliasTo: 'delread4~' },
    'bp~': builder$C,
    'hip~': builder$k,
    'lop~': builder$j,
    'vcf~': builder$i,
    'delwrite~': builder$n,
    'throw~': builder$B,
    'catch~': builder$A,
    'send~': builder$z,
    's~': { aliasTo: 'send~' },
    'receive~': builder$y,
    'r~': { aliasTo: 'receive~' },
    ...builders$b,
    ...builders$7,
    ...builders$a,
    ...builders$5,
    ...builders$6,
    ...builders,
    bang: builder$u,
    bng: { aliasTo: 'bang' },
    b: { aliasTo: 'bang' },
    list: builder$g,
    symbol: builder$f,
    loadbang: builder$s,
    send: builder$e,
    s: { aliasTo: 'send' },
    receive: builder$d,
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
    msg: builder$h,
    metro: builder$x,
    timer: builder$w,
    delay: builder$v,
    del: { aliasTo: 'delay' },
    line: builder$I,
    soundfiler: builder$c,
    tabread: builder$G,
    tabwrite: builder$S,
    // The following are internal nodes used by the compiler
    // to help reproduce Pd's behavior
    '_mixer~': builder$V,
    '_routemsg': builder$T,
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
    ...nodeImplementations$4,
    ...nodeImplementations$8,
    ...nodeImplementations$9,
    ...nodeImplementations$2,
    ...nodeImplementations$1,
    ...nodeImplementations$3,
    'noise~': nodeImplementation$m,
    'snapshot~': nodeImplementation$E,
    'sig~': nodeImplementation$M,
    'samphold~': nodeImplementation$F,
    'clip~': nodeImplementation$G,
    'vline~': nodeImplementation$D,
    'line~': nodeImplementation$C,
    'dac~': nodeImplementation$J,
    'adc~': nodeImplementation$I,
    'samplerate~': nodeImplementation$H,
    'tabplay~': nodeImplementation$z,
    'readsf~': nodeImplementation$y,
    'writesf~': nodeImplementation$x,
    'delwrite~': nodeImplementation$l,
    'bp~': nodeImplementation$w,
    'hip~': nodeImplementation$k,
    'lop~': nodeImplementation$j,
    'vcf~': nodeImplementation$i,
    'throw~': nodeImplementation$v,
    'catch~': nodeImplementation$u,
    'send~': nodeImplementation$t,
    'receive~': nodeImplementation$s,
    ...nodeImplementations$b,
    ...nodeImplementations$7,
    ...nodeImplementations$a,
    ...nodeImplementations$6,
    ...nodeImplementations$5,
    ...nodeImplementations,
    bang: nodeImplementation$o,
    list: nodeImplementation$g,
    symbol: nodeImplementation$f,
    send: nodeImplementation$e,
    receive: nodeImplementation$d,
    loadbang: nodeImplementation$n,
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
    msg: nodeImplementation$h,
    metro: nodeImplementation$r,
    timer: nodeImplementation$q,
    delay: nodeImplementation$p,
    line: nodeImplementation$B,
    tabread: nodeImplementation$A,
    tabwrite: nodeImplementation$K,
    soundfiler: nodeImplementation$c,
    // Internal nodes
    '_mixer~': nodeImplementation$N,
    '_routemsg': nodeImplementation$L,
};

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

const workerSafePerformBuildStep = async (artefacts, step, workerSafeBuildSettings) => {
    const settings = {
        audioSettings: workerSafeBuildSettings.audioSettings,
        nodeBuilders: NODE_BUILDERS,
        nodeImplementations: NODE_IMPLEMENTATIONS,
        inletCallerSpecs: workerSafeBuildSettings.inletCallerSpecs,
        abstractionLoader: workerSafeBuildSettings.rootUrl
            ? makeUrlAbstractionLoader(workerSafeBuildSettings.rootUrl)
            : localAbstractionLoader,
    };
    return performBuildStep(artefacts, step, settings);
};
const makeUrlAbstractionLoader = (rootUrl) => {
    return makeAbstractionLoader(async (nodeType) => {
        const url = rootUrl +
            '/' +
            (nodeType.endsWith('.pd') ? nodeType : `${nodeType}.pd`);
        console.log('LOADING ABSTRACTION', url);
        const response = await fetch(url);
        if (!response.ok) {
            console.log('ERROR LOADING ABSTRACTION', url);
            throw new UnknownNodeTypeError(nodeType);
        }
        return await response.text();
    });
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
