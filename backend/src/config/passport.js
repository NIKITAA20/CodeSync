const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const prisma = require('./prisma');
const logger = require('../utils/logger');

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
      scope: ['user:email', 'repo'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.find((e) => e.primary)?.value ||
          profile.emails?.[0]?.value ||
          null;

        const user = await prisma.user.upsert({
          where: { githubId: String(profile.id) },
          update: {
            username: profile.username,
            displayName: profile.displayName || profile.username,
            email,
            avatarUrl: profile.photos?.[0]?.value || null,
            githubToken: accessToken,
            updatedAt: new Date(),
          },
          create: {
            githubId: String(profile.id),
            username: profile.username,
            displayName: profile.displayName || profile.username,
            email,
            avatarUrl: profile.photos?.[0]?.value || null,
            githubToken: accessToken,
          },
        });

        logger.info(`User authenticated: ${user.username} (${user.id})`);
        return done(null, user);
      } catch (err) {
        logger.error(`Passport GitHub error: ${err.message}`);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
