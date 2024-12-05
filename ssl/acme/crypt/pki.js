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

import { TAGS } from './asn1.js';
import * as asn from './asn1.js';

export function extractECPoint(derKey) {
    let offset = 0;

    if (derKey[offset++] !== TAGS.SEQUENCE) throw new Error('Expected sequence');
    offset += asn.skipDERLength(derKey.slice(offset));

    if (derKey[offset++] !== TAGS.SEQUENCE) throw new Error('Expected algorithm sequence');
    const algLength = asn.readDERLength(derKey.slice(offset));
    offset += asn.skipDERLength(derKey.slice(offset)) + algLength;

    if (derKey[offset++] !== 0x03) throw new Error('Expected bit string');
    const bitStringLength = asn.readDERLength(derKey.slice(offset));
    offset += asn.skipDERLength(derKey.slice(offset));

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