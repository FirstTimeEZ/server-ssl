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

import * as jose from './jose/index.js';
import { createPrivateKey, createPublicKey, sign } from 'crypto';

/**
 * Generates a Certificate Signing Request (CSR) using existing public and private key pairs.
 * The function creates a CSR in DER format, encoded as base64url string, following the PKCS#10 specification.
 * 
 * @async
 * @param {string} commonName - The common name (CN) to be included in the CSR subject field.
 *                             This typically represents the domain name or entity the certificate is for.
 * @param {CryptoKey} publicKey - The public key to be included in the CSR. Must be an ECDSA public key
 *                                in the form of a CryptoKey object.
 * @param {CryptoKey} privateKey - The private key used to sign the CSR. Must be an ECDSA private key
 *                                 corresponding to the provided public key.
 * 
 * @returns {Promise<string>} A Promise that resolves to the base64url-encoded DER format CSR.
 * 
 * @throws {Error} If CSR generation fails, with the specific error message included.
 * 
 * @requires jose - For key export operations
 * @requires node:crypto - For createPrivateKey and signing operations
 * 
 * @description 
 * The CSR is generated using ECDSA with SHA-256 as the signature algorithm.
 * The resulting CSR follows the PKCS#10 specification (RFC 2986).
 * 
 * @note The function assumes the provided keys are valid ECDSA keys and the
 *       required helper functions (encodeDERSequence, encodeDERSet, etc.) are available
 *       in the scope.
 * 
 * @security This function handles sensitive cryptographic operations and private key material.
 *          Ensure proper key management and security practices are followed when using this function.
 */
export async function generateCSRWithExistingKeys(commonName, publicKey, privateKey) {
    try {
        const publicKeySpki = await jose.exportSPKI(publicKey);
        const privateKeyPkcs8 = await jose.exportPKCS8(privateKey);

        const privKeyObj = createPrivateKey(privateKeyPkcs8);

        const subject = encodeDERSequence([
            encodeDERSet([
                encodeDERAttribute('2.5.4.3', commonName)
            ])
        ]);

        // Create the certification request info
        const certificationRequestInfo = encodeDERSequence([
            Buffer.from([0x02, 0x01, 0x00]),              // version
            subject,                                       // subject (now properly wrapped)
            await encodeSubjectPublicKeyInfo(publicKeySpki), // pki
            encodeDERContextSpecific(0, Buffer.alloc(0))   // attributes (empty SET)
        ]);

        const signature = await signData(certificationRequestInfo, privKeyObj);

        const signatureAlgorithm = encodeDERSequence([
            encodeDERObjectIdentifier('1.2.840.10045.4.3.2'),  // ecdsa-with-SHA256
            Buffer.from([0x05, 0x00])                          // NULL
        ]);

        const csrDER = encodeDERSequence([
            certificationRequestInfo,
            signatureAlgorithm,
            encodeDERBitString(signature)
        ]);

        return csrDER.toString('base64url');
    } catch (error) {
        throw new Error(`Failed to generate CSR: ${error.message}`);
    }
}

async function encodeSubjectPublicKeyInfo(publicKeyDER) {
    try {
        let derKey = publicKeyDER;
        if (typeof publicKeyDER === 'string' && publicKeyDER.includes('-----BEGIN PUBLIC KEY-----')) {
            const pemContent = publicKeyDER
                .replace('-----BEGIN PUBLIC KEY-----', '')
                .replace('-----END PUBLIC KEY-----', '')
                .replace(/\s+/g, '');
            derKey = Buffer.from(pemContent, 'base64');
        }

        // Create a temporary key to extract the proper point encoding
        const tempKey = createPublicKey({
            key: Buffer.from(derKey),
            format: 'der',
            type: 'spki'
        });

        // Export the key in the correct format
        const rawKey = tempKey.export({
            format: 'der',
            type: 'spki'
        });

        // Extract the EC point from the raw key
        const ecPoint = extractECPoint(rawKey);

        return encodeDERSequence([
            encodeDERSequence([
                encodeDERObjectIdentifier('1.2.840.10045.2.1'),    // id-ecPublicKey
                encodeDERObjectIdentifier('1.2.840.10045.3.1.7')   // secp256r1
            ]),
            encodeDERBitString(Buffer.concat([
                Buffer.from([0x04]),  // Uncompressed point indicator
                ecPoint
            ]))
        ]);
    } catch (error) {
        throw new Error(`Failed to encode SubjectPublicKeyInfo: ${error.message}`);
    }
}

function signData(data, privateKey) {
    return new Promise((resolve, reject) => {
        sign('sha256', data, privateKey, (err, sig) => {
            if (err) reject(new Error(`Signing failed: ${err.message}`));
            resolve(sig);
        });
    });
}

function encodeDERBitString(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return Buffer.concat([
        Buffer.from([0x03]),
        encodeDERLength(buffer.length + 1),
        Buffer.from([0x00]),
        buffer
    ]);
}

function encodeDERAttribute(oid, value) {
    const oidBuffer = encodeDERObjectIdentifier(oid);
    const valueBuffer = Buffer.from(value, 'utf8');
    const stringValue = Buffer.concat([
        Buffer.from([0x0c]),
        encodeDERLength(valueBuffer.length),
        valueBuffer
    ]);

    return encodeDERSequence([
        oidBuffer,
        stringValue
    ]);
}

function encodeDERSequence(elements) {
    const totalLength = elements.reduce((sum, el) => sum + el.length, 0);
    return Buffer.concat([
        Buffer.from([0x30]),
        encodeDERLength(totalLength),
        ...elements
    ]);
}

function encodeDERSet(elements) {
    const totalLength = elements.reduce((sum, el) => sum + el.length, 0);
    return Buffer.concat([
        Buffer.from([0x31]),
        encodeDERLength(totalLength),
        ...elements
    ]);
}

function encodeDERContextSpecific(tag, value) {
    return Buffer.concat([
        Buffer.from([0xa0 | tag]),
        encodeDERLength(value.length),
        value
    ]);
}

function encodeDERLength(length) {
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

function encodeDERObjectIdentifier(oid) {
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
        Buffer.from([0x06]),
        Buffer.from([encoded.length]),
        Buffer.from(encoded)
    ]);
}

function readDERLength(buffer) {
    if (buffer[0] < 128) return buffer[0];

    const numBytes = buffer[0] & 0x7F;
    let length = 0;

    for (let i = 1; i <= numBytes; i++) {
        length = (length << 8) | buffer[i];
    }

    return length;
}

function skipDERLength(buffer) {
    if (buffer[0] < 128) return 1;
    return (buffer[0] & 0x7F) + 1;
}

function extractECPoint(derKey) {
    let offset = 0;

    // Skip initial SEQUENCE
    if (derKey[offset++] !== 0x30) throw new Error('Expected sequence');
    offset += skipDERLength(derKey.slice(offset));

    // Skip AlgorithmIdentifier SEQUENCE
    if (derKey[offset++] !== 0x30) throw new Error('Expected algorithm sequence');
    const algLength = readDERLength(derKey.slice(offset));
    offset += skipDERLength(derKey.slice(offset)) + algLength;

    // Read BIT STRING
    if (derKey[offset++] !== 0x03) throw new Error('Expected bit string');
    const bitStringLength = readDERLength(derKey.slice(offset));
    offset += skipDERLength(derKey.slice(offset));

    // Skip unused bits byte
    offset++;

    // The remaining data should be the EC point (including 0x04 prefix)
    // Validate that the remaining length matches what we expect
    const remainingLength = bitStringLength - 1; // -1 for unused bits byte
    if (remainingLength !== derKey.length - offset) {
        throw new Error('Invalid bit string length for EC point');
    }

    // Verify that the point starts with 0x04 (uncompressed point format)
    if (derKey[offset] !== 0x04) {
        throw new Error('Expected uncompressed EC point (0x04)');
    }

    // Extract the actual point (skip the 0x04 prefix)
    const point = derKey.slice(offset + 1, offset + remainingLength);

    // For secp256r1, the point should be 64 bytes (32 bytes for x + 32 bytes for y)
    if (point.length !== 64) {
        throw new Error(`Invalid EC point length: ${point.length} (expected 64 bytes)`);
    }

    return point;
}