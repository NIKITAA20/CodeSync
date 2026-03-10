const prisma = require('../config/prisma');
const logger = require('../utils/logger');

const GITHUB_API = 'https://api.github.com';

// Helper: authenticated fetch to GitHub API
const ghFetch = async (path, token, options = {}) => {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'GitHub API error');
    err.status = res.status;
    err.ghData = data;
    throw err;
  }
  return data;
};

// List user's GitHub repos
const listRepos = async (req, res, next) => {
  try {
    const repos = await ghFetch(
      '/user/repos?sort=updated&per_page=50&type=all',
      req.user.githubToken
    );
    res.json(
      repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        defaultBranch: r.default_branch,
        url: r.html_url,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// List branches for a repo
const listBranches = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const branches = await ghFetch(`/repos/${owner}/${repo}/branches`, req.user.githubToken);
    res.json(branches.map((b) => ({ name: b.name, sha: b.commit.sha })));
  } catch (err) {
    next(err);
  }
};

// Push file to GitHub — full Git tree flow
const pushToGitHub = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { repo, branch, filePath, commitMessage } = req.body;

    if (!repo || !branch || !filePath || !commitMessage) {
      return res.status(400).json({ error: 'repo, branch, filePath and commitMessage are required' });
    }

    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const member = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user.id, roomId: room.id } },
    });
    if (!member || member.role === 'VIEWER') {
      return res.status(403).json({ error: 'No permission to push' });
    }

    const token = req.user.githubToken;
    const [owner, repoName] = repo.split('/');
    const code = room.code;

    // 1. Get current HEAD commit SHA
    const refData = await ghFetch(`/repos/${owner}/${repoName}/git/ref/heads/${branch}`, token);
    const headSha = refData.object.sha;

    // 2. Get tree SHA from HEAD commit
    const headCommit = await ghFetch(`/repos/${owner}/${repoName}/git/commits/${headSha}`, token);
    const baseTreeSha = headCommit.tree.sha;

    // 3. Create blob with file content
    const blob = await ghFetch(`/repos/${owner}/${repoName}/git/blobs`, token, {
      method: 'POST',
      body: { content: code, encoding: 'utf-8' },
    });

    // 4. Create new tree
    const tree = await ghFetch(`/repos/${owner}/${repoName}/git/trees`, token, {
      method: 'POST',
      body: {
        base_tree: baseTreeSha,
        tree: [{ path: filePath, mode: '100644', type: 'blob', sha: blob.sha }],
      },
    });

    // 5. Create commit
    const commit = await ghFetch(`/repos/${owner}/${repoName}/git/commits`, token, {
      method: 'POST',
      body: {
        message: commitMessage,
        tree: tree.sha,
        parents: [headSha],
        author: {
          name: req.user.displayName || req.user.username,
          email: req.user.email || `${req.user.username}@users.noreply.github.com`,
          date: new Date().toISOString(),
        },
      },
    });

    // 6. Update branch reference
    await ghFetch(`/repos/${owner}/${repoName}/git/refs/heads/${branch}`, token, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });

    // 7. Save commit record in DB
    const dbCommit = await prisma.commit.create({
      data: {
        message: commitMessage,
        sha: commit.sha,
        githubUrl: `https://github.com/${owner}/${repoName}/commit/${commit.sha}`,
        code,
        language: room.language,
        status: 'SUCCESS',
        roomId: room.id,
        authorId: req.user.id,
      },
    });

    // 8. Update room's github settings
    await prisma.room.update({
      where: { slug },
      data: { githubRepo: repo, githubBranch: branch, githubPath: filePath },
    });

    logger.info(`GitHub push: ${repo}/${branch}/${filePath} by ${req.user.username}, sha: ${commit.sha}`);
    res.json({
      message: 'Pushed to GitHub successfully',
      commitSha: commit.sha,
      commitUrl: `https://github.com/${owner}/${repoName}/commit/${commit.sha}`,
      fileUrl: `https://github.com/${owner}/${repoName}/blob/${branch}/${filePath}`,
      dbCommit,
    });
  } catch (err) {
    // Mark failed commit in DB (best-effort)
    logger.error(`GitHub push error: ${err.message}`);
    next(err);
  }
};

// Get commit history for a room
const getCommitHistory = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const commits = await prisma.commit.findMany({
      where: { roomId: room.id },
      include: { author: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json(commits);
  } catch (err) {
    next(err);
  }
};

module.exports = { listRepos, listBranches, pushToGitHub, getCommitHistory };
