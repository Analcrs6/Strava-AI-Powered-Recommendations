import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import { ArrowLeft, User, Camera, Save, Trash2, AlertTriangle, Upload } from 'lucide-react';

function Settings() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [profileImage, setProfileImage] = useState(user?.profile_image_url || null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.bio || '',
    location: user?.location || ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage({
          type: 'error',
          text: 'Image size must be less than 5MB'
        });
        return;
      }
      
      setImageFile(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // TODO: Implement real API call with image upload
      // For now, simulate the update
      setTimeout(() => {
        const updatedUser = {
          ...user,
          ...formData,
          profile_image_url: profileImage || user?.profile_image_url
        };
        updateUser(updatedUser);
        setLoading(false);
        setMessage({
          type: 'success',
          text: 'Profile updated successfully!'
        });
      }, 1000);
    } catch (error) {
      setLoading(false);
      setMessage({
        type: 'error',
        text: 'Failed to update profile'
      });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    
    try {
      // Call API to delete user
      await usersAPI.delete(user.id);
      
      console.log(`🗑️  Account deleted for user: ${user.id}`);
      logout();
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleteLoading(false);
      alert('Failed to delete account. Please try again.');
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

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-slate-700" />
              <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="text-white text-2xl font-semibold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition text-sm"
                >
                  <Upload className="h-4 w-4" />
                  <span>Upload Photo</span>
                </button>
                {profileImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileImage(null);
                      setImageFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">PNG, JPG or JPEG. Max 5MB.</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="you@example.com"
                disabled
              />
              <p className="mt-1 text-xs text-slate-500">Email cannot be changed</p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                placeholder="San Francisco, CA"
              />
            </div>

            {/* Message */}
            {message && (
              <div
                className={`p-4 rounded-md ${
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-slate-800 text-white px-6 py-2 rounded-md hover:bg-slate-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Danger Zone - Delete Account */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 mt-6">
          <div className="p-6 border-b border-red-200 bg-red-50">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold text-red-900">Danger Zone</h2>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Account</h3>
            <p className="text-sm text-slate-600 mb-4">
              Once you delete your account, there is no going back. This action is permanent and will delete:
            </p>
            <ul className="text-sm text-slate-600 mb-6 space-y-1 list-disc list-inside">
              <li>All your activities and routes</li>
              <li>Your profile and account information</li>
              <li>All your followers and following connections</li>
              <li>Your messages and notifications</li>
            </ul>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-2 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete My Account</span>
              </button>
            ) : (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-900 mb-4">
                  ⚠️ Are you absolutely sure? This action cannot be undone.
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                    className="flex items-center space-x-2 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{deleteLoading ? 'Deleting...' : 'Yes, Delete Forever'}</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteLoading}
                    className="px-6 py-2 border-2 border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;

