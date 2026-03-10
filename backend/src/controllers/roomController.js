const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');
const { getRedisClient, KEYS } = require('../config/redis');
const logger = require('../utils/logger');

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.enum(['JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'CPP', 'JAVA', 'GO', 'RUST']).default('JAVASCRIPT'),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().min(2).max(50).default(10),
});

const DEFAULT_CODE = {
  JAVASCRIPT: '// Start coding here\nconsole.log("Hello from CodeSync!");\n',
  TYPESCRIPT: '// Start coding here\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("CodeSync"));\n',
  PYTHON: '# Start coding here\nprint("Hello from CodeSync!")\n',
  CPP: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from CodeSync!" << endl;\n    return 0;\n}\n',
  JAVA: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from CodeSync!");\n    }\n}\n',
  GO: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from CodeSync!")\n}\n',
  RUST: 'fn main() {\n    println!("Hello from CodeSync!");\n}\n',
};

const generateSlug = () => {
  const words = ['sync', 'code', 'hack', 'build', 'dev', 'lab', 'jam', 'ship'];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${w1}-${w2}-${num}`;
};

const createRoom = async (req, res, next) => {
  try {
    const data = createRoomSchema.parse(req.body);
    let slug;
    // Ensure unique slug
    let attempts = 0;
    do {
      slug = generateSlug();
      attempts++;
      if (attempts > 10) throw new Error('Could not generate unique slug');
    } while (await prisma.room.findUnique({ where: { slug } }));

    const room = await prisma.room.create({
      data: {
        slug,
        name: data.name,
        language: data.language,
        code: DEFAULT_CODE[data.language],
        isPublic: data.isPublic,
        maxMembers: data.maxMembers,
        ownerId: req.user.id,
        members: {
          create: { userId: req.user.id, role: 'ADMIN' },
        },
      },
      include: { owner: { select: { id: true, username: true, avatarUrl: true } } },
    });

    logger.info(`Room created: ${room.slug} by ${req.user.username}`);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
};

const getRoom = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Merge live online status from Redis
    const redis = getRedisClient();
    const onlineRaw = await redis.hgetall(KEYS.roomUsers(slug));
    const onlineIds = new Set(Object.keys(onlineRaw || {}));

    const enriched = {
      ...room,
      members: room.members.map((m) => ({
        ...m,
        isOnline: onlineIds.has(m.userId),
      })),
    };

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

const listMyRooms = async (req, res, next) => {
  try {
    const memberships = await prisma.roomMember.findMany({
      where: { userId: req.user.id },
      include: {
        room: {
          include: {
            owner: { select: { id: true, username: true, avatarUrl: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { lastSeen: 'desc' },
    });

    res.json(memberships.map((m) => ({ ...m.room, role: m.role })));
  } catch (err) {
    next(err);
  }
};

const joinRoom = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({
      where: { slug },
      include: { _count: { select: { members: true } } },
    });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const existing = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
    });

    if (existing) return res.json({ message: 'Already a member', room });

    if (room._count.members >= room.maxMembers) {
      return res.status(403).json({ error: 'Room is full' });
    }

    await prisma.roomMember.create({
      data: { userId: req.user.id, roomId: room.id, role: 'EDITOR' },
    });

    logger.info(`User ${req.user.username} joined room ${slug}`);
    res.json({ message: 'Joined successfully', room });
  } catch (err) {
    next(err);
  }
};

const updateRoom = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== req.user.id) return res.status(403).json({ error: 'Not room owner' });

    const updated = await prisma.room.update({
      where: { slug },
      data: {
        name: req.body.name ?? room.name,
        githubRepo: req.body.githubRepo ?? room.githubRepo,
        githubBranch: req.body.githubBranch ?? room.githubBranch,
        githubPath: req.body.githubPath ?? room.githubPath,
        isPublic: req.body.isPublic ?? room.isPublic,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.ownerId !== req.user.id) return res.status(403).json({ error: 'Not room owner' });

    await prisma.room.delete({ where: { slug } });

    // Clean up Redis
    const redis = getRedisClient();
    await redis.del(KEYS.roomCode(slug), KEYS.roomUsers(slug));

    logger.info(`Room deleted: ${slug}`);
    res.json({ message: 'Room deleted' });
  } catch (err) {
    next(err);
  }
};

const getRoomMessages = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { cursor, limit = 50 } = req.query;

    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const messages = await prisma.message.findMany({
      where: { roomId: room.id, ...(cursor ? { id: { lt: cursor } } : {}) },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json(messages.reverse());
  } catch (err) {
    next(err);
  }
};

const getSnapshots = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const snapshots = await prisma.codeSnapshot.findMany({
      where: { roomId: room.id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(snapshots);
  } catch (err) {
    next(err);
  }
};

const saveSnapshot = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { code, language, description } = req.body;

    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const snapshot = await prisma.codeSnapshot.create({
      data: { code, language, description, roomId: room.id, savedBy: req.user.id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });

    res.status(201).json(snapshot);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRoom,
  getRoom,
  listMyRooms,
  joinRoom,
  updateRoom,
  deleteRoom,
  getRoomMessages,
  getSnapshots,
  saveSnapshot,
};
