# AO Sync SDK

[![NPM version](https://img.shields.io/npm/v/@vela-ventures/ao-sync-sdk.svg)](https://www.npmjs.com/package/@vela-ventures/ao-sync-sdk)
[![npm downloads/month](https://img.shields.io/npm/dm/@vela-ventures/ao-sync-sdk.svg)](https://www.npmjs.com/package/@vela-ventures/ao-sync-sdk)
[![npm downloads](https://img.shields.io/npm/dt/@vela-ventures/ao-sync-sdk.svg)](https://www.npmjs.com/package/@vela-ventures/ao-sync-sdk)

# @vela-ventures/ao-sync-sdk

`@vela-ventures/ao-sync-sdk` is a JavaScript/TypeScript SDK for connecting your application to the Beacon Wallet. This library provides an easy way to interact with Beacon Wallet for Arweave and AO-based applications while delegating signing, encryption, and logic to the wallet itself.

## Features
- **Seamless Wallet Connection**: Connect to the Beacon Wallet via MQTT.
- **QR Code Authentication**: Generate QR codes for easy wallet scanning.
- **Reconnect Support**: Automatically reconnect to the wallet using stored session data.

---

## Installation

Install the SDK via npm:
```bash
npm install @vela-ventures/ao-sync-sdk
```

---

## Usage

### 1. Import the WalletClient Class
```javascript
import WalletClient from "@vela-ventures/ao-sync-sdk";
```

### 2. Initialize the WalletClient
```javascript
const walletClient = new WalletClient();
```

### 3. Connect to the Wallet
To establish a connection with Beacon Wallet, use the `connect` method:
```javascript
await walletClient.connect({
  permissions: [
    "ACCESS_ADDRESS",
    "ACCESS_PUBLIC_KEY",
    "SIGN_TRANSACTION"
  ],
  appInfo: {
    name: "MyApp",
    logo: "https://myapp.com/logo.png"
  },
  gateway: {
    host: "arweave.net",
    port: 443,
    protocol: "https"
  },
  brokerUrl: "wss://aosync-broker-eu.beaconwallet.dev:8081",
  options: {
    protocolVersion: 5
  }
});
```
This will generate a QR code that the user can scan with their Beacon Wallet to establish a connection.

### 4. Listen for Events
The SDK uses an event-driven architecture. You can listen for connection, disconnection, or custom events:
```javascript
walletClient.on("connected", (data) => {
  console.log("Wallet connected:", data);
});

walletClient.on("disconnected", (data) => {
  console.log("Wallet disconnected:", data);
});
```

### 5. Sign Transactions or Data
Once connected, you can use the wallet to sign transactions or data:
```javascript
const signedTx = await walletClient.signTransaction(transactionData);
console.log("Signed Transaction:", signedTx);

const signedData = await walletClient.signDataItem(dataItem);
console.log("Signed Data Item:", signedData);
```

### 6. Disconnect
To disconnect the wallet:
```javascript
await walletClient.disconnect();
```

---

## API Reference

### `WalletClient`
#### Constructor
```javascript
new WalletClient(responseTimeoutMs = 30000, txTimeoutMs = 300000)
```
- **`responseTimeoutMs`** *(optional)*: Timeout duration for responses (default: 30 seconds).
- **`txTimeoutMs`** *(optional)*: Timeout duration for transactions (default: 5 minutes).

#### Methods

##### `connect(options)`
Establish a connection with the Beacon Wallet.

##### `reconnect()`
Reconnect to the wallet using session data from `sessionStorage`.

##### `signTransaction(transaction)`
Sign an Arweave transaction.
- **`transaction`**: The transaction object to sign.

##### `signDataItem(dataItem)`
Sign a data item.
- **`dataItem`**: The data item to sign.

##### `disconnect()`
Disconnect from the Beacon Wallet.

#### Events
- **`connected`**: Fired when the wallet is successfully connected.
- **`disconnected`**: Fired when the wallet is disconnected.

---

## Dependencies
- `mqtt`: MQTT protocol client.
- `qrcode`: QR code generation.
- `uuid`: Universally unique identifiers.
- `arweave/web`: Arweave SDK for transactions and data handling.

---

## Contributing
Feel free to open issues or submit pull requests to enhance this SDK. Contributions are welcome!



