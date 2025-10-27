import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { formatDistance, formatDuration, formatElevation, formatPace, getSportIcon, getSportColor } from '../utils/format';
import { Clock, TrendingUp, Mountain, Heart } from 'lucide-react';
import RecommendationsPanel from '../components/RecommendationsPanel';

function Dashboard() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const response = await activitiesAPI.list(0, 50);
      setActivities(response.data);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-strava-orange"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-strava-orange to-orange-600 rounded-2xl p-8 mb-8 text-white">
        <h1 className="text-4xl font-bold mb-2">Welcome back, Athlete! 👋</h1>
        <p className="text-lg opacity-90">
          Track your activities and discover similar workouts with our recommender system
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">{activities.length}</div>
            <div className="text-sm opacity-90">Total Activities</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">
              {formatDistance(activities.reduce((acc, a) => acc + (a.distance_m || 0), 0))}
            </div>
            <div className="text-sm opacity-90">Total Distance</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-3xl font-bold">
              {formatDuration(activities.reduce((acc, a) => acc + (a.duration_s || 0), 0))}
            </div>
            <div className="text-sm opacity-90">Total Time</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activities List */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Activities</h2>
            <Link to="/create" className="text-strava-orange hover:text-strava-orange-dark font-medium">
              + Add New
            </Link>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <TrendingUp className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No activities yet</h3>
              <p className="text-gray-600 mb-6">Start tracking your workouts to see recommendations</p>
              <Link 
                to="/create"
                className="inline-block bg-strava-orange text-white px-6 py-3 rounded-lg hover:bg-strava-orange-dark transition"
              >
                Create Your First Activity
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <ActivityCard 
                  key={activity.id} 
                  activity={activity}
                  onClick={() => setSelectedActivity(activity)}
                  isSelected={selectedActivity?.id === activity.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recommendations Panel */}
        <div className="lg:col-span-1">
          <RecommendationsPanel selectedActivity={selectedActivity} />
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity, onClick, isSelected }) {
  const sportColor = getSportColor(activity.sport);
  const sportIcon = getSportIcon(activity.sport);

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer border-2 ${
        isSelected ? 'border-strava-orange' : 'border-transparent'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`${sportColor} w-12 h-12 rounded-full flex items-center justify-center text-2xl`}>
            {sportIcon}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900 capitalize">{activity.sport} Activity</h3>
            <p className="text-sm text-gray-500">ID: {activity.id}</p>
          </div>
        </div>
        {isSelected && (
          <span className="bg-strava-orange text-white text-xs px-2 py-1 rounded-full">
            Selected
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center space-x-2 text-gray-600">
          <TrendingUp className="h-4 w-4 text-strava-orange" />
          <div>
            <div className="text-sm font-medium text-gray-900">{formatDistance(activity.distance_m)}</div>
            <div className="text-xs text-gray-500">Distance</div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-gray-600">
          <Clock className="h-4 w-4 text-blue-500" />
          <div>
            <div className="text-sm font-medium text-gray-900">{formatDuration(activity.duration_s)}</div>
            <div className="text-xs text-gray-500">Duration</div>
          </div>
        </div>

        {activity.elevation_gain_m > 0 && (
          <div className="flex items-center space-x-2 text-gray-600">
            <Mountain className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-sm font-medium text-gray-900">{formatElevation(activity.elevation_gain_m)}</div>
              <div className="text-xs text-gray-500">Elevation</div>
            </div>
          </div>
        )}

        {activity.hr_avg > 0 && (
          <div className="flex items-center space-x-2 text-gray-600">
            <Heart className="h-4 w-4 text-red-500" />
            <div>
              <div className="text-sm font-medium text-gray-900">{Math.round(activity.hr_avg)} bpm</div>
              <div className="text-xs text-gray-500">Avg HR</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-600">
          Pace: <span className="font-medium text-gray-900">{formatPace(activity.distance_m, activity.duration_s)}</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

