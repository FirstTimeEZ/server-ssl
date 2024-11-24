/**
 * Copyright © 2024 FirstTimeEZ
 * https://github.com/FirstTimeEZ
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const TAGS = {
    BOOLEAN: 0x01,                  // BOOLEAN
    INTEGER: 0x02,                  // INTEGER
    BIT_STRING: 0x03,               // BIT STRING
    OCTET_STRING: 0x04,             // OCTET STRING
    NULL: 0x05,                     // NULL
    OBJECT_IDENTIFIER: 0x06,        // OBJECT IDENTIFIER
    REAL: 0x09,                     // REAL
    ENUMERATED: 0x0A,               // ENUMERATED
    UTF8String: 0x0C,               // UTF8String
    SEQUENCE: 0x30,                 // SEQUENCE
    SET: 0x31,                      // SET
    PRINTABLE_STRING: 0x13,         // PrintableString
    IA5String: 0x16,                // IA5String
    T61String: 0x14,                // T61String
    GRAPHIC_STRING: 0x19,           // GraphicString
    VIDEOTEX_STRING: 0x1A,          // VideotexString
    GENERALIZED_TIME: 0x18,         // GeneralizedTime
    UTC_TIME: 0x17,                 // UTCTime
    BMP_STRING: 0x1E,               // BMPString
    ZERO: 0x00,                     // Zero
    CONTEXT_SPECIFIC_ZERO: 0xA0     // ContextSpecificZero
};

export function encodeDERBitString(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.concat([
        Buffer.from([0x03]),
        encodeDERLength(buffer.length + 1),
        Buffer.from([TAGS.ZERO]),
        buffer
    ]);
}

export function encodeDERAttribute(oid, value) {
    const oidBuffer = encodeDERObjectIdentifier(oid);
    const valueBuffer = Buffer.from(value, 'utf8');
    const stringValue = Buffer.concat([
        Buffer.from([TAGS.UTF8String]),
        encodeDERLength(valueBuffer.length),
        valueBuffer
    ]);

    return encodeDERSequence([
        oidBuffer,
        stringValue
    ]);
}

export function encodeDERSequence(elements) {
    const totalLength = elements.reduce((sum, el) => sum + el.length, 0);
    return Buffer.concat([
        Buffer.from([TAGS.SEQUENCE]),
        encodeDERLength(totalLength),
        ...elements
    ]);
}

export function encodeDERSet(elements) {
    const totalLength = elements.reduce((sum, el) => sum + el.length, 0);
    return Buffer.concat([
        Buffer.from([TAGS.SET]),
        encodeDERLength(totalLength),
        ...elements
    ]);
}

export function encodeDERContextSpecific(tag, value) {
    return Buffer.concat([
        Buffer.from([TAGS.CONTEXT_SPECIFIC_ZERO | tag]),
        encodeDERLength(value.length),
        value
    ]);
}

export function encodeDERLength(length) {
    if (length < 128) {
        return Buffer.from([length]);
    }

    const bytes = [];
    let temp = length;
    while (temp > 0) {
        bytes.unshift(temp & 0xFF);
        temp = temp >> 8;
    }
    bytes.unshift(bytes.length | 0x80);
    return Buffer.from(bytes);
}

export function encodeDERObjectIdentifier(oid) {
    const numbers = oid.split('.').map(Number);
    if (numbers.length < 2) {
        throw new Error('Invalid OID: must have at least 2 components');
    }

    const first = numbers[0] * 40 + numbers[1];
    const encoded = [first];

    for (let i = 2; i < numbers.length; i++) {
        let number = numbers[i];
        if (number < 0) {
            throw new Error('Invalid OID: negative numbers not allowed');
        }

        if (number < 128) {
            encoded.push(number);
        } else {
            const bytes = [];
            while (number > 0) {
                bytes.unshift((number & 0x7F) | (bytes.length ? 0x80 : 0));
                number = number >> 7;
            }
            encoded.push(...bytes);
        }
    }

    return Buffer.concat([
        Buffer.from([TAGS.OBJECT_IDENTIFIER]),
        Buffer.from([encoded.length]),
        Buffer.from(encoded)
    ]);
}

export function encodeDEROctetString(data) {
    return Buffer.concat([
        Buffer.from([TAGS.OCTET_STRING]),
        encodeDERLength(data.length),
        data
    ]);
}

export function readDERLength(buffer) {
    if (buffer[0] < 128) return buffer[0];

    const numBytes = buffer[0] & 0x7F;
    let length = 0;

    for (let i = 1; i <= numBytes; i++) {
        length = (length << 8) | buffer[i];
    }

    return length;
}

export function skipDERLength(buffer) {
    if (buffer[0] < 128) return 1;
    return (buffer[0] & 0x7F) + 1;
}

export function extractECPoint(derKey) {
    let offset = 0;

    if (derKey[offset++] !== TAGS.SEQUENCE) throw new Error('Expected sequence');
    offset += skipDERLength(derKey.slice(offset));

    if (derKey[offset++] !== TAGS.SEQUENCE) throw new Error('Expected algorithm sequence');
    const algLength = readDERLength(derKey.slice(offset));
    offset += skipDERLength(derKey.slice(offset)) + algLength;

    if (derKey[offset++] !== 0x03) throw new Error('Expected bit string');
    const bitStringLength = readDERLength(derKey.slice(offset));
    offset += skipDERLength(derKey.slice(offset));

    offset++;

    const remainingLength = bitStringLength - 1;
    if (remainingLength !== derKey.length - offset) {
        throw new Error('Invalid bit string length for EC point');
    }

    if (derKey[offset] !== TAGS.OCTET_STRING) {
        throw new Error('Expected uncompressed EC point (TAGS.OCTET_STRING)');
    }

    const point = derKey.slice(offset + 1, offset + remainingLength);

    if (point.length !== 64) {
        throw new Error(`Invalid EC point length: ${point.length} (expected 64 bytes)`);
    }

    return point;
}