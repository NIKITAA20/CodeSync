import { useState, useEffect } from 'react';
import { githubAPI } from '../../services/api';
import { useRoomStore } from '../../store';
import toast from 'react-hot-toast';

export default function GitHubPanel({ slug, onPushComplete }) {
  const { room, language } = useRoomStore();
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [pushing, setPushing] = useState(false);

  const [form, setForm] = useState({
    repo: room?.githubRepo || '',
    branch: room?.githubBranch || 'main',
    filePath: room?.githubPath || '',
    commitMessage: '',
  });

  const EXT = { JAVASCRIPT: 'js', TYPESCRIPT: 'ts', PYTHON: 'py', CPP: 'cpp', JAVA: 'java', GO: 'go', RUST: 'rs' };

  useEffect(() => {
    setLoadingRepos(true);
    githubAPI.repos()
      .then(({ data }) => setRepos(data))
      .catch(() => toast.error('Failed to load GitHub repos'))
      .finally(() => setLoadingRepos(false));
  }, []);

  useEffect(() => {
    if (!form.repo) return;
    const [owner, repo] = form.repo.split('/');
    if (!owner || !repo) return;
    githubAPI.branches(owner, repo)
      .then(({ data }) => setBranches(data))
      .catch(() => {});
  }, [form.repo]);

  // Auto-suggest file path from room name
  useEffect(() => {
    if (!form.filePath && room) {
      const ext = EXT[language] || 'txt';
      const name = room.slug.replace(/-\d+$/, '');
      setForm((f) => ({ ...f, filePath: `${name}/index.${ext}` }));
    }
  }, [room, language]);

  const handlePush = async () => {
    if (!form.repo || !form.branch || !form.filePath || !form.commitMessage.trim()) {
      toast.error('Fill all fields before pushing');
      return;
    }
    setPushing(true);
    try {
      const { data } = await githubAPI.push(slug, form);
      toast.success('Pushed to GitHub!');
      onPushComplete?.(data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Push failed';
      toast.error(msg);
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] p-4 gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🐙</span>
        <div>
          <div className="font-bold text-sm text-white">Push to GitHub</div>
          <div className="text-[11px] text-[#64748B]">Commit your collaborative code</div>
        </div>
      </div>

      {/* Repository */}
      <div>
        <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">REPOSITORY</label>
        {loadingRepos ? (
          <div className="text-[11px] text-[#64748B] animate-pulse">Loading repos...</div>
        ) : (
          <select
            value={form.repo}
            onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value, branch: 'main' }))}
            className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[12px] text-[#E2E8F0] outline-none focus:border-[#00FF8860]"
          >
            <option value="">Select repository...</option>
            {repos.map((r) => (
              <option key={r.id} value={r.fullName}>
                {r.private ? '🔒 ' : ''}{r.fullName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Branch */}
      <div>
        <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">BRANCH</label>
        {branches.length > 0 ? (
          <select
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[12px] text-[#E2E8F0] outline-none focus:border-[#00FF8860]"
          >
            {branches.map((b) => (
              <option key={b.sha} value={b.name}>{b.name}</option>
            ))}
          </select>
        ) : (
          <input
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            placeholder="main"
            className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[12px] text-[#E2E8F0] outline-none focus:border-[#00FF8860] font-mono"
          />
        )}
      </div>

      {/* File path */}
      <div>
        <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">FILE PATH</label>
        <input
          value={form.filePath}
          onChange={(e) => setForm((f) => ({ ...f, filePath: e.target.value }))}
          placeholder={`codesync/index.${EXT[language] || 'txt'}`}
          className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[12px] text-[#E2E8F0] font-mono outline-none focus:border-[#00FF8860]"
        />
      </div>

      {/* Commit message */}
      <div>
        <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">COMMIT MESSAGE</label>
        <input
          value={form.commitMessage}
          onChange={(e) => setForm((f) => ({ ...f, commitMessage: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && handlePush()}
          placeholder="feat: add collaborative solution"
          className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[12px] text-[#E2E8F0] font-mono outline-none focus:border-[#00FF8860]"
        />
      </div>

      {/* Push button */}
      <button
        onClick={handlePush}
        disabled={pushing || !form.repo || !form.commitMessage.trim()}
        className="w-full py-2.5 rounded-lg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        style={{
          background: pushing ? '#1A2332' : 'linear-gradient(135deg, #00FF88, #00C8FF)',
          color: pushing ? '#64748B' : '#0A0E1A',
        }}
      >
        {pushing ? '⏳ Pushing...' : '⬆ Commit & Push to GitHub'}
      </button>

      {/* Commit history link */}
      {room?.githubRepo && (
        <a
          href={`https://github.com/${room.githubRepo}/commits/${room.githubBranch}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[11px] text-[#64748B] hover:text-[#00FF88] transition-colors"
        >
          View commit history on GitHub →
        </a>
      )}
    </div>
  );
}
