# Greenfields IMS — Frontend

React + Vite SPA for the Greenfields Incident Management System.

## Setup

```bash
npm install
npm run dev     # Dev server on port 5173 (proxies /api to localhost:8000)
npm run build   # Production build → dist/
npm run lint    # ESLint
```

## Structure

```
src/
├── App.jsx             # Router + auth gate + layout
├── main.jsx            # Entry point
├── index.css           # Tailwind directives
├── lib/
│   └── cn.js           # Class merge utility
├── services/
│   └── api.js          # Axios client with JWT interceptor
├── components/
│   ├── Sidebar.jsx     # Navigation
│   └── Toast.jsx       # Notifications
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── Incidents.jsx
    ├── ManageUsers.jsx  # Admin only
    └── ActivityLog.jsx  # Admin only
```

## Key Dependencies

- React 19, React Router DOM 7
- Vite 8, TailwindCSS 3.4
- Axios 1.16, Lucide React icons
- clsx + tailwind-merge

## Dev Proxy

```js
// vite.config.js — proxies /api to backend
server: { proxy: { '/api': 'http://localhost:8000' } }
```

See the [main project README](../README.md) for full documentation.
