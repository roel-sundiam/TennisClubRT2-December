import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export interface FinancialUpdateEvent {
  type: 'financial_data_updated';
  data: any;
  timestamp: string;
  message: string;
}

export interface CourtUsageUpdateEvent {
  type: 'court_usage_data_updated';
  data: any;
  timestamp: string;
  message: string;
}

export interface OpenPlayNotificationEvent {
  type: 'open_play_created' | 'open_play_updated' | 'open_play_closed';
  data: {
    pollId: string;
    title: string;
    description: string;
    eventDate: string;
    startTime: number;
    endTime: number;
    maxPlayers: number;
    confirmedPlayers: number;
    createdBy: {
      _id: string;
      username: string;
      fullName: string;
    };
  };
  timestamp: string;
  message: string;
}

export interface ChatMessageEvent {
  type: 'new_message' | 'message_edited' | 'message_deleted';
  data: {
    _id: string;
    roomId: string;
    userId: string;
    user: {
      _id: string;
      username: string;
      fullName: string;
      profilePicture?: string;
      role: string;
    };
    content: string;
    type: 'text' | 'system' | 'announcement';
    isEdited: boolean;
    editedAt?: string;
    isDeleted: boolean;
    deletedAt?: string;
    deletedBy?: string;
    replyTo?: string;
    metadata?: {
      systemType?: string;
      mentions?: string[];
    };
    createdAt: string;
    updatedAt: string;
  };
  timestamp: string;
  message: string;
}

export interface ChatTypingEvent {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ChatUserStatusEvent {
  type: 'user_joined' | 'user_left' | 'user_online' | 'user_offline';
  data: {
    roomId?: string;
    userId: string;
    username: string;
    fullName: string;
  };
  timestamp: string;
}

export interface AnnouncementEvent {
  _id: string;
  title: string;
  content: string;
  createdBy: any;
  createdAt: Date;
}

export class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedClients: Set<Socket> = new Set();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs
  private typingUsers: Map<string, Set<string>> = new Map(); // roomId -> Set of userIds who are typing

  constructor() {
    console.log('🔌 WebSocket Service initialized');
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ["http://localhost:4200", "http://localhost:4201"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket: Socket) => {
      console.log('🔗 Client connected to WebSocket:', socket.id);
      this.connectedClients.add(socket);

      // Handle client subscription to financial updates
      socket.on('subscribe_financial_updates', () => {
        console.log('📊 Client subscribed to financial updates:', socket.id);
        socket.join('financial_updates');
        socket.emit('subscription_confirmed', { type: 'financial_updates' });
      });

      // Handle client unsubscription
      socket.on('unsubscribe_financial_updates', () => {
        console.log('📊 Client unsubscribed from financial updates:', socket.id);
        socket.leave('financial_updates');
      });

      // Handle client subscription to court usage updates
      socket.on('subscribe_court_usage_updates', () => {
        console.log('🏸 Client subscribed to court usage updates:', socket.id);
        socket.join('court_usage_updates');
        socket.emit('subscription_confirmed', { type: 'court_usage_updates' });
      });

      // Handle client unsubscription from court usage
      socket.on('unsubscribe_court_usage_updates', () => {
        console.log('🏸 Client unsubscribed from court usage updates:', socket.id);
        socket.leave('court_usage_updates');
      });

      // Handle client subscription to open play notifications
      socket.on('subscribe_open_play_notifications', () => {
        console.log('🎾 Client subscribed to open play notifications:', socket.id);
        socket.join('open_play_notifications');
        socket.emit('subscription_confirmed', { type: 'open_play_notifications' });
      });

      // Handle client unsubscription from open play notifications
      socket.on('unsubscribe_open_play_notifications', () => {
        console.log('🎾 Client unsubscribed from open play notifications:', socket.id);
        socket.leave('open_play_notifications');
      });

      // Handle client subscription to announcements
      socket.on('subscribe_announcements', () => {
        console.log('📢 Client subscribed to announcements:', socket.id);
        socket.join('announcements');
        socket.emit('subscription_confirmed', { type: 'announcements' });
      });

      // Handle client unsubscription from announcements
      socket.on('unsubscribe_announcements', () => {
        console.log('📢 Client unsubscribed from announcements:', socket.id);
        socket.leave('announcements');
      });

      // Chat-related socket handlers

      // Handle user authentication for chat
      socket.on('chat_authenticate', (userData: { userId: string; username: string; fullName: string; role?: string }) => {
        console.log('💬 Chat authentication for user:', userData.username);

        // Store user-socket mapping
        if (!this.userSockets.has(userData.userId)) {
          this.userSockets.set(userData.userId, new Set());
        }
        this.userSockets.get(userData.userId)!.add(socket.id);

        // Store user data on socket for later use
        (socket as any).userData = userData;

        socket.emit('chat_authenticated', { success: true });
      });

      // Handle joining chat rooms
      socket.on('join_chat_room', (roomId: string) => {
        console.log('💬 User joining chat room:', roomId, 'Socket:', socket.id);
        socket.join(`chat_room_${roomId}`);
        
        // Notify other participants that user is online
        if ((socket as any).userData) {
          const userData = (socket as any).userData;
          socket.to(`chat_room_${roomId}`).emit('user_status_changed', {
            type: 'user_online',
            data: {
              roomId,
              userId: userData.userId,
              username: userData.username,
              fullName: userData.fullName
            },
            timestamp: new Date().toISOString()
          } as ChatUserStatusEvent);
        }
      });

      // Handle leaving chat rooms
      socket.on('leave_chat_room', (roomId: string) => {
        console.log('💬 User leaving chat room:', roomId, 'Socket:', socket.id);
        socket.leave(`chat_room_${roomId}`);
        
        // Notify other participants that user left
        if ((socket as any).userData) {
          const userData = (socket as any).userData;
          socket.to(`chat_room_${roomId}`).emit('user_status_changed', {
            type: 'user_offline',
            data: {
              roomId,
              userId: userData.userId,
              username: userData.username,
              fullName: userData.fullName
            },
            timestamp: new Date().toISOString()
          } as ChatUserStatusEvent);
        }
      });

      // Handle typing indicators
      socket.on('chat_typing_start', (data: { roomId: string }) => {
        if (!(socket as any).userData) return;
        
        const userData = (socket as any).userData;
        const { roomId } = data;
        
        // Add user to typing users for this room
        if (!this.typingUsers.has(roomId)) {
          this.typingUsers.set(roomId, new Set());
        }
        this.typingUsers.get(roomId)!.add(userData.userId);
        
        // Notify other participants
        socket.to(`chat_room_${roomId}`).emit('user_typing', {
          roomId,
          userId: userData.userId,
          username: userData.username,
          isTyping: true
        } as ChatTypingEvent);
      });

      socket.on('chat_typing_stop', (data: { roomId: string }) => {
        if (!(socket as any).userData) return;
        
        const userData = (socket as any).userData;
        const { roomId } = data;
        
        // Remove user from typing users for this room
        if (this.typingUsers.has(roomId)) {
          this.typingUsers.get(roomId)!.delete(userData.userId);
        }
        
        // Notify other participants
        socket.to(`chat_room_${roomId}`).emit('user_typing', {
          roomId,
          userId: userData.userId,
          username: userData.username,
          isTyping: false
        } as ChatTypingEvent);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        this.connectedClients.delete(socket);
        
        // Clean up user-socket mapping
        if ((socket as any).userData) {
          const userId = (socket as any).userData.userId;
          if (this.userSockets.has(userId)) {
            this.userSockets.get(userId)!.delete(socket.id);
            if (this.userSockets.get(userId)!.size === 0) {
              this.userSockets.delete(userId);
            }
          }
          
          // Clean up typing indicators
          this.typingUsers.forEach((typingSet, roomId) => {
            if (typingSet.has(userId)) {
              typingSet.delete(userId);
              // Notify others that user stopped typing
              socket.to(`chat_room_${roomId}`).emit('user_typing', {
                roomId,
                userId,
                username: (socket as any).userData.username,
                isTyping: false
              } as ChatTypingEvent);
            }
          });
        }
      });

      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to Tennis Club RT2 real-time updates',
        timestamp: new Date().toISOString()
      });
    });

    console.log('✅ Socket.IO server initialized with CORS for Angular dev server');
  }

  /**
   * Emit financial data update to all subscribed clients
   */
  emitFinancialUpdate(updateData: FinancialUpdateEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit financial update');
      return;
    }

    console.log('📡 Broadcasting financial update to subscribed clients');
    console.log(`💰 Fund Balance Updated: ₱${updateData.data.fundBalance?.toLocaleString()}`);
    
    // Emit to all clients subscribed to financial updates
    this.io.to('financial_updates').emit('financial_update', updateData);

    // Also emit to all connected clients as a fallback
    this.io.emit('financial_data_changed', {
      message: updateData.message,
      timestamp: updateData.timestamp
    });
  }

  /**
   * Emit general broadcast message
   */
  broadcast(event: string, data: any): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot broadcast');
      return;
    }

    console.log(`📡 Broadcasting ${event} to all clients`);
    this.io.emit(event, data);
  }

  /**
   * Get connection statistics
   */
  getStats(): { connectedClients: number; rooms: string[] } {
    if (!this.io) {
      return { connectedClients: 0, rooms: [] };
    }

    const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
      .filter(room => !this.io!.sockets.sockets.has(room)); // Filter out socket IDs

    return {
      connectedClients: this.connectedClients.size,
      rooms
    };
  }

  /**
   * Emit court usage data update to all subscribed clients
   */
  emitCourtUsageUpdate(updateData: CourtUsageUpdateEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit court usage update');
      return;
    }

    console.log('📡 Broadcasting court usage update to subscribed clients');
    console.log(`🏸 Court Usage Updated: ${updateData.data.summary?.totalMembers} members, ${updateData.data.summary?.totalRevenue} revenue`);
    
    // Emit to all clients subscribed to court usage updates
    this.io.to('court_usage_updates').emit('court_usage_update', updateData);

    // Also emit to all connected clients as a fallback
    this.io.emit('court_usage_data_changed', {
      message: updateData.message,
      timestamp: updateData.timestamp
    });
  }

  /**
   * Emit open play notification to all subscribed clients
   */
  emitOpenPlayNotification(notificationData: OpenPlayNotificationEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit open play notification');
      return;
    }

    console.log('📡 Broadcasting open play notification to subscribed clients');
    console.log(`🎾 Open Play Event: ${notificationData.data.title} on ${new Date(notificationData.data.eventDate).toLocaleDateString()}`);
    console.log(`🎾 Event times: ${notificationData.data.startTime}:00 - ${notificationData.data.endTime}:00`);
    console.log('🎾 Full notification data:', JSON.stringify(notificationData, null, 2));
    
    // Emit to all clients subscribed to open play notifications
    this.io.to('open_play_notifications').emit('open_play_notification', notificationData);

    // Also emit to all connected clients as a general notification
    this.io.emit('open_play_event', {
      message: notificationData.message,
      timestamp: notificationData.timestamp,
      pollId: notificationData.data.pollId,
      eventDate: notificationData.data.eventDate,
      title: notificationData.data.title,
      startTime: notificationData.data.startTime,
      endTime: notificationData.data.endTime
    });
  }

  /**
   * Check if WebSocket service is initialized
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Emit chat message to all participants in a room
   */
  emitChatMessage(messageEvent: ChatMessageEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit chat message');
      return;
    }

    const roomChannel = `chat_room_${messageEvent.data.roomId}`;
    console.log(`💬 Broadcasting ${messageEvent.type} to room ${messageEvent.data.roomId}`);
    
    // Emit to all clients in the chat room
    this.io.to(roomChannel).emit('chat_message', messageEvent);

    // For announcement messages, also emit to general notification channel
    if (messageEvent.data.type === 'announcement') {
      this.io.emit('chat_announcement', {
        roomId: messageEvent.data.roomId,
        message: messageEvent.data.content,
        author: messageEvent.data.user.fullName,
        timestamp: messageEvent.timestamp
      });
    }
  }

  /**
   * Emit typing indicator to room participants
   */
  emitTypingIndicator(typingEvent: ChatTypingEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit typing indicator');
      return;
    }

    const roomChannel = `chat_room_${typingEvent.roomId}`;
    this.io.to(roomChannel).emit('user_typing', typingEvent);
  }

  /**
   * Emit user status change to room participants
   */
  emitUserStatusChange(statusEvent: ChatUserStatusEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit user status change');
      return;
    }

    if (statusEvent.data.roomId) {
      const roomChannel = `chat_room_${statusEvent.data.roomId}`;
      this.io.to(roomChannel).emit('user_status_changed', statusEvent);
    } else {
      // Global user status change
      this.io.emit('user_status_changed', statusEvent);
    }
  }

  /**
   * Send notification to specific user (all their connected sockets)
   */
  sendNotificationToUser(userId: string, event: string, data: any): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot send notification to user');
      return;
    }

    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds && userSocketIds.size > 0) {
      console.log(`📱 Sending ${event} notification to user ${userId} (${userSocketIds.size} sockets)`);
      
      userSocketIds.forEach(socketId => {
        const socket = this.io!.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      });
    }
  }

  /**
   * Get online users in a chat room
   */
  getOnlineUsersInRoom(roomId: string): string[] {
    if (!this.io) {
      return [];
    }

    const roomChannel = `chat_room_${roomId}`;
    const room = this.io.sockets.adapter.rooms.get(roomChannel);
    
    if (!room) {
      return [];
    }

    const onlineUsers: string[] = [];
    room.forEach(socketId => {
      const socket = this.io!.sockets.sockets.get(socketId);
      if (socket && (socket as any).userData) {
        onlineUsers.push((socket as any).userData.userId);
      }
    });

    return [...new Set(onlineUsers)]; // Remove duplicates
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    const userSocketIds = this.userSockets.get(userId);
    return userSocketIds !== undefined && userSocketIds.size > 0;
  }

  /**
   * Emit announcement to all subscribed clients
   */
  emitAnnouncement(announcementData: AnnouncementEvent): void {
    if (!this.io) {
      console.warn('⚠️  WebSocket not initialized - cannot emit announcement');
      return;
    }

    console.log('📡 Broadcasting announcement to subscribed clients');
    console.log(`📢 Announcement: ${announcementData.title}`);

    // Emit to all clients subscribed to announcements
    this.io.to('announcements').emit('announcement_notification', announcementData);

    // Also emit to all connected clients as a fallback
    this.io.emit('new_announcement', {
      message: `New announcement: ${announcementData.title}`,
      timestamp: new Date().toISOString(),
      announcement: announcementData
    });
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();