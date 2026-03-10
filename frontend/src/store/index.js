import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('cs_token') || null,
  isLoading: true,

  setUser: (user) => set({ user, isLoading: false }),
  setToken: (token) => {
    localStorage.setItem('cs_token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('cs_token');
    set({ user: null, token: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));

export const useRoomStore = create((set, get) => ({
  room: null,
  code: '',
  language: 'JAVASCRIPT',
  onlineUsers: [],
  messages: [],
  cursors: {}, // { userId: { line, column, username, avatarUrl } }
  output: null,
  isRunning: false,
  typingUsers: new Set(),

  setRoom: (room) => set({ room, code: room.code, language: room.language }),
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  addUser: (user) =>
    set((s) => ({ onlineUsers: [...s.onlineUsers.filter((u) => u.id !== user.id), user] })),
  removeUser: (userId) =>
    set((s) => ({ onlineUsers: s.onlineUsers.filter((u) => u.id !== userId) })),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),

  updateCursor: (userId, cursorData) =>
    set((s) => ({ cursors: { ...s.cursors, [userId]: cursorData } })),
  removeCursor: (userId) =>
    set((s) => {
      const cursors = { ...s.cursors };
      delete cursors[userId];
      return { cursors };
    }),

  setOutput: (output) => set({ output }),
  setRunning: (isRunning) => set({ isRunning }),

  addTyping: (userId) =>
    set((s) => {
      const t = new Set(s.typingUsers);
      t.add(userId);
      return { typingUsers: t };
    }),
  removeTyping: (userId) =>
    set((s) => {
      const t = new Set(s.typingUsers);
      t.delete(userId);
      return { typingUsers: t };
    }),

  reset: () =>
    set({
      room: null, code: '', language: 'JAVASCRIPT',
      onlineUsers: [], messages: [], cursors: {},
      output: null, isRunning: false, typingUsers: new Set(),
    }),
}));
