import { useState, useRef, useEffect, useCallback } from 'react';
import { useRoomStore, useAuthStore } from '../../store';
import { getSocket } from '../../services/socket';
import { formatDistanceToNow } from 'date-fns';

export default function Chat({ slug }) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { messages, typingUsers, onlineUsers } = useRoomStore();
  const { user } = useAuthStore();
  const socket = getSocket();
  const bottomRef = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInput = (e) => {
    setInput(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('chat:typing', { slug });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('chat:stop_typing', { slug });
    }, 1500);
  };

  const sendMessage = useCallback(() => {
    if (!input.trim()) return;
    socket.emit('chat:message', { slug, content: input.trim() });
    setInput('');
    setIsTyping(false);
    socket.emit('chat:stop_typing', { slug });
    clearTimeout(typingTimer.current);
  }, [input, slug, socket]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const typingList = Array.from(typingUsers)
    .filter((uid) => uid !== user?.id)
    .map((uid) => onlineUsers.find((u) => u.id === uid)?.username)
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-[#0D1117]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1E2A3A] flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest text-[#64748B]">LIVE CHAT</span>
        <span className="text-[10px] text-[#00FF88]">● {onlineUsers.length} online</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.type === 'SYSTEM' ? 'justify-center' : ''}`}>
            {msg.type === 'SYSTEM' ? (
              <span className="text-[10px] text-[#334155] italic">{msg.content}</span>
            ) : (
              <>
                <img
                  src={msg.user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.user?.username}`}
                  alt={msg.user?.username}
                  className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-[#E2E8F0]">
                      {msg.user?.displayName || msg.user?.username}
                      {msg.user?.id === user?.id && ' (you)'}
                    </span>
                    <span className="text-[9px] text-[#334155]">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] break-words leading-relaxed">{msg.content}</p>
                </div>
              </>
            )}
          </div>
        ))}

        {typingList.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full bg-[#4ECDC4] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#4ECDC4]">
              {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1E2A3A] flex gap-2">
        <textarea
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="Message..."
          rows={1}
          className="flex-1 bg-[#161B27] border border-[#2A3A4A] rounded-lg px-3 py-2 text-[11px] text-[#E2E8F0] placeholder-[#334155] resize-none outline-none focus:border-[#00FF8860] font-mono"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="bg-[#00FF8820] hover:bg-[#00FF8840] border border-[#00FF8840] text-[#00FF88] rounded-lg px-3 py-2 text-sm disabled:opacity-30 transition-colors"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
