# TECH QUIZ — Admin-controlled live quiz

## Features
- Student page (`/`): only name entry before quiz; students do not see admin controls.
- Admin page (`/admin`): questions and source notes, no timer on admin screen, Start Question button.
- Each question starts for students only when admin presses Start; 30-second timer begins then.
- Live counts of correct, wrong, pending, and participant total.
- 20 questions, including tricky 6–7-line Python/C examples using `for`, `while`, conditionals, functions, indexing, and error detection.
- Admin can end a question early, start the next question, show final leaderboard, and reset the session.
- Final leaderboard is shown in the admin dashboard when Show leaderboard is pressed.
- Socket.IO synchronizes admin and participant browsers over the network.

## Run in VS Code
1. Install Node.js LTS.
2. Extract the ZIP and open the `tech_quiz_live_admin` folder in VS Code.
3. Open Terminal in this folder and run:
   ```bash
   npm install
   npm run dev
   ```
4. Student view: `http://localhost:5173/`
5. Admin view: `http://localhost:5173/admin`

## Use on multiple phones
- All devices must be on the same Wi-Fi for a local test.
- Find the computer's LAN IPv4 address (Windows: `ipconfig`). On phones open `http://COMPUTER_IP:5173/`; on the host open `http://localhost:5173/admin`.
- If the dev server is blocked, allow Node.js through Windows Firewall on private networks.
- For an event-wide QR code, deploy both frontend and server to a reachable HTTPS host and set `VITE_SERVER_URL` to the backend URL if frontend/backend are on separate domains. The QR should contain only the student URL (`/`), never `/admin`.

## Important
This demo keeps participants and scores in server memory. Restarting the server clears them. It has no admin password, so use only on a trusted local network for testing. For a public event, add admin authentication and a database, and use a single HTTPS domain or configure Socket.IO CORS securely.

## Question sources
- Company/history questions show a source label and year/context in the admin preview.
- Programming snippets are original practice questions, so they are marked as original questions with the relevant programming concept rather than falsely attributed to a company interview.


## Online deployment (for the event QR)
1. Upload this project folder to a GitHub repository.
2. In Render, create a **Web Service** from that repository. Build command: `npm install && npm run build`; Start command: `npm start`.
3. After deployment, open the Render HTTPS URL plus `/admin`. The Student QR in the dashboard automatically encodes the public root student URL. Students scan the same QR; they do not get the admin page.
4. Keep the same deployed service running during the event. This demo stores quiz session data in server memory and does not persist it through restarts.
