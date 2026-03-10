const express = require('express');
const passport = require('../config/passport');
const { authenticate } = require('../middleware/auth');
const { githubCallback, getMe, logout } = require('../controllers/authController');
const {
  createRoom, getRoom, listMyRooms, joinRoom, updateRoom, deleteRoom,
  getRoomMessages, getSnapshots, saveSnapshot,
} = require('../controllers/roomController');
const { listRepos, listBranches, pushToGitHub, getCommitHistory } = require('../controllers/githubController');
const { executeCode } = require('../controllers/executeController');

const router = express.Router();

// ─── Auth ──────────────────────────────────────────────────────────────────
router.get('/auth/github', passport.authenticate('github', { scope: ['user:email', 'repo'] }));

router.get(
  '/auth/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.CLIENT_URL}/auth/error` }),
  githubCallback
);

router.get('/auth/me', authenticate, getMe);
router.post('/auth/logout', authenticate, logout);

// ─── Rooms ─────────────────────────────────────────────────────────────────
router.post('/rooms', authenticate, createRoom);
router.get('/rooms', authenticate, listMyRooms);
router.get('/rooms/:slug', authenticate, getRoom);
router.patch('/rooms/:slug', authenticate, updateRoom);
router.delete('/rooms/:slug', authenticate, deleteRoom);
router.post('/rooms/:slug/join', authenticate, joinRoom);

// Messages & Snapshots
router.get('/rooms/:slug/messages', authenticate, getRoomMessages);
router.get('/rooms/:slug/snapshots', authenticate, getSnapshots);
router.post('/rooms/:slug/snapshots', authenticate, saveSnapshot);

// Commit history
router.get('/rooms/:slug/commits', authenticate, getCommitHistory);

// ─── GitHub ────────────────────────────────────────────────────────────────
router.get('/github/repos', authenticate, listRepos);
router.get('/github/repos/:owner/:repo/branches', authenticate, listBranches);
router.post('/github/push/:slug', authenticate, pushToGitHub);

// ─── Code Execution ────────────────────────────────────────────────────────
router.post('/execute', authenticate, executeCode);

// ─── Health ────────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

module.exports = router;
