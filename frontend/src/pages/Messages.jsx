import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, MessageSquare, Send, Search } from 'lucide-react';

function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      // Simulate API call
      setTimeout(() => {
        const mockConversations = [
          {
            id: '1',
            user: { id: 'user1', name: 'Sarah Johnson', avatar_color: 'bg-blue-600' },
            lastMessage: 'Great run today! 🏃',
            timestamp: '2m ago',
            unread: true
          },
          {
            id: '2',
            user: { id: 'user2', name: 'Mike Chen', avatar_color: 'bg-purple-600' },
            lastMessage: 'Want to join me for a ride tomorrow?',
            timestamp: '1h ago',
            unread: false
          },
          {
            id: '3',
            user: { id: 'user3', name: 'Emma Davis', avatar_color: 'bg-green-600' },
            lastMessage: 'Thanks for the route recommendation!',
            timestamp: '2d ago',
            unread: false
          }
        ];

        setConversations(mockConversations);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    // Simulate API call
    const mockMessages = [
      {
        id: '1',
        sender_id: 'user1',
        content: 'Hey! Did you see my latest cycling activity?',
        timestamp: '10:30 AM',
        isOwn: false
      },
      {
        id: '2',
        sender_id: user?.id,
        content: 'Yes! That was impressive! How did you manage that elevation?',
        timestamp: '10:35 AM',
        isOwn: true
      },
      {
        id: '3',
        sender_id: 'user1',
        content: 'Lots of training! You should try that route too.',
        timestamp: '10:40 AM',
        isOwn: false
      },
      {
        id: '4',
        sender_id: user?.id,
        content: 'I will! Can you share the route details?',
        timestamp: '10:42 AM',
        isOwn: true
      },
      {
        id: '5',
        sender_id: 'user1',
        content: 'Great run today! 🏃',
        timestamp: '2m ago',
        isOwn: false
      }
    ];
    setMessages(mockMessages);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      sender_id: user?.id,
      content: newMessage,
      timestamp: 'Just now',
      isOwn: true
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col fixed inset-0 z-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(-1)}
              className="text-slate-600 hover:text-slate-900 transition"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <MessageSquare className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Conversations List */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No conversations</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full p-4 hover:bg-slate-50 transition text-left ${
                      selectedConversation?.id === conversation.id ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 h-12 w-12 rounded-full ${conversation.user.avatar_color} flex items-center justify-center`}>
                        <span className="text-white font-semibold text-sm">
                          {conversation.user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900 truncate">
                            {conversation.user.name}
                          </span>
                          <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                            {conversation.timestamp}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 truncate">
                          {conversation.lastMessage}
                        </p>
                      </div>
                      {conversation.unread && (
                        <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Select a conversation
                </h3>
                <p className="text-slate-600 text-sm">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex items-center space-x-3">
                  <div className={`h-10 w-10 rounded-full ${selectedConversation.user.avatar_color} flex items-center justify-center`}>
                    <span className="text-white font-semibold text-sm">
                      {selectedConversation.user.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">
                      {selectedConversation.user.name}
                    </div>
                    <div className="text-xs text-slate-500">Active now</div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-md ${message.isOwn ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          message.isOwn
                            ? 'bg-slate-800 text-white'
                            : 'bg-white border border-slate-200 text-slate-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 px-1">
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="bg-white border-t border-slate-200 p-4">
                <form onSubmit={sendMessage} className="flex space-x-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;

