import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, MessageSquare, Send, Search, Paperclip, Camera, MapPin, 
  Image as ImageIcon, FileText, Smile, MoreVertical, Phone, Video, X 
} from 'lucide-react';

// Dummy conversations for demonstration
const DUMMY_CONVERSATIONS = [
  {
    id: '1',
    user: { id: 'user_sarah_123', name: 'Sarah Johnson', avatar_color: 'bg-blue-600' },
    lastMessage: "See you at the park! 🏃",
    lastMessageType: 'text',
    timestamp: '2m ago',
    unread: 2
  },
  {
    id: '2',
    user: { id: 'user_mike_456', name: 'Mike Chen', avatar_color: 'bg-green-600' },
    lastMessage: 'route-map.png',
    lastMessageType: 'image',
    timestamp: '1h ago',
    unread: 0
  },
  {
    id: '3',
    user: { id: 'user_emma_789', name: 'Emma Davis', avatar_color: 'bg-purple-600' },
    lastMessage: 'Training schedule updated',
    lastMessageType: 'document',
    timestamp: '3h ago',
    unread: 0
  }
];

// Dummy messages with different types
const DUMMY_MESSAGES = {
  '1': [
    { id: 'm1', sender_id: 'user_sarah_123', type: 'text', content: "Hi! Want to go running?", timestamp: '10:30 AM', isOwn: false },
    { id: 'm2', sender_id: 'me', type: 'text', content: "Sure! Where and when?", timestamp: '10:32 AM', isOwn: true },
    { id: 'm3', sender_id: 'user_sarah_123', type: 'location', content: "Golden Gate Park", lat: 37.7694, lng: -122.4862, timestamp: '10:33 AM', isOwn: false },
    { id: 'm4', sender_id: 'me', type: 'text', content: "Perfect! What time?", timestamp: '10:34 AM', isOwn: true },
    { id: 'm5', sender_id: 'user_sarah_123', type: 'text', content: "See you at the park! 🏃", timestamp: '2m ago', isOwn: false }
  ],
  '2': [
    { id: 'm6', sender_id: 'user_mike_456', type: 'text', content: "Check out this route I found!", timestamp: '1h ago', isOwn: false },
    { id: 'm7', sender_id: 'user_mike_456', type: 'image', content: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Route+Map', filename: 'route-map.png', timestamp: '1h ago', isOwn: false },
    { id: 'm8', sender_id: 'me', type: 'text', content: "Looks amazing! 🔥", timestamp: '55m ago', isOwn: true }
  ],
  '3': [
    { id: 'm9', sender_id: 'user_emma_789', type: 'text', content: "Here's the training schedule", timestamp: '3h ago', isOwn: false },
    { id: 'm10', sender_id: 'user_emma_789', type: 'document', content: 'training-schedule-march.pdf', fileSize: '245 KB', timestamp: '3h ago', isOwn: false },
    { id: 'm11', sender_id: 'me', type: 'text', content: "Thanks! I'll review it tonight", timestamp: '2h ago', isOwn: true }
  ]
};

function Messages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState(DUMMY_CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setConversations(DUMMY_CONVERSATIONS);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = (conversationId) => {
    const msgs = DUMMY_MESSAGES[conversationId] || [];
    setMessages(msgs);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      sender_id: user?.id,
      type: 'text',
      content: newMessage,
      timestamp: 'Just now',
      isOwn: true
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const message = {
      id: Date.now().toString(),
      sender_id: user?.id,
      type: isImage ? 'image' : 'document',
      content: isImage ? URL.createObjectURL(file) : file.name,
      filename: file.name,
      fileSize: `${(file.size / 1024).toFixed(0)} KB`,
      timestamp: 'Just now',
      isOwn: true
    };

    setMessages([...messages, message]);
    setShowAttachMenu(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const message = {
      id: Date.now().toString(),
      sender_id: user?.id,
      type: 'image',
      content: URL.createObjectURL(file),
      filename: file.name,
      timestamp: 'Just now',
      isOwn: true
    };

    setMessages([...messages, message]);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const shareLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const message = {
            id: Date.now().toString(),
            sender_id: user?.id,
            type: 'location',
            content: 'My current location',
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: 'Just now',
            isOwn: true
          };
          setMessages([...messages, message]);
          setShowAttachMenu(false);
        },
        (error) => {
          alert('Unable to get your location. Please enable location services.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
  };

  const renderMessage = (message) => {
    const isOwn = message.isOwn;

    return (
      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
          {/* Message Content */}
          <div className={`rounded-lg px-4 py-2 ${
            isOwn 
              ? 'bg-blue-600 text-white' 
              : 'bg-white border border-slate-200 text-slate-900'
          }`}>
            {message.type === 'text' && (
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            )}

            {message.type === 'image' && (
              <div className="space-y-2">
                <img 
                  src={message.content} 
                  alt={message.filename} 
                  className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
                  onClick={() => window.open(message.content, '_blank')}
                />
                {message.filename && (
                  <p className="text-xs opacity-80">{message.filename}</p>
                )}
              </div>
            )}

            {message.type === 'document' && (
              <div className="flex items-center space-x-3 py-2">
                <div className={`p-2 rounded ${isOwn ? 'bg-blue-700' : 'bg-slate-100'}`}>
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.content}</p>
                  {message.fileSize && (
                    <p className="text-xs opacity-75">{message.fileSize}</p>
                  )}
                </div>
              </div>
            )}

            {message.type === 'location' && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm font-medium">{message.content}</span>
                </div>
                <div 
                  className="w-full h-32 bg-slate-200 rounded cursor-pointer hover:opacity-90 transition flex items-center justify-center"
                  onClick={() => window.open(`https://www.google.com/maps?q=${message.lat},${message.lng}`, '_blank')}
                >
                  <div className="text-center">
                    <MapPin className="h-8 w-8 mx-auto mb-1 opacity-50" />
                    <p className="text-xs opacity-75">Click to open in maps</p>
                  </div>
                </div>
                <p className="text-xs opacity-75">
                  {message.lat?.toFixed(4)}, {message.lng?.toFixed(4)}
                </p>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <p className={`text-xs text-slate-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
            {message.timestamp}
          </p>
        </div>
      </div>
    );
  };

  const filteredConversations = conversations.filter(conv =>
    conv.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col">
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
      <div className="flex-1 flex overflow-hidden">
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
                      selectedConversation?.id === conversation.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 h-12 w-12 rounded-full ${conversation.user.avatar_color} flex items-center justify-center`}>
                        <span className="text-white font-semibold">
                          {conversation.user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-semibold text-slate-900 truncate">
                            {conversation.user.name}
                          </h3>
                          <span className="text-xs text-slate-500">{conversation.timestamp}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-slate-600 truncate flex items-center space-x-1">
                            {conversation.lastMessageType === 'image' && <ImageIcon className="h-3 w-3" />}
                            {conversation.lastMessageType === 'document' && <FileText className="h-3 w-3" />}
                            {conversation.lastMessageType === 'location' && <MapPin className="h-3 w-3" />}
                            <span>{conversation.lastMessage}</span>
                          </p>
                          {conversation.unread > 0 && (
                            <span className="ml-2 flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                              {conversation.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`h-10 w-10 rounded-full ${selectedConversation.user.avatar_color} flex items-center justify-center`}>
                    <span className="text-white font-semibold text-sm">
                      {selectedConversation.user.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900">{selectedConversation.user.name}</h2>
                    <p className="text-xs text-green-600">Online</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <Video className="h-5 w-5" />
                  </button>
                  <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map(renderMessage)}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-white border-t border-slate-200 px-6 py-4">
                <form onSubmit={sendMessage} className="flex items-end space-x-3">
                  {/* Attachment Menu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition"
                    >
                      {showAttachMenu ? <X className="h-5 w-5" /> : <Paperclip className="h-5 w-5" />}
                    </button>

                    {showAttachMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 p-2 w-48">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-slate-50 rounded-md transition text-left"
                        >
                          <FileText className="h-5 w-5 text-blue-600" />
                          <span className="text-sm text-slate-700">Document</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-slate-50 rounded-md transition text-left"
                        >
                          <ImageIcon className="h-5 w-5 text-green-600" />
                          <span className="text-sm text-slate-700">Photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-slate-50 rounded-md transition text-left"
                        >
                          <Camera className="h-5 w-5 text-purple-600" />
                          <span className="text-sm text-slate-700">Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={shareLocation}
                          className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-slate-50 rounded-md transition text-left"
                        >
                          <MapPin className="h-5 w-5 text-red-600" />
                          <span className="text-sm text-slate-700">Location</span>
                        </button>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="*/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="hidden"
                    />
                  </div>

                  {/* Emoji Button */}
                  <button
                    type="button"
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition"
                  >
                    <Smile className="h-5 w-5" />
                  </button>

                  {/* Message Input */}
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(e);
                      }
                    }}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 resize-none px-4 py-2 border border-slate-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-20 w-20 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Select a conversation</h3>
                <p className="text-slate-600 text-sm">
                  Choose a conversation from the list to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
