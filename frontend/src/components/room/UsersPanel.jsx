import { useRoomStore, useAuthStore } from '../../store';

const ROLE_COLORS = { ADMIN: '#00FF88', EDITOR: '#4ECDC4', VIEWER: '#64748B' };

export default function UsersPanel() {
  const { onlineUsers, room } = useRoomStore();
  const { user } = useAuthStore();

  return (
    <div className="flex flex-col h-full bg-[#0D1117]">
      <div className="px-4 py-3 border-b border-[#1E2A3A]">
        <span className="text-[10px] font-bold tracking-widest text-[#64748B]">
          COLLABORATORS · {onlineUsers.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {onlineUsers.map((u) => (
          <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#0A0E1A] transition-colors">
            <div className="relative flex-shrink-0">
              <img
                src={u.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                alt={u.username}
                className="w-8 h-8 rounded-full"
                style={{ border: `2px solid ${ROLE_COLORS[u.role] || '#64748B'}40` }}
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00FF88] border-2 border-[#0D1117]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-[#E2E8F0] truncate">
                {u.displayName || u.username}
                {u.id === user?.id && <span className="text-[#64748B] font-normal"> (you)</span>}
              </div>
              <div className="text-[10px]" style={{ color: ROLE_COLORS[u.role] }}>
                {u.role}
              </div>
            </div>
          </div>
        ))}

        {onlineUsers.length === 0 && (
          <div className="text-[11px] text-[#334155] text-center py-4">No users online yet</div>
        )}
      </div>

      {/* Invite link */}
      <div className="p-3 border-t border-[#1E2A3A]">
        <div className="text-[10px] font-bold tracking-widest text-[#64748B] mb-2">INVITE LINK</div>
        <div
          className="bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[10px] text-[#64748B] font-mono cursor-pointer hover:border-[#00FF8860] transition-colors truncate"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            // toast handled externally
          }}
          title="Click to copy"
        >
          {window.location.href}
        </div>
        <div className="text-[9px] text-[#334155] mt-1 text-center">Click to copy invite link</div>
      </div>
    </div>
  );
}
