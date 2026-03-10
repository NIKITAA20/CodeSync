import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomsAPI } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const LANGUAGES = ['JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'CPP', 'JAVA', 'GO', 'RUST'];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joinSlug, setJoinSlug] = useState('');

  const [form, setForm] = useState({ name: '', language: 'JAVASCRIPT', isPublic: true, maxMembers: 10 });

  useEffect(() => {
    roomsAPI.list()
      .then(({ data }) => setRooms(data))
      .catch(() => toast.error('Failed to load rooms'))
      .finally(() => setLoading(false));
  }, []);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Room name is required');
    setCreating(true);
    try {
      const { data } = await roomsAPI.create(form);
      navigate(`/room/${data.slug}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    const slug = joinSlug.trim();
    if (!slug) return;
    try {
      await roomsAPI.join(slug);
      navigate(`/room/${slug}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join room');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] font-mono text-[#E2E8F0]">
      {/* Header */}
      <div className="border-b border-[#1E2A3A] bg-[#0D1117] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00FF88] to-[#00C8FF] flex items-center justify-center text-[#0A0E1A] font-black">⚡</div>
          <span className="font-black text-lg">Code<span className="text-[#00FF88]">Sync</span></span>
        </div>
        <div className="flex items-center gap-3">
          <img src={user?.avatarUrl} alt={user?.username} className="w-8 h-8 rounded-full border border-[#1E2A3A]" />
          <span className="text-[12px] text-[#64748B]">{user?.displayName || user?.username}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Room */}
        <div className="bg-[#0D1117] border border-[#1E2A3A] rounded-2xl p-6">
          <h2 className="font-black text-lg mb-1">Create Room</h2>
          <p className="text-[12px] text-[#64748B] mb-6">Start a new collaborative session</p>

          <form onSubmit={createRoom} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">ROOM NAME</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Hackathon 2024"
                className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-xl px-4 py-2.5 text-[13px] text-[#E2E8F0] placeholder-[#334155] outline-none focus:border-[#00FF8860] transition-colors"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">LANGUAGE</label>
              <select
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-xl px-4 py-2.5 text-[13px] text-[#E2E8F0] outline-none focus:border-[#00FF8860]"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isPublic"
                checked={form.isPublic}
                onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
                className="w-4 h-4 accent-[#00FF88]"
              />
              <label htmlFor="isPublic" className="text-[12px] text-[#94A3B8]">Public room (anyone with link can join)</label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #00FF88, #00C8FF)', color: '#0A0E1A' }}
            >
              {creating ? '⏳ Creating...' : '⚡ Create Room'}
            </button>
          </form>
        </div>

        {/* Join Room */}
        <div className="bg-[#0D1117] border border-[#1E2A3A] rounded-2xl p-6">
          <h2 className="font-black text-lg mb-1">Join Room</h2>
          <p className="text-[12px] text-[#64748B] mb-6">Enter a room slug or paste an invite link</p>

          <form onSubmit={joinRoom} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-[#64748B] mb-1.5 block">ROOM SLUG / LINK</label>
              <input
                value={joinSlug}
                onChange={(e) => {
                  // Extract slug from full URL if pasted
                  const val = e.target.value;
                  const match = val.match(/\/room\/([a-z0-9-]+)/);
                  setJoinSlug(match ? match[1] : val);
                }}
                placeholder="sync-code-1234"
                className="w-full bg-[#161B27] border border-[#2A3A4A] rounded-xl px-4 py-2.5 text-[13px] text-[#E2E8F0] placeholder-[#334155] outline-none focus:border-[#00FF8860] transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!joinSlug.trim()}
              className="w-full py-3 rounded-xl font-bold text-sm bg-[#00FF8820] hover:bg-[#00FF8830] border border-[#00FF8840] text-[#00FF88] disabled:opacity-40 transition-all"
            >
              → Join Room
            </button>
          </form>

          {/* Recent Rooms */}
          {rooms.length > 0 && (
            <div className="mt-6">
              <div className="text-[10px] font-bold tracking-widest text-[#64748B] mb-3">RECENT ROOMS</div>
              <div className="space-y-2">
                {rooms.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/room/${r.slug}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#161B27] hover:bg-[#1A2332] border border-[#2A3A4A] rounded-xl transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#00FF88]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#E2E8F0] truncate">{r.name}</div>
                      <div className="text-[10px] text-[#64748B]">{r.slug} · {r.language}</div>
                    </div>
                    <div className="text-[10px] text-[#64748B]">{r.role}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
