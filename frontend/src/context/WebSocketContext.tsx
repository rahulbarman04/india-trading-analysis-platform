import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const newSocket = io(import.meta.env.VITE_STREAMING_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    newSocket.on('connection-established', (data) => {
      console.log('Connection established:', data);
    });

    newSocket.on('heartbeat', (data) => {
      console.log('Heartbeat received:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const subscribe = (symbols: string[]) => {
    if (socket && isConnected) {
      socket.emit('subscribe', symbols);
      console.log('Subscribed to symbols:', symbols);
    }
  };

  const unsubscribe = (symbols: string[]) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', symbols);
      console.log('Unsubscribed from symbols:', symbols);
    }
  };

  const value = {
    socket,
    isConnected,
    subscribe,
    unsubscribe,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};