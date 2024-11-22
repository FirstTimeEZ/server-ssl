import * as jose from './jose/index.js';

// This isn't finished and does not generate certificates
// Anything might change until its finished

// anything that replies with a usable reply nonce returns this structure on success
// resolve { answer: { any: any }, nonce: replay-nonce }

// answer should include any response that is not ok as error
// { answer: { error: response } }

// answer should include exceptions as exception
// { answer: { exception: exception } }

const DIRECTORY_URL = "https://acme-staging-v02.api.letsencrypt.org/directory";

const ALG_ECDSA = 'ES256';

const CONTENT_TYPE_JOSE = 'application/jose+json';

const REPLAY_NONCE = 'replay-nonce';

export async function newDirectoryAsync() {
    return new Promise((resolve) => {
        fetch(DIRECTORY_URL, { method: "GET" }).then(response => {
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
                method: "HEAD"
            }).then((response) => response.ok
                ? resolve({ answer: { response: response }, nonce: response.headers.get(REPLAY_NONCE) })
                : resolve({ answer: { error: response } }))
                .catch((exception) => resolve({ answer: { exception: exception } }));;
        });
    } else {
        return { answer: { error: "No directories found or newNonce is not available." } };
    }
}

export async function createAccount(nonce, newAccountUrl) {
    try {
        const { publicKey, privateKey } = await jose.generateKeyPair(ALG_ECDSA, { extractable: true });

        const jwk = await jose.exportJWK(publicKey);

        const payload = { termsOfServiceAgreed: true };
        const protectedHeader = {
            alg: ALG_ECDSA,
            jwk,
            nonce: nonce,
            url: newAccountUrl,
        };

        const jws = new jose.FlattenedSign(new TextEncoder().encode(JSON.stringify(payload)));
        jws.setProtectedHeader(protectedHeader);
        const signed = await jws.sign(privateKey);

        const request = {
            method: 'POST',
            headers: {
                'Content-Type': CONTENT_TYPE_JOSE
            },
            body: JSON.stringify(signed)
        };

        const response = await fetch(newAccountUrl, request);

        if (response.ok) {
            return {
                answer: { account: await response.json(), location: response.headers.get('location') },
                nonce: response.headers.get(REPLAY_NONCE)
            };
        }
        else {
            return {
                answer: { error: response },
                nonce: null
            };
        }
    } catch (exception) {
        return { answer: { exception: exception } }
    }
}

export async function startLetsEncryptDaemon() {
    console.log("Starting Lets Encrypt Daemon!");

    const directory = (await newDirectoryAsync()).answer.directory;

    if (directory !== null) {
        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            const account = await createAccount(nonce.nonce, directory.newAccount).catch(console.error);

            if (account.answer.account && account.answer.account.status == "valid") {
                console.log("Account Created and Valid", account.answer);
                console.log("Next Nonce", account.nonce);
            }
            else {
                console.error("Error creating account", account.answer.error, account.answer.exception);
            }
        }
        else {
            console.error("Error getting nonce", nonce.answer.error, nonce.answer.exception);
        }
    }
    else {
        console.error("Error getting directory", directory.answer.error, directory.answer.exception);
    }
}
