# Put MessMate online (always on)

You end up with one website address, such as `https://messmate.onrender.com`, that works 24/7 on
phones and computers. Two services are involved:

| Part | Service | Cost | Always on? |
|---|---|---|---|
| Database | MongoDB Atlas, M0 cluster | Free | Yes |
| Website + API | Render web service, Starter plan | Paid monthly (check render.com/pricing) | Yes |

Render's **Free** plan also works, but it sleeps after about 15 minutes without visitors and takes
around a minute to wake up on the next visit. For a mess that uses the app every day, Starter is the
one that is really "always on". Your data is safe either way because it lives in Atlas.

You need the code in a GitHub repository first (Render deploys from GitHub).

---

## 1. Create the database (MongoDB Atlas)

1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. **Create a cluster** → choose **M0 (Free)**. For Bangladesh, pick a nearby region such as
   AWS Singapore or Mumbai. Name it anything.
3. **Database Access** → **Add New Database User**. Choose password authentication, a username such
   as `messmate`, and click **Autogenerate Secure Password**. Copy the password somewhere safe.
   Role: **Read and write to any database** is fine for a dedicated cluster.
4. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`).
   Render's addresses can change, so this is the practical option; the strong password protects it.
   (On a paid Render plan you can instead add the outbound IPs listed under your service's
   **Connect → Outbound** tab.)
5. **Database** → **Connect** → **Drivers**. Copy the connection string. It looks like:

   ```
   mongodb+srv://messmate:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```

   Replace `<password>` with the password from step 3, and add the database name `messmate` after
   `.net/`:

   ```
   mongodb+srv://messmate:YOUR_PASSWORD@cluster0.abcde.mongodb.net/messmate?retryWrites=true&w=majority
   ```

   If the password contains `@ : / ? # %`, generate a new one without symbols or URL-encode it.

## 2. Deploy the app (Render)

1. Sign up at https://render.com with your GitHub account.
2. **New** → **Blueprint** → connect the MessMate GitHub repository. Render reads `render.yaml`
   from the repo and shows one service called `messmate`.
3. It asks for `MONGODB_URI`: paste the connection string from step 1.5.
   `JWT_SECRET` is generated for you; don't change or share it.
4. Click **Apply**. The first build takes a few minutes. When it shows **Live**, open the address at
   the top of the service page (e.g. `https://messmate.onrender.com`).
5. Check `https://YOUR-ADDRESS/api/health`; it should say `{"ok":true,...}`.
6. Open the address, register the first account (that person becomes the admin), create the
   household and the first month.

From now on, every push to the repository's main branch redeploys automatically.

### Plan and region

`render.yaml` uses the **Free** plan in **Singapore**, so no card is needed. Free services sleep after
about 15 minutes idle and can't keep uploaded receipt photos across restarts. To stay on 24/7, change
`plan: free` to `plan: starter` (paid) and uncomment the `disk:` block, or switch the plan in
Render → service → **Settings → Instance Type** (and add a disk under **Disks**).

### Your own domain (optional)

Render → your service → **Settings → Custom Domains** → add e.g. `mess.example.com`, then create the
DNS record it shows at your domain registrar. HTTPS is set up automatically. Then set
`APP_URL=https://mess.example.com` under **Environment** so password-reset links use it.

## 3. Mobile app (optional)

The Android/iOS app talks to the same server. Build it with your Render address:

```bash
cd frontend
echo "VITE_API_URL=https://messmate.onrender.com" > .env.production
npm run build && npx cap sync && npx cap open android
```

`capacitor://localhost`, `https://localhost` and `http://localhost` are already allowed in
`CORS_ORIGINS` in `render.yaml`.

## 4. Backups

- Atlas M0 does not include automatic backups. Once a month (for example right after closing a
  month), run from your computer:

  ```bash
  mongodump --uri "YOUR_MONGODB_URI" --out messmate-backup-$(date +%F)
  ```

  and keep the folder on Google Drive or similar. Restore with `mongorestore --uri "..." <folder>`.
- Upgrading to a paid Atlas cluster (M10+) turns on automatic daily snapshots.
- Closed months also keep a frozen copy of their report inside the database.

## 5. Things to know

- **Password reset emails** are not sent yet: the reset link is only written to the server log
  (Render → **Logs**). Members can still change their password while logged in, and an admin can
  read the link from the logs. Hooking up an email service (Brevo, Resend, SendGrid…) is a small
  change in `backend/src/controllers/auth.controller.js`.
- **Secrets** (`MONGODB_URI`, `JWT_SECRET`) live only in Render's Environment settings, never in the
  repository. Changing `JWT_SECRET` logs everyone out.
- **Logs and restarts:** Render → service → **Logs**, **Events**, and **Manual Deploy → Restart**.

## Why not Vercel?

Vercel is built for static sites and short serverless functions, while the MessMate API is a normal
long-running Express server with file uploads. It can still be split: host `frontend` on Vercel
(set `VITE_API_URL` to the Render address, build command `npm run build`, output `dist`, plus a
rewrite of all paths to `/index.html`), and add the Vercel address to `CORS_ORIGINS` on Render. You
would still need Render (or Railway, Fly.io, a VPS) for the API, so one Render service is simpler.
