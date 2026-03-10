const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Called after passport GitHub OAuth success
const githubCallback = (req, res) => {
  try {
    const token = generateToken(req.user.id);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    // Redirect to frontend with token in query param — frontend stores in memory/localStorage
    res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    logger.error(`githubCallback error: ${err.message}`);
    res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
};

const getMe = async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    displayName: req.user.displayName,
    email: req.user.email,
    avatarUrl: req.user.avatarUrl,
  });
};

const logout = (req, res) => {
  req.logout?.(() => {});
  res.json({ message: 'Logged out successfully' });
};

module.exports = { githubCallback, getMe, logout };
