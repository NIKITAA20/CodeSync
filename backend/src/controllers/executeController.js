const prisma = require('../config/prisma');
const logger = require('../utils/logger');

// Judge0 language IDs
const LANGUAGE_IDS = {
  JAVASCRIPT: 63,
  TYPESCRIPT: 74,
  PYTHON: 71,
  CPP: 54,
  JAVA: 62,
  GO: 60,
  RUST: 73,
};

const JUDGE0_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_API_KEY;

const executeCode = async (req, res, next) => {
  const { code, language, stdin, roomSlug } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'code and language are required' });
  }

  const langId = LANGUAGE_IDS[language.toUpperCase()];
  if (!langId) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const startTime = Date.now();
  let log;

  // Create pending log
  try {
    log = await prisma.executionLog.create({
      data: {
        language,
        code,
        status: 'RUNNING',
        roomId: roomSlug
          ? (await prisma.room.findUnique({ where: { slug: roomSlug }, select: { id: true } }))?.id
          : null,
      },
    });
  } catch { /* non-critical */ }


try {
    // If no key AND using RapidAPI URL → fallback for JS, error for others
    const isRapidAPI = JUDGE0_URL.includes('rapidapi.com');
    if (!JUDGE0_KEY && isRapidAPI) {
      if (language.toUpperCase() === 'JAVASCRIPT') {
        return fallbackJsExec(req, res, code, log, startTime);
      }
      return res.status(503).json({
        error: 'Code execution not configured.',
        hint: 'Self-host Judge0: docker-compose up in judge0-local folder',
      });
    }

    // Submit to Judge0
const headers = { 'Content-Type': 'application/json' };
if (JUDGE0_KEY) {
  headers['X-RapidAPI-Key'] = JUDGE0_KEY;
  headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
}

const submission = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
  method: 'POST',
  headers,
      body: JSON.stringify({
        source_code: code,
        language_id: langId,
        stdin: stdin || '',
        cpu_time_limit: 5,
        memory_limit: 128000,
      }),
    });

    const { token } = await submission.json();
    if (!token) throw new Error('Judge0 did not return a token');

    // Poll for result (max 10 seconds)
    let result;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const poll = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, {
headers: JUDGE0_KEY ? {
  'X-RapidAPI-Key': JUDGE0_KEY,
  'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
} : {},
      });
      result = await poll.json();
      if (result.status?.id > 2) break; // 1=Queued, 2=Processing
    }

    const executionMs = Date.now() - startTime;
    const isSuccess = result.status?.id === 3; // 3 = Accepted
    const isTimeout = result.status?.id === 5;

    const output = {
      stdout: result.stdout || '',
      stderr: result.stderr || result.compile_output || '',
      exitCode: result.exit_code ?? (isSuccess ? 0 : 1),
      executionMs,
      status: isTimeout ? 'TIMEOUT' : isSuccess ? 'SUCCESS' : 'FAILED',
      statusDescription: result.status?.description || 'Unknown',
      memoryUsed: result.memory,
      timeUsed: result.time,
    };

    // Update log
    if (log) {
      await prisma.executionLog.update({
        where: { id: log.id },
        data: {
          output: output.stdout,
          stderr: output.stderr,
          exitCode: output.exitCode,
          executionMs,
          status: output.status,
        },
      });
    }

    logger.info(`Code executed: ${language} | status: ${output.status} | ${executionMs}ms`);
    res.json(output);
  } catch (err) {
    if (log) {
      await prisma.executionLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', stderr: err.message, executionMs: Date.now() - startTime },
      }).catch(() => {});
    }
    logger.error(`Execution error: ${err.message}`);
    next(err);
  }
};

// Basic JS sandbox fallback (no Judge0 key) — uses vm2-style isolation via Function
const fallbackJsExec = (req, res, code, log, startTime) => {
  const logs = [];
  const errors = [];
  try {
    const sandbox = {
      console: {
        log: (...args) => logs.push(args.map(String).join(' ')),
        error: (...args) => errors.push(args.map(String).join(' ')),
        warn: (...args) => logs.push('[WARN] ' + args.map(String).join(' ')),
      },
      setTimeout: undefined,
      setInterval: undefined,
      fetch: undefined,
      require: undefined,
      process: undefined,
      __dirname: undefined,
      __filename: undefined,
    };
    const fn = new Function(...Object.keys(sandbox), code);
    fn(...Object.values(sandbox));
  } catch (e) {
    errors.push(e.message);
  }

  const executionMs = Date.now() - startTime;
  const output = {
    stdout: logs.join('\n'),
    stderr: errors.join('\n'),
    exitCode: errors.length ? 1 : 0,
    executionMs,
    status: errors.length ? 'FAILED' : 'SUCCESS',
    statusDescription: errors.length ? 'Runtime Error' : 'Accepted',
    note: 'Running in basic JS sandbox. Configure JUDGE0_API_KEY for full multi-language support.',
  };

  if (log) {
    prisma.executionLog.update({
      where: { id: log.id },
      data: { output: output.stdout, stderr: output.stderr, exitCode: output.exitCode, executionMs, status: output.status },
    }).catch(() => {});
  }

  res.json(output);
};

module.exports = { executeCode };
