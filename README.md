# Medi60: 60-minute e-pharmacy prototype (GitHub Pages version)

SOM609 Information Systems · Group 6

Five web apps (customer, pharmacist, partner pharmacy, rider, operations) share one live order.
This copy runs on GitHub Pages and syncs across devices through Google Firebase Firestore.

| App | Link (after publishing) |
|---|---|
| Home (pick an app) | `https://<username>.github.io/medi60/` |
| Customer | `.../medi60/#customer` |
| Pharmacist | `.../medi60/#pharmacist` |
| Partner pharmacy | `.../medi60/#partner` |
| Rider | `.../medi60/#rider` |
| Operations | `.../medi60/#ops` |

## Files

| File | Purpose |
|---|---|
| `index.html` | The full prototype (same app as the Claude-hosted version) |
| `db-shim.js` | Connects the app's database calls to Firebase Firestore |
| `firebase-config.js` | Your Firebase project keys (paste them here) |
| `firestore.rules` | Security rules to paste into Firebase |

Without Firebase keys the app still works, but syncs only between tabs on one computer.

## Step 1: Create the Firebase database (about 5 minutes)

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project**, name it `medi60`, and turn Google Analytics off (not needed).
3. In the left menu open **Build → Firestore Database → Create database**.
   - Location: **asia-south1 (Mumbai)**.
   - Start in **production mode**.
4. Open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.
5. Click the gear icon → **Project settings** → **General** → **Your apps** → the web icon **`</>`**.
   Register an app called `medi60-web` (leave Firebase Hosting unticked).
6. Firebase shows a `firebaseConfig` block. Copy its six values into `firebase-config.js`, replacing the `PASTE_...` text.

The `apiKey` in a Firebase web config is not a secret; access is controlled by the rules from step 4.

## Step 2: Publish on GitHub Pages

1. On github.com create a new **public** repository called `medi60`.
2. **Add file → Upload files**: upload `index.html`, `db-shim.js`, `firebase-config.js` and `firestore.rules` (and this README). Commit.
3. **Settings → Pages → Build and deployment**: Source **Deploy from a branch**, branch **main**, folder **/ (root)**, **Save**.
4. After 1–2 minutes the site is live at `https://<username>.github.io/medi60/`.

## Step 3: Check that sync works

1. Open `.../medi60/#ops` on a laptop. The status chip should read **Cloud sync on · works across devices**.
   (If it reads "this computer only", the keys in `firebase-config.js` are missing or wrong.)
2. Open `.../medi60/#customer` on a phone, place a sample order, and watch it appear on the laptop within about a second.

## How the sync works

- Every order is one document in the `orders` collection; stock, shop and rider status live in `medi60/meta`.
- One open app is the **leader**: it holds a 7-second lease (`_leases`), runs the timers and writes orders.
  Other apps send their button presses as commands (`cmds`). If the leader closes, another app takes over.
- Firebase free plan limits (50,000 reads and 20,000 writes a day) are far above what a class demo uses:
  five open apps use roughly 120 reads and 24 writes a minute when idle.

## Notes

- This GitHub copy uses its own database. Orders here are separate from the Claude-hosted prototype.
- To clear demo data, use **Reset demo data** in the Operations app.
- The rules stop working after 31 March 2027. Edit the date in Firebase → Firestore → Rules to extend it.
