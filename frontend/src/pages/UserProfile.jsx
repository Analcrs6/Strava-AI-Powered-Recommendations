import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socialAPI, activitiesAPI } from '../services/api';
import { Users, MapPin, Calendar, Activity, UserPlus, UserMinus, Edit2, TrendingUp } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [activities, setActivities] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [activeTab, setActiveTab] = useState('activities');
  const [loading, setLoading] = useState(true);
  const [currentUser] = useState('current_user'); // TODO: Get from auth context

  useEffect(() => {
    loadProfile();
    loadActivities();
    loadFollowers();
    loadFollowing();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await socialAPI.getProfile(userId, currentUser);
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      const response = await activitiesAPI.list(0, 20);
      // Filter activities for this user
      const userActivities = response.data.filter(act => act.user_id === userId);
      setActivities(userActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

  const loadFollowers = async () => {
    try {
      const response = await socialAPI.getFollowers(userId);
      setFollowers(response.data);
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadFollowing = async () => {
    try {
      const response = await socialAPI.getFollowing(userId);
      setFollowing(response.data);
    } catch (error) {
      console.error('Error loading following:', error);
    }
  };

  const handleFollow = async () => {
    try {
      if (profile.is_following) {
        await socialAPI.unfollow(currentUser, userId);
      } else {
        await socialAPI.follow(currentUser, userId);
      }
      await loadProfile();
      await loadFollowers();
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert(error.response?.data?.detail || 'Failed to update follow status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser === userId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* Profile Image */}
              <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold">
                {profile.profile_image_url ? (
                  <img src={profile.profile_image_url} alt={profile.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Users className="h-16 w-16" />
                )}
              </div>

              {/* Profile Info */}
              <div>
                <h1 className="text-3xl font-bold mb-2">{profile.name || userId}</h1>
                <div className="flex items-center space-x-4 text-sm">
                  {profile.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date().getFullYear()}</span>
                  </div>
                </div>
                {profile.bio && (
                  <p className="mt-3 text-blue-100 max-w-2xl">{profile.bio}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              {isOwnProfile ? (
                <button
                  onClick={() => navigate(`/profile/${userId}/edit`)}
                  className="flex items-center space-x-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg hover:bg-white/30 transition"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-semibold transition ${
                    profile.is_following
                      ? 'bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30'
                      : 'bg-white text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  {profile.is_following ? (
                    <>
                      <UserMinus className="h-4 w-4" />
                      <span>Unfollow</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{profile.activities_count}</div>
              <div className="text-sm text-blue-100">Activities</div>
            </div>
            <div
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center cursor-pointer hover:bg-white/20 transition"
              onClick={() => setActiveTab('followers')}
            >
              <div className="text-2xl font-bold">{profile.followers_count}</div>
              <div className="text-sm text-blue-100">Followers</div>
            </div>
            <div
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center cursor-pointer hover:bg-white/20 transition"
              onClick={() => setActiveTab('following')}
            >
              <div className="text-2xl font-bold">{profile.following_count}</div>
              <div className="text-sm text-blue-100">Following</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex space-x-8 border-b border-gray-200 mt-8">
          <button
            onClick={() => setActiveTab('activities')}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === 'activities'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity className="h-5 w-5 inline mr-2" />
            Activities
          </button>
          <button
            onClick={() => setActiveTab('followers')}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === 'followers'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-5 w-5 inline mr-2" />
            Followers ({profile.followers_count})
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`pb-4 px-2 font-semibold transition ${
              activeTab === 'following'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <TrendingUp className="h-5 w-5 inline mr-2" />
            Following ({profile.following_count})
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-8">
          {activeTab === 'activities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activities.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No activities yet</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => navigate(`/activity/${activity.id}`)}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold capitalize ${
                        activity.sport === 'running' ? 'bg-orange-100 text-orange-700' :
                        activity.sport === 'cycling' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {activity.sport}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-gray-900">
                        {formatDistance(activity.distance_m)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDuration(activity.duration_s)}
                        {activity.elevation_gain_m > 0 && ` • ${Math.round(activity.elevation_gain_m)}m elevation`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'followers' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {followers.length === 0 ? (
                <div className="col-span-3 text-center py-12">
                  <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No followers yet</p>
                </div>
              ) : (
                followers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{user.name || user.id}</div>
                        {user.location && (
                          <div className="text-xs text-gray-500 truncate">{user.location}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'following' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {following.length === 0 ? (
                <div className="col-span-3 text-center py-12">
                  <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Not following anyone yet</p>
                </div>
              ) : (
                following.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => navigate(`/profile/${user.id}`)}
                    className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                        {user.profile_image_url ? (
                          <img src={user.profile_image_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{user.name || user.id}</div>
                        {user.location && (
                          <div className="text-xs text-gray-500 truncate">{user.location}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfile;

