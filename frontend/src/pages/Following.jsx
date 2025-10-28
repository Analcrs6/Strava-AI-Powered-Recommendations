import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Users, Activity, TrendingUp, MapPin } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

function Following() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    loadFollowingAndActivities();
  }, []);

  const loadFollowingAndActivities = async () => {
    try {
      // Simulate API call to get following list and their activities
      setTimeout(() => {
        const mockFollowing = [
          { id: 'user1', name: 'Sarah Johnson', avatar_color: 'bg-blue-600' },
          { id: 'user2', name: 'Mike Chen', avatar_color: 'bg-purple-600' },
          { id: 'user3', name: 'Emma Davis', avatar_color: 'bg-green-600' }
        ];
        
        const mockActivities = [
          {
            id: '1',
            user: mockFollowing[0],
            sport: 'running',
            distance_m: 8500,
            duration_s: 2400,
            elevation_gain_m: 120,
            created_at: '2 hours ago',
            location: 'Golden Gate Park'
          },
          {
            id: '2',
            user: mockFollowing[1],
            sport: 'cycling',
            distance_m: 32000,
            duration_s: 5400,
            elevation_gain_m: 450,
            created_at: '5 hours ago',
            location: 'Mountain Loop'
          },
          {
            id: '3',
            user: mockFollowing[2],
            sport: 'hiking',
            distance_m: 12000,
            duration_s: 7200,
            elevation_gain_m: 850,
            created_at: '1 day ago',
            location: 'Mt. Tam Trail'
          }
        ];

        setFollowing(mockFollowing);
        setActivities(mockActivities);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error loading following:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 mb-6 transition"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-2">
            <Users className="h-7 w-7 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Activity Feed</h1>
          </div>
          <p className="text-slate-600">
            See what the people you follow are up to
          </p>
        </div>

        {/* Following List */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Following ({following.length})
          </h2>
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {following.map((person) => (
              <button
                key={person.id}
                onClick={() => navigate(`/profile/${person.id}`)}
                className="flex flex-col items-center space-y-1 min-w-[80px] p-2 rounded-lg hover:bg-slate-50 transition"
              >
                <div className={`h-12 w-12 rounded-full ${person.avatar_color} flex items-center justify-center`}>
                  <span className="text-white font-semibold">
                    {person.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <span className="text-xs text-slate-700 text-center truncate w-full">
                  {person.name.split(' ')[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Activities Feed */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Activity className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No activities yet</h3>
            <p className="text-slate-600 text-sm">
              Activities from people you follow will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer"
                onClick={() => navigate(`/activity/${activity.id}`)}
              >
                {/* User Header */}
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-full ${activity.user.avatar_color} flex items-center justify-center`}>
                      <span className="text-white font-semibold text-sm">
                        {activity.user.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{activity.user.name}</div>
                      <div className="text-xs text-slate-500">{activity.created_at}</div>
                    </div>
                  </div>
                </div>

                {/* Activity Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold uppercase ${
                        activity.sport === 'running' ? 'bg-orange-100 text-orange-800' :
                        activity.sport === 'cycling' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {activity.sport}
                      </span>
                      {activity.location && (
                        <div className="flex items-center space-x-1 mt-2 text-sm text-slate-600">
                          <MapPin className="h-4 w-4" />
                          <span>{activity.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Distance</div>
                      <div className="font-semibold text-slate-900">
                        {formatDistance(activity.distance_m)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Duration</div>
                      <div className="font-semibold text-slate-900">
                        {formatDuration(activity.duration_s)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Elevation</div>
                      <div className="font-semibold text-slate-900">
                        {Math.round(activity.elevation_gain_m)}m
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-4 pt-4 border-t border-slate-200">
                    <button className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 transition text-sm">
                      <TrendingUp className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Following;

