**PeerCord - Serverless P2P Discord Alternative**

PeerCord is a fully functional, ephemeral chat and voice application that runs entirely in your browser. It uses WebRTC (via PeerJS) to create direct connections between users, meaning no database, no backend setup, and no login registration are required.

Just download the file, open it, and start chatting.

**🚀 Features**

Zero Installation: Runs from a single HTML file. **No Node.js, Python, or Docker required.**

Real-Time Text Chat: Instant messaging with optimistic UI updates.

Two Modes:

Host Mode: One user acts as the host directly from their chat client.

Dedicated Server: A lightweight "console" dashboard to run a persistent server on a spare device.

Mobile Friendly: Responsive UI with touch controls.

QR Code Pairing: Join servers instantly by scanning a QR code with your device's camera.

Connectivity: Pre-configured with STUN servers to work over VPNs and across different networks.

🛠️ How to Use

Option 1: The "Dedicated Server" (Recommended)

Best for groups who want a stable connection that doesn't close when one person leaves.

Open Peercord.Dedicated.server.html in a browser tab.

Wait for the Server ID and QR Code to appear.

Share the ID or let friends scan the QR code.

Open Peercord.Client.html on your device.

Enter a username, paste the ID (or scan the QR), and click Join.

Option 2: Peer-to-Peer (Quick Start)

Best for a quick chat between two people.

Open Peercord.Client.html

Click Create Host.

Copy your ID from the sidebar settings (or show your QR code).

Send it to a friend. They open Peercord.Client.html, paste your ID, and click Join.

🔧 Technical Details

PeerCord is built using a Zero-Build architecture. It pulls all dependencies via CDN, allowing the code to remain transparent and editable in a single text file.

Frontend Library: React 18 (via CDN)

Styling: Tailwind CSS (via CDN)

Networking: PeerJS (WebRTC wrapper)

QR Codes: QRious (Generation) & html5-qrcode (Scanning)

Transpiler: Babel Standalone (Compiles JSX in the browser)

Network Architecture

Text Chat: Uses a Star Topology. All messages go to the Host/Server, which broadcasts them to all connected clients to ensure synchronization.

