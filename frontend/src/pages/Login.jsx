import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, Mail } from 'lucide-react';

// Social provider icons (using Lucide icons as placeholders)
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    
    try {
      // Create user in database first
      const userId = `user_${Date.now()}`;
      const userName = `${provider.charAt(0).toUpperCase()}${provider.slice(1)} User`;
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }

      const userData = await response.json();
      
      const newUser = {
        id: userData.id,
        name: userData.name,
        email: `user@${provider}.com`,
        profile_image_url: null,
        provider: provider
      };
      
      // For social login demo, we'll create a simple token (in production, this should be handled by OAuth)
      const demoToken = `demo_token_${userId}`;
      login(newUser, demoToken, null);
      console.log('✅ User logged in via', provider, ':', userId);
      navigate('/');
    } catch (err) {
      console.error('Social login error:', err);
      alert(err.message || `Failed to log in with ${provider}`);
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Authenticate with backend
      const response = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Invalid email or password');
      }

      const responseData = await response.json();
      
      // Backend returns { access_token, refresh_token, user }
      const user = {
        id: responseData.user.id,
        name: responseData.user.name,
        email: responseData.user.email,
        bio: responseData.user.bio,
        location: responseData.user.location,
        profile_image_url: responseData.user.profile_image_url,
        provider: 'email'
      };
      
      login(user, responseData.access_token, responseData.refresh_token);
      console.log('✅ User logged in:', user.id, '(' + user.name + ')');
      navigate('/');
    } catch (err) {
      console.error('Email login error:', err);
      alert(err.message || 'Failed to log in');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 rounded-xl mb-4">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to Strava Recommender</h1>
          <p className="text-slate-600">Sign in to discover personalized route recommendations</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {!showEmailLogin ? (
            <>
              {/* Social Login Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleIcon />
                  <span className="font-medium text-slate-700">Continue with Google</span>
                </button>

                <button
                  onClick={() => handleSocialLogin('twitter')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TwitterIcon />
                  <span className="font-medium text-slate-700">Continue with Twitter</span>
                </button>

                <button
                  onClick={() => handleSocialLogin('facebook')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FacebookIcon />
                  <span className="font-medium text-slate-700">Continue with Facebook</span>
                </button>

                <button
                  onClick={() => handleSocialLogin('github')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GitHubIcon />
                  <span className="font-medium text-slate-700">Continue with GitHub</span>
                </button>
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-slate-500">Or</span>
                </div>
              </div>

              <button
                onClick={() => setShowEmailLogin(true)}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Mail className="h-5 w-5" />
                <span>Continue with Email</span>
              </button>
            </>
          ) : (
            <>
              {/* Email Login Form */}
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <div className="flex items-center justify-between mb-4">
                  <Link to="/forgot-password" className="text-xs text-slate-600 hover:text-slate-900 transition">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white px-4 py-3 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>

                <div className="flex items-center justify-between mt-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setShowEmailLogin(false)}
                    className="text-slate-600 hover:text-slate-900 transition"
                  >
                    ← Back to social login
                  </button>
                  <Link to="/signup" className="text-orange-600 hover:text-orange-700 font-medium transition">
                    Sign up
                  </Link>
                </div>
              </form>
            </>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500 mb-2">
            By continuing, you agree to Strava Recommender's Terms of Service and Privacy Policy
          </p>
          <Link to="/signup" className="text-sm text-orange-600 hover:text-orange-700 font-medium transition">
            Don't have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;

