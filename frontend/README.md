# MessMate web & mobile app

React + Vite + Tailwind CSS frontend. See the project README one level up for setup, the calculation
rules and the Capacitor (Android/iOS) build steps.

```bash
npm install
npm run dev      # http://localhost:5173, proxies /api to http://localhost:5000
npm run build    # production build in dist/
```

`src/` layout: `pages/` (one per screen), `components/` (UI kit, forms, charts, breakdown modals),
`layouts/` (app shell with sidebar + mobile bottom nav), `context/` (auth, current household/month,
quick actions), `services/api.js` (API client), `hooks/`, `utils/`.
