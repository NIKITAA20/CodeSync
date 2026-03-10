import { useEffect, useCallback, useRef } from 'react';
import { useRoomStore, useAuthStore } from '../store';
import { getSocket } from '../services/socket';
import { roomsAPI } from '../services/api';
import toast from 'react-hot-toast';

const SAVE_DEBOUNCE_MS = 3000;

export const useRoom = (slug) => {
  const socket = getSocket();
  const { user } = useAuthStore();
  const {
    setRoom, setCode, setLanguage, setOnlineUsers, addUser, removeUser,
    addMessage, setMessages, updateCursor, removeCursor,
    setOutput, setRunning, addTyping, removeTyping, reset,
    code, language,
  } = useRoomStore();

  const saveTimer = useRef(null);

  // ─── Load initial room data ─────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;

    (async () => {
      try {
        const { data: room } = await roomsAPI.get(slug);
        setRoom(room);

        // Load messages
        const { data: msgs } = await roomsAPI.messages(slug);
        setMessages(msgs);
      } catch (err) {
        toast.error('Failed to load room');
      }
    })();

    return () => reset();
  }, [slug]);

  // ─── Socket events ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug || !user) return;

    socket.emit('room:join', { slug });

    socket.on('room:joined', ({ room, role }) => {
      setRoom(room);
    });

    socket.on('users:online', (users) => {
      setOnlineUsers(users);
    });

    socket.on('user:joined', ({ user: u }) => {
      addUser(u);
      toast(`${u.displayName || u.username} joined`, { icon: '👋', duration: 2000 });
    });

    socket.on('user:left', ({ userId, username }) => {
      removeUser(userId);
      removeCursor(userId);
      removeTyping(userId);
    });

    socket.on('code:change', ({ code: newCode, userId }) => {
      if (userId !== user.id) setCode(newCode);
    });

    socket.on('cursor:move', (cursorData) => {
      if (cursorData.userId !== user.id) updateCursor(cursorData.userId, cursorData);
    });

    socket.on('chat:message', (message) => addMessage(message));

    socket.on('chat:typing', ({ userId, username }) => {
      if (userId !== user.id) {
        addTyping(userId);
      }
    });

    socket.on('chat:stop_typing', ({ userId }) => removeTyping(userId));

    socket.on('language:change', ({ language: lang, changedBy }) => {
      setLanguage(lang);
      toast(`Language changed to ${lang} by ${changedBy}`, { icon: '🔄', duration: 2000 });
    });

    socket.on('execution:start', ({ triggeredBy }) => {
      setRunning(true);
      if (triggeredBy !== user.username) {
        toast(`${triggeredBy} is running code...`, { icon: '⚡', duration: 2000 });
      }
    });

    socket.on('execution:result', ({ result }) => {
      setOutput(result);
      setRunning(false);
    });

    socket.on('github:push_complete', ({ commitUrl, message: msg, pushedBy }) => {
      toast.success(`${pushedBy} pushed to GitHub!`, { duration: 4000 });
    });

    socket.on('error', ({ message }) => toast.error(message));

    return () => {
      socket.off('room:joined');
      socket.off('users:online');
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('code:change');
      socket.off('cursor:move');
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('chat:stop_typing');
      socket.off('language:change');
      socket.off('execution:start');
      socket.off('execution:result');
      socket.off('github:push_complete');
      socket.off('error');
    };
  }, [slug, user]);

  // ─── Emit code change ───────────────────────────────────────────────────
  const emitCodeChange = useCallback((newCode) => {
    setCode(newCode);
    socket.emit('code:change', { slug, code: newCode });

    // Debounce DB save
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      socket.emit('code:save', { slug, code: newCode });
    }, SAVE_DEBOUNCE_MS);
  }, [slug]);

  const emitCursorMove = useCallback((line, column, selection) => {
    socket.emit('cursor:move', { slug, line, column, selection });
  }, [slug]);

  const emitLanguageChange = useCallback((lang) => {
    socket.emit('language:change', { slug, language: lang });
  }, [slug]);

  const emitExecutionStart = useCallback(() => {
    socket.emit('execution:start', { slug });
  }, [slug]);

  const emitExecutionResult = useCallback((result) => {
    socket.emit('execution:result', { slug, result });
  }, [slug]);

  const emitGithubPushComplete = useCallback((data) => {
    socket.emit('github:push_complete', { slug, ...data });
  }, [slug]);

  return {
    emitCodeChange,
    emitCursorMove,
    emitLanguageChange,
    emitExecutionStart,
    emitExecutionResult,
    emitGithubPushComplete,
  };
};
