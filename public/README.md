# Yield-Vats — Farcaster Mini App (Base)

Domain: https://nurrabby.com/

## Deploy
Host the contents of this folder at the root of https://nurrabby.com/ (PRIMARY_ROUTE = "/").

Required paths:
- https://nurrabby.com/ (index.html)
- https://nurrabby.com/app.js
- https://nurrabby.com/styles.css
- https://nurrabby.com/assets/embed-3x2.png
- https://nurrabby.com/.well-known/farcaster.json

## IMPORTANT: Account Association
`/.well-known/farcaster.json` requires a valid `accountAssociation` (JSON Farcaster Signature) to fully verify domain ownership.

In Base Build, use the **Account association** tab to generate the JFS for `nurrabby.com`, then paste the generated `header`, `payload`, and `signature` into:
`/.well-known/farcaster.json`

## Tip Setup
The Tip button uses USDC on Base mainnet via ERC-5792 `wallet_sendCalls`.

Before enabling tips:
- Replace `BUILDER_CODE` in `app.js` (required for Attribution / dataSuffix)
- Replace `RECIPIENT` in `app.js` with your checksummed EVM address

If either is not set, sending is disabled (by design).
