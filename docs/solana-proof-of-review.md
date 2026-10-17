# Solana Devnet Proof of Review (experimental)

This feature adds a **hybrid, client-side Solana Devnet proof** to Announcement Review. The existing market-feed pipeline and local review data remain unchanged.

## How to use
1. Open Workspace, create a review and mark it **Reviewed**.
2. Open the review detail and choose **Publish / verify proof**.
3. In `proof.html`, select the record. The browser hashes a canonical JSON object with SHA-256.
4. Use a Solana wallet extension supporting `window.solana.connect()` and `signTransaction()`, configured for **Devnet** with Devnet SOL.
5. Publish. The wallet signs a transaction invoking Solana's **Memo program** with `AR-PROOF-V1:<64 lowercase hex chars>`.
6. Paste a Devnet transaction signature into the verifier. The verifier fetches the confirmed transaction, checks for a correctly formatted Memo instruction and compares the digest with the selected local review.

## What the proof means
- The transaction establishes that a wallet submitted a digest to Devnet, and permits comparison against the review content available to the verifier.
- **It does not establish truth, independence, authorship of the original news, or legal compliance.**
- Devnet is for testing, not durable production evidence. Data can be reset.
- The on-chain payload is **only** a schema marker and SHA-256 digest. Avoid using secret material: hashes of low-entropy inputs may still leak information through guessing.
- The review body and claims remain in `localStorage['disclosure-v1']`. No private data is sent by this module, except the digest and wallet's normal transaction metadata.
- The wallet signs the transaction; **no private key** is handled by this application.
- No token, smart contract deployment, payment backend, or custody service is required.
- No audit has been performed. This is a Devnet proof of concept.

## V1 canonicalization
`JSON.stringify`-compatible canonical JSON recursively sorts object keys, preserves array order, and excludes undefined object properties. The object is:

```json
{"schema":"announcement-review/proof-v1","review":{"company":"...","ticker":"...","title":"...","date":"...","url":"...","body":"...","claims":[],"reviewed":true}}
```

The SHA-256 digest is calculated over UTF-8 bytes of this canonical JSON. Other clients must implement the same normalization to verify a digest.

## Dependencies and limitations
- The proof page imports `@solana/web3.js@1.98.4` from esm.sh in the browser; this requires CDN availability and should be vendored or pinned with an integrity-controlled build before production.
- Public Devnet RPC `https://api.devnet.solana.com` is rate-limited and not suitable for high-volume production traffic.
- A wallet extension with transaction signing support is required. Mobile in-app wallets may need a separate adapter.
- Records are browser-local, so a proof will not automatically appear on another device.
- The selected record must be marked reviewed before publishing.
- The page does not independently verify a reviewer's identity, and does not yet support multi-reviewer attestations, revocation, or historical versions.
- This implementation uses the standard Memo program rather than a custom Anchor contract; an Anchor program can be added once the attestation schema and roles are agreed.

## Production hardening
Introduce authenticated review storage, stable immutable review version IDs, server-side canonical hashing, wallet adapter integration, RPC provider, signed reviewer identity/role attestations, retries/observability, test coverage and audit before using proofs as production trust claims.
