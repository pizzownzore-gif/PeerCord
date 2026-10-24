# Peercord dedicated server

A small Node program for a home lab or always-on PC. It relays the same encrypted messages the app uses, over WebSocket. No browser, no native modules.

## Run from source (any OS with Node 18+, including Termux on Android)
    npm install
    npm start

## Build single executables (Windows, Linux x64, Linux ARM64 for Raspberry Pi)
    npm install
    npm run build

Files appear in `dist/`. The GitHub Action in `.github/workflows/server.yml` does the same and uploads them as artifacts.

## Android
Install Termux, then `pkg install nodejs`, copy `server.js` and `package.json`, run `npm install && npm start`. The prebuilt Linux binaries will not run on Android.

## Connecting
The console prints an invite and an admin invite. Paste either into the app's "Join with invite" box.
- The admin invite adds kick, ban, rename and add-channel controls. Keep it private.
- Replace the printed IP with your domain or public address, and forward the port (default 8787) on your router. Behind a reverse proxy with HTTPS use `wss://`.
- Voice calls still go directly between users through PeerJS. The server never carries audio.
- The Android APK must allow `ws://`. In `capacitor.config`, set `server: { androidScheme: 'http' }`, or put the server behind `wss://`.

## Settings (environment variables)
- `PEERCORD_PORT` (default 8787), `PEERCORD_NAME` (default Server), `PEERCORD_DATA` (default `./data`)

## Privacy
Messages are AES-GCM encrypted with the key in the invite; the server holds that key, so it can read channel text it stores. DMs are encrypted between users and relayed as ciphertext. `data/state.json` holds the key, channels, bans and text history (images are not saved). Back it up to keep the same invites.
