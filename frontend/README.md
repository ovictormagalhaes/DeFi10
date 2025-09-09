
# MyWebWallet Frontend

Minimal Vite + React frontend that connects to an Ethereum-compatible wallet (for example MetaMask) using ethers.js.

Getting started

1. From this folder, install dependencies:

   npm install

2. Start the development server:

   npm run dev

3. Open http://localhost:5173 in your browser.

Notes
- This app uses the injected `window.ethereum` provider and calls `eth_requestAccounts` when you click "Connect Wallet".
- Ensure you have MetaMask (or another injected wallet) installed and unlocked.

