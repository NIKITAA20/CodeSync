# ⚡ CodeSync — Real-Time Collaborative Coding Platform

Code together in real-time. Execute code. Push directly to GitHub.

---

## Features

- **Real-time collaborative editor** (Monaco — same as VS Code)
- **Live cursors** — see exactly where teammates are typing, with colored labels
- **Multi-language support** — JS, TS, Python, C++, Java, Go, Rust
- **Code execution** — via Judge0 API (sandboxed, secure)
- **GitHub OAuth login** — real GitHub accounts only
- **Push to GitHub** — select repo, branch, file path → commit & push via GitHub REST API
- **Live chat** — with typing indicators, persisted to DB
- **Room system** — create/join rooms with invite links
- **Version snapshots** — save and restore code states
- **Role system** — Admin / Editor / Viewer
- **Redis-backed presence** — online/offline status in real-time
- **Scalable architecture** — Socket.io + Redis Pub/Sub ready for horizontal scaling

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Monaco Editor, Socket.io-client, Zustand, TailwindCSS |
| Backend | Node.js, Express, Socket.io |
| Database | PostgreSQL via Prisma ORM |
| Cache / Presence | Redis (ioredis) |
| Auth | GitHub OAuth 2.0 + JWT |
| Code Execution | Judge0 API (RapidAPI) |
| GitHub Integration | GitHub REST API v3 |

---

## Project Structure

```
codesync/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # DB schema (User, Room, Message, Commit...)
│   ├── src/
│   │   ├── config/
│   │   │   ├── passport.js        # GitHub OAuth strategy
│   │   │   ├── prisma.js          # Prisma singleton
│   │   │   └── redis.js           # Redis client + key helpers
│   │   ├── controllers/
│   │   │   ├── authController.js  # GitHub OAuth callback, JWT issue
│   │   │   ├── roomController.js  # CRUD rooms, messages, snapshots
│   │   │   ├── githubController.js # List repos/branches, push via Git API
│   │   │   └── executeController.js # Judge0 code execution
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT authenticate middleware
│   │   │   └── errorHandler.js    # Global error handler
│   │   ├── routes/
│   │   │   └── index.js           # All API routes
│   │   ├── socket/
│   │   │   └── index.js           # All Socket.io events
│   │   └── server.js              # Express + Socket.io server
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   │   ├── CollaborativeEditor.jsx  # Monaco + live cursor decorations
│   │   │   │   └── OutputPanel.jsx          # Code execution output
│   │   │   ├── chat/
│   │   │   │   └── Chat.jsx                 # Live chat with typing indicators
│   │   │   ├── github/
│   │   │   │   └── GitHubPanel.jsx          # Repo/branch selector + push
│   │   │   └── room/
│   │   │       └── UsersPanel.jsx           # Online users list + invite link
│   │   ├── hooks/
│   │   │   └── useRoom.js         # All socket event wiring + debounced save
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx      # GitHub OAuth login
│   │   │   ├── AuthCallbackPage.jsx # OAuth redirect handler
│   │   │   ├── HomePage.jsx       # Dashboard — create/join rooms
│   │   │   └── RoomPage.jsx       # Full editor layout
│   │   ├── services/
│   │   │   ├── api.js             # Axios client + all API calls
│   │   │   └── socket.js          # Socket.io singleton
│   │   ├── store/
│   │   │   └── index.js           # Zustand global state
│   │   └── App.jsx                # Routes + auth guard
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml
```

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/yourusername/codesync.git
cd codesync

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env — fill in GitHub OAuth credentials, JWT secret

# Frontend
cd ../frontend
cp .env.example .env
# Default values work for local dev
```

### 3. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Set:
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:5000/api/auth/github/callback`
4. Copy **Client ID** and **Client Secret** into `backend/.env`

### 4. Start database + Redis

```bash
# From project root
docker-compose up postgres redis -d
```

Or install PostgreSQL and Redis locally and update `DATABASE_URL` / `REDIS_URL` in `.env`.

### 5. Run migrations

```bash
cd backend
npm run db:migrate
```

### 6. Start servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open http://localhost:3000

---

## Judge0 (Code Execution) Setup

1. Sign up at https://rapidapi.com/judge0-official/api/judge0-ce (free tier: 50 req/day)
2. Copy your RapidAPI key into `backend/.env` as `JUDGE0_API_KEY`

Without a key, JavaScript will still work via a basic sandbox. For Python, C++, Java, Go, Rust — Judge0 is required.

---

## Run Everything with Docker

```bash
# Copy .env files first, then:
docker-compose up --build
```

---

## Socket Events Reference

| Event (client → server) | Payload | Description |
|--------------------------|---------|-------------|
| `room:join` | `{ slug }` | Join a room |
| `code:change` | `{ slug, code }` | Broadcast code change |
| `code:save` | `{ slug, code }` | Persist to DB (debounced) |
| `cursor:move` | `{ slug, line, column }` | Share cursor position |
| `chat:message` | `{ slug, content }` | Send chat message |
| `chat:typing` | `{ slug }` | Typing indicator |
| `language:change` | `{ slug, language }` | Change language |
| `execution:start` | `{ slug }` | Notify others of run |
| `execution:result` | `{ slug, result }` | Broadcast execution output |
| `github:push_complete` | `{ slug, commitUrl, ... }` | Notify push success |

---

## Scalability Notes

- Redis is used as the source of truth for live room state (code, online users)
- Socket.io can use Redis adapter for horizontal scaling across multiple Node instances
- Code is debounce-persisted to PostgreSQL every 3s to reduce DB writes
- Judge0 handles sandboxed execution — no unsafe `eval` on your servers

To enable Socket.io Redis adapter for multi-instance:
```bash
npm install @socket.io/redis-adapter
```
Then in `socket/index.js`:
```js
const { createAdapter } = require('@socket.io/redis-adapter');
const pubClient = new Redis(process.env.REDIS_URL);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

---

## License

MIT
