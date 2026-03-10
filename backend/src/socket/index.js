const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { getRedisClient, KEYS } = require('../config/redis');
const logger = require('../utils/logger');

// Throttle map: userId+room -> lastEmitTime
const throttleMap = new Map();
const THROTTLE_MS = 30; // ~30 fps max for code changes

function shouldThrottle(key) {
  const now = Date.now();
  const last = throttleMap.get(key) || 0;
  if (now - last < THROTTLE_MS) return true;
  throttleMap.set(key, now);
  return false;
}

module.exports = (io) => {
  // ─── Socket Auth Middleware ─────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return next(new Error('User not found'));

      socket.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const redis = getRedisClient();
    logger.info(`Socket connected: ${socket.user.username} (${socket.id})`);

    // Map socket <-> user in Redis
    await redis.set(KEYS.userSocket(socket.user.id), socket.id, 'EX', 86400);
    await redis.set(KEYS.socketUser(socket.id), socket.user.id, 'EX', 86400);

    // ─── JOIN ROOM ──────────────────────────────────────────────────────
    socket.on('room:join', async ({ slug }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { slug },
          select: { id: true, slug: true, code: true, language: true, name: true },
        });
        if (!room) return socket.emit('error', { message: 'Room not found' });

        const member = await prisma.roomMember.findUnique({
          where: { userId_roomId: { userId: socket.user.id, roomId: room.id } },
        });
        if (!member) return socket.emit('error', { message: 'Not a member of this room' });

        // Leave previous rooms
        for (const r of socket.rooms) {
          if (r !== socket.id) {
            socket.leave(r);
            const prevSlug = r;
            await redis.hdel(KEYS.roomUsers(prevSlug), socket.user.id);
            // Notify previous room
            const leftPayload = { userId: socket.user.id, username: socket.user.username };
            io.to(prevSlug).emit('user:left', leftPayload);
          }
        }

        socket.join(slug);
        socket.currentRoom = slug;

        // Check for latest code in Redis (more up-to-date than DB)
        const cachedCode = await redis.get(KEYS.roomCode(slug));
        const currentCode = cachedCode || room.code;

        // Add to online users in Redis (hash: userId -> JSON)
        const userMeta = JSON.stringify({
          id: socket.user.id,
          username: socket.user.username,
          displayName: socket.user.displayName,
          avatarUrl: socket.user.avatarUrl,
          role: member.role,
          joinedAt: new Date().toISOString(),
        });
        await redis.hset(KEYS.roomUsers(slug), socket.user.id, userMeta);

        // Update DB last seen
        await prisma.roomMember.update({
          where: { userId_roomId: { userId: socket.user.id, roomId: room.id } },
          data: { isOnline: true, lastSeen: new Date() },
        });

        // Send room state to joining user
        socket.emit('room:joined', {
          room: { ...room, code: currentCode },
          role: member.role,
        });

        // Get all online users for this room
        const allUsersRaw = await redis.hgetall(KEYS.roomUsers(slug));
        const onlineUsers = Object.values(allUsersRaw || {}).map((u) => JSON.parse(u));
        socket.emit('users:online', onlineUsers);

        // Notify others
        const joinPayload = {
          user: socket.user,
          role: member.role,
          onlineCount: onlineUsers.length,
        };
        socket.to(slug).emit('user:joined', joinPayload);

        // Save system message
        await prisma.message.create({
          data: {
            content: `${socket.user.displayName || socket.user.username} joined the room`,
            type: 'SYSTEM',
            userId: socket.user.id,
            roomId: room.id,
          },
        });

        logger.info(`${socket.user.username} joined room: ${slug}`);
      } catch (err) {
        logger.error(`room:join error: ${err.message}`);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ─── CODE CHANGE ────────────────────────────────────────────────────
    socket.on('code:change', async ({ slug, code, delta }) => {
      // Throttle to avoid flooding
      const key = `${socket.user.id}:${slug}`;
      if (shouldThrottle(key)) return;

      try {
        // Persist to Redis instantly (source of truth while room is active)
        await redis.set(KEYS.roomCode(slug), code, 'EX', 86400);

        // Broadcast delta to all others in room
        socket.to(slug).emit('code:change', {
          code,
          delta,
          userId: socket.user.id,
          username: socket.user.username,
          timestamp: Date.now(),
        });
      } catch (err) {
        logger.error(`code:change error: ${err.message}`);
      }
    });

    // Periodic DB persist — debounced via Redis TTL check
    socket.on('code:save', async ({ slug, code }) => {
      try {
        await prisma.room.update({ where: { slug }, data: { code } });
        socket.emit('code:saved', { timestamp: new Date().toISOString() });
      } catch (err) {
        logger.error(`code:save error: ${err.message}`);
      }
    });

    // ─── CURSOR POSITION ────────────────────────────────────────────────
    socket.on('cursor:move', ({ slug, line, column, selection }) => {
      socket.to(slug).emit('cursor:move', {
        userId: socket.user.id,
        username: socket.user.username,
        avatarUrl: socket.user.avatarUrl,
        line,
        column,
        selection,
      });
    });

    // ─── CHAT ────────────────────────────────────────────────────────────
    socket.on('chat:message', async ({ slug, content }) => {
      try {
        if (!content?.trim()) return;
        if (content.length > 2000) {
          return socket.emit('error', { message: 'Message too long (max 2000 chars)' });
        }

        const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
        if (!room) return;

        const message = await prisma.message.create({
          data: { content: content.trim(), type: 'TEXT', userId: socket.user.id, roomId: room.id },
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        });

        io.to(slug).emit('chat:message', message);
      } catch (err) {
        logger.error(`chat:message error: ${err.message}`);
      }
    });

    socket.on('chat:typing', ({ slug }) => {
      socket.to(slug).emit('chat:typing', {
        userId: socket.user.id,
        username: socket.user.username,
      });
    });

    socket.on('chat:stop_typing', ({ slug }) => {
      socket.to(slug).emit('chat:stop_typing', { userId: socket.user.id });
    });

    // ─── LANGUAGE CHANGE ─────────────────────────────────────────────────
    socket.on('language:change', async ({ slug, language }) => {
      try {
        await prisma.room.update({ where: { slug }, data: { language } });
        io.to(slug).emit('language:change', {
          language,
          changedBy: socket.user.username,
        });
      } catch (err) {
        logger.error(`language:change error: ${err.message}`);
      }
    });

    // ─── EXECUTION EVENTS ────────────────────────────────────────────────
    socket.on('execution:start', ({ slug }) => {
      socket.to(slug).emit('execution:start', { triggeredBy: socket.user.username });
    });

    socket.on('execution:result', ({ slug, result }) => {
      io.to(slug).emit('execution:result', { result, runBy: socket.user.username });
    });

    // ─── GITHUB PUSH EVENT ───────────────────────────────────────────────
    socket.on('github:push_complete', ({ slug, commitUrl, commitSha, message }) => {
      io.to(slug).emit('github:push_complete', {
        commitUrl,
        commitSha,
        message,
        pushedBy: socket.user.username,
        timestamp: new Date().toISOString(),
      });
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────
    socket.on('disconnecting', async () => {
      try {
        for (const slug of socket.rooms) {
          if (slug === socket.id) continue;

          await redis.hdel(KEYS.roomUsers(slug), socket.user.id);

          // Get room ID for DB update
          const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } }).catch(() => null);
          if (room) {
            await prisma.roomMember.updateMany({
              where: { userId: socket.user.id, roomId: room.id },
              data: { isOnline: false, lastSeen: new Date() },
            });
          }

          const remaining = await redis.hgetall(KEYS.roomUsers(slug));
          io.to(slug).emit('user:left', {
            userId: socket.user.id,
            username: socket.user.username,
            onlineCount: Object.keys(remaining || {}).length,
          });
        }
      } catch (err) {
        logger.error(`disconnecting error: ${err.message}`);
      }
    });

    socket.on('disconnect', async () => {
      await redis.del(KEYS.userSocket(socket.user.id), KEYS.socketUser(socket.id));
      logger.info(`Socket disconnected: ${socket.user.username}`);
    });
  });
};
