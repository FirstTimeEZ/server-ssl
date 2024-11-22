import * as jose from './jose/index.js';
// This isn't finished and does not generate certificates
// Anything might change until its finished

// anything that replies with a usable reply nonce returns this structure
// { answer: { any: any }, nonce: replay-nonce, error: whenApplicable }

export async function newDirectoryAsync() {
    return new Promise((resolve, reject) => {
        fetch("https://acme-staging-v02.api.letsencrypt.org/directory", {
            method: "GET"
        }).then(response => !response.ok ? resolve(null) : resolve(response.json())).catch(() => reject(null));
    });
}

export async function newNonceAsync(newNonceUrl) {
    let nonceUrl = newNonceUrl;

    if (newNonceUrl == undefined) {
        const directory = await newDirectoryAsync();
        nonceUrl = directory.newNonce;
    }

    if (nonceUrl !== null) {
        return new Promise(async (resolve, reject) => {
            fetch(nonceUrl, {
                method: "HEAD"
            }).then((response) => !response.ok ? resolve(null) : resolve({ answer: { response: response }, nonce: response.headers.get('replay-nonce') })).catch(() => reject(null));
        });
    } else {
        return { answer: { error: "No directories found or newNonce is not available." }, nonce: null };
    }
}

export async function createAccount(nonce, newAccountUrl) {
    const { publicKey, privateKey } = await jose.generateKeyPair('ES256', { extractable: true });

    const jwk = await jose.exportJWK(publicKey);

    const payload = { termsOfServiceAgreed: true };
    const protectedHeader = {
        alg: "ES256",
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
            'Content-Type': 'application/jose+json'
        },
        body: JSON.stringify(signed)
    };

    const response = await fetch(newAccountUrl, request);

    if (response.ok) {
        return {
            answer: { account: await response.json(), location: response.headers.get('location') },
            nonce: response.headers.get('replay-nonce')
        };
    }
    else {
        const errorData = await response.text();
        return {
            answer: { error: errorData },
            nonce: null
        };
    }
}

export async function startLetsEncryptDaemon() {
    const directory = await newDirectoryAsync();

    if (directory !== null) {
        const nonce = await newNonceAsync(directory.newNonce);

        if (nonce.nonce !== null) {
            const account = await createAccount(nonce.nonce, directory.newAccount).catch(console.error);

            if (account.answer.account.status == "valid") {
                console.log("Account Created and Valid", account.answer);
            }

            console.log("Next Nonce", account.nonce);
        }
        else {
            console.log("Error getting nonce", nonce.answer.error)
        }
    }
}
