const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error']
    : ['warn', 'error'],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
  });
}

module.exports = prisma;
