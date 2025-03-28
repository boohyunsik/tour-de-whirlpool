# Tour de Whirlpool
## Environment
The code is for whirlpools-sdk v0.13.15.

The code is verified with the following versions:

- node: 20.18.1
- ts-node: 10.9.2
- dependencies
  - @orca-so/whirlpools-sdk: 0.13.15
  - @orca-so/common-sdk: 0.6.10
  - @coral-xyz/anchor: 0.29.0
  - @solana/web3.js: 1.98.0
  - @solana/spl-token: 0.4.12
  - @types/bn.js: 5.1.3
  - bs58: 5.1.6
  - decimal.js: 10.5.0

### Note
- Please use `@coral-xyz/anchor` 0.29.0 (Whirlpool is build on Anchor 0.29.0)

## How to run
1. If you don't have your own key, create new solana key.
```sh
solana-keygen new -o ./wallet.json
```

2. Set environment variables
* Linux
```sh
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=wallet.json
```

* Windows
```sh
set ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
set ANCHOR_WALLET=wallet.json
```

3. Run with `ts-node`
```sh
ts-node src/EN/011_get_sol_balance.ts
```