import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { activitiesAPI } from '../services/api';
import { ArrowLeft } from 'lucide-react';
import RecommendationEngine from '../components/RecommendationEngine';

function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, [id]);

  const loadActivity = async () => {
    try {
      const response = await activitiesAPI.get(id);
      setActivity(response.data);
    } catch (error) {
      console.error('Error loading activity:', error);
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

  if (!activity) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="text-strava-orange hover:text-strava-orange-dark"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Activity Details */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 capitalize">
              {activity.sport} Activity
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">Distance</div>
                <div className="text-2xl font-bold text-gray-900">
                  {(activity.distance_m / 1000).toFixed(2)} km
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Duration</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.floor(activity.duration_s / 60)} min
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Elevation</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(activity.elevation_gain_m || 0)} m
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Avg Heart Rate</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(activity.hr_avg || 0)} bpm
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Activity Details</h3>
              <dl className="space-y-2">
                <div className="flex">
                  <dt className="w-32 text-gray-600">Activity ID:</dt>
                  <dd className="text-gray-900 font-medium">{activity.id}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-600">User ID:</dt>
                  <dd className="text-gray-900">{activity.user_id}</dd>
                </div>
                <div className="flex">
                  <dt className="w-32 text-gray-600">Sport:</dt>
                  <dd className="text-gray-900 capitalize">{activity.sport}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* Recommendations Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <RecommendationEngine 
              selectedActivity={activity}
              userId={activity.user_id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityDetail;

