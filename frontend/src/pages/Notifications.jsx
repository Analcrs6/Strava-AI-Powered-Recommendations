import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Bell, UserPlus, Heart, MessageSquare, TrendingUp, MapPin, ImageIcon } from 'lucide-react';

// Dummy notifications data
const DUMMY_NOTIFICATIONS = [
  {
    id: 'notif_1',
    type: 'nearby',
    title: 'Sarah Johnson is nearby!',
    message: 'Only 250m away - Want to run together?',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unread: true,
    user_id: 'user_sarah_123',
    user_name: 'Sarah Johnson'
  },
  {
    id: 'notif_2',
    type: 'nearby',
    title: 'Alex Martinez is nearby!',
    message: 'Only 320m away and running 5.1km',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    unread: true,
    user_id: 'user_alex_321',
    user_name: 'Alex Martinez'
  },
  {
    id: 'notif_3',
    type: 'message',
    title: 'New message from Mike Chen',
    message: 'Great route today! Thanks for the tip.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    unread: false,
    user_id: 'user_mike_456',
    user_name: 'Mike Chen'
  },
  {
    id: 'notif_4',
    type: 'follow',
    title: 'Emma Davis followed you',
    message: 'Emma started following you',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    unread: false,
    user_id: 'user_emma_789',
    user_name: 'Emma Davis'
  },
  {
    id: 'notif_5',
    type: 'like',
    title: 'Mike Chen liked your activity',
    message: 'Morning Run - 8.5 km',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    unread: false,
    user_id: 'user_mike_456'
  },
  {
    id: 'notif_6',
    type: 'comment',
    title: 'Sarah Johnson commented on your activity',
    message: 'Amazing pace! Keep it up! 💪',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unread: false,
    user_id: 'user_sarah_123'
  }
];

function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      // Load dummy notifications immediately
      setNotifications(DUMMY_NOTIFICATIONS);
      setLoading(false);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setNotifications([]);
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'nearby':
        return <MapPin className="h-5 w-5 text-orange-600" />;
      case 'follow':
        return <UserPlus className="h-5 w-5 text-blue-600" />;
      case 'like':
        return <Heart className="h-5 w-5 text-red-600" />;
      case 'comment':
        return <MessageSquare className="h-5 w-5 text-green-600" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'recommendation':
        return <TrendingUp className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5 text-slate-600" />;
    }
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Bell className="h-7 w-7 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
          </div>
          {notifications.some(n => n.unread) && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-slate-600 hover:text-slate-900 transition"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No notifications</h3>
              <p className="text-slate-600 text-sm">
                You're all caught up! Notifications will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => {
                    if (notification.type === 'nearby') {
                      navigate('/nearby');
                    } else if (notification.type === 'message') {
                      navigate('/messages');
                    } else if (notification.type === 'follow') {
                      navigate(`/profile/${notification.user_id}`);
                    }
                  }}
                  className={`w-full p-4 hover:bg-slate-50 transition text-left ${
                    notification.unread ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className={`flex-shrink-0 h-12 w-12 rounded-full ${notification.user.avatar_color} flex items-center justify-center`}>
                      <span className="text-white font-semibold text-sm">
                        {notification.user.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">
                            <span className="font-semibold">{notification.user.name}</span>
                            {' '}
                            <span className="text-slate-700">{notification.message}</span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {notification.timestamp}
                          </p>
                        </div>
                        <div className="ml-3 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                      </div>
                    </div>

                    {/* Unread Indicator */}
                    {notification.unread && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Notifications;

