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
import { generateCSRWithExistingKeys } from './crypt/csr.js';

const CONTENT_TYPE = "Content-Type";

const DIGEST = "sha256";
const ALG_ECDSA = 'ES256';

const CONTENT_TYPE_JOSE = 'application/jose+json';

const METHOD_GET = "GET";
const METHOD_POST = "POST";
const METHOD_HEAD = "HEAD";
const METHOD_POST_AS_GET = "";
const METHOD_POST_AS_GET_CHALLENGE = {};

const SAN = "identifiers";
const NEXT_URL = "location";
const REPLAY_NONCE = 'replay-nonce';

export async function newDirectoryAsync(mainDirectoryUrl) {
    return new Promise((resolve) => {
        fetch(mainDirectoryUrl, { method: METHOD_GET }).then(response => {
            response.ok
                ? response.json().then((result) => { resolve({ answer: { directory: result } }); }).catch((exception) => resolve({ answer: { exception: exception } }))
                : resolve({ answer: { error: response } });
        }).catch((exception) => resolve({ answer: { exception: exception } }));
    });
}

export async function newNonceAsync(newNonceUrl) {
    let nonceUrl = newNonceUrl;

    if (newNonceUrl == undefined) {
        const directory = (await newDirectoryAsync()).answer.directory;
        if (directory !== null) {
            nonceUrl = directory.newNonce;
        }
    }

    if (nonceUrl !== null) {
        return new Promise(async (resolve) => {
            fetch(nonceUrl, {
                method: METHOD_HEAD
            }).then((response) => response.ok
                ? resolve({ answer: { response: response }, nonce: response.headers.get(REPLAY_NONCE) })
                : resolve({ answer: { error: response } }))
                .catch((exception) => resolve({ answer: { exception: exception } }));;
        });
    } else {
        return { answer: { error: "No directories found or newNonce is not available." } };
    }
}

export async function createJsonWebKey(publicKey) {
    const jsonWebKey = await jose.exportJWK(publicKey);

    return { key: jsonWebKey, print: await jose.calculateJwkThumbprint(jsonWebKey, DIGEST) };
}

export async function createAccount(nonce, newAccountUrl, privateKey, jsonWebKey) {
    try {
        const payload = { termsOfServiceAgreed: true };

        const protectedHeader = {
            alg: ALG_ECDSA,
            jwk: jsonWebKey,
            nonce: nonce,
            url: newAccountUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, privateKey);

        const response = await fetchRequest(METHOD_POST, newAccountUrl, signed);

        if (response.ok) {
            return {
                answer: { account: await response.json(), location: response.headers.get(NEXT_URL) },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function createOrder(kid, nonce, privateKey, newOrderUrl, identifiers) {
    try {
        const payload = { [SAN]: identifiers };

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: newOrderUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, privateKey);

        const response = await fetchRequest(METHOD_POST, newOrderUrl, signed);

        if (response.ok) {
            return {
                answer: { order: await response.json(), location: response.headers.get(NEXT_URL) },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function finalizeOrder(commonName, kid, nonce, privateKey, publicKeySign, privateKeySign, finalizeUrl, dnsNames) {
    try {
        const payload = { csr: await generateCSRWithExistingKeys(commonName, publicKeySign, privateKeySign, dnsNames, jose) };

        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: finalizeUrl,
        };

        const signed = await signPayloadJson(payload, protectedHeader, privateKey);

        const response = await fetchRequest(METHOD_POST, finalizeUrl, signed);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get(NEXT_URL) },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function postAsGet(kid, nonce, privateKey, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const signed = await signPayload(METHOD_POST_AS_GET, protectedHeader, privateKey);

        const response = await fetchRequest(METHOD_POST, url, signed);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get(NEXT_URL) },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function postAsGetChal(kid, nonce, privateKey, url) {
    try {
        const protectedHeader = {
            alg: ALG_ECDSA,
            kid: kid,
            nonce: nonce,
            url: url,
        };

        const signed = await signPayloadJson(METHOD_POST_AS_GET_CHALLENGE, protectedHeader, privateKey);

        const response = await fetchRequest(METHOD_POST, url, signed);

        if (response.ok) {
            return {
                answer: { get: await response.json(), location: response.headers.get(NEXT_URL) },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: await response.json() },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function signPayloadJson(payload, protectedHeader, privateKey) {
    return await signPayload(JSON.stringify(payload), protectedHeader, privateKey);
}

export async function signPayload(payload, protectedHeader, privateKey) {
    const jws = new jose.FlattenedSign(new TextEncoder().encode(payload));
    jws.setProtectedHeader(protectedHeader);
    return JSON.stringify(await jws.sign(privateKey));
}

export async function fetchRequest(method, url, signedData) {
    const request = {
        method: method,
        headers: {
            [CONTENT_TYPE]: CONTENT_TYPE_JOSE
        },
        body: signedData
    };

    return await fetch(url, request);
}