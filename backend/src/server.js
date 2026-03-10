require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const passport = require('./config/passport');
const { getRedisClient } = require('./config/redis');
const prisma = require('./config/prisma');
const routes = require('./routes');
const socketHandler = require('./socket');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// ─── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

// ─── Express Middleware ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Session (used only for passport OAuth flow)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 60 * 60 * 1000 },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  })
);

app.use(
  '/api/execute',
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Code execution rate limit reached. Max 20/min.' },
  })
);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.io ───────────────────────────────────────────────────────────────
socketHandler(io);

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    const redis = getRedisClient();
    redis.disconnect();
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => { logger.error('Forced shutdown'); process.exit(1); }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => { logger.error(`Uncaught exception: ${err.message}`, err); });
process.on('unhandledRejection', (reason) => { logger.error(`Unhandled rejection: ${reason}`); });

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`
╔══════════════════════════════════════╗
║   CodeSync Backend Running           ║
║   Port    : ${PORT}                       ║
║   Mode    : ${process.env.NODE_ENV || 'development'}              ║
║   DB      : PostgreSQL (Prisma)      ║
║   Cache   : Redis                    ║
╚══════════════════════════════════════╝`);
});

module.exports = { app, server, io };
