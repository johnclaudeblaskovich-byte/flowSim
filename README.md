# FlowSim

FlowSim has two runtime pieces during development:

- the Vite frontend
- the Python solver backend on `http://localhost:8000`

If the backend is not running, the frontend will show `WebSocket connection to backend failed`.

## Start The App

In one terminal:

```bat
npm run install:backend
npm run dev:backend
```

In a second terminal:

```bat
npm run dev
```

## What The Backend Command Does

`npm run dev:backend` starts:

```bat
py -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir flowsim-backend
```

If `py` is not available, the helper falls back to `python`.

## Quick Check

Once the backend is running, open:

- `http://localhost:8000/health`

You should get a JSON response with `status: ok`.
