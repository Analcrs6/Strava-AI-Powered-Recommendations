import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { TrendingUp, CheckCircle, XCircle, Loader } from 'lucide-react';

function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('Verifying your email...');
  
  const token = searchParams.get('token');

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    try {
      const response = await fetch(`/api/users/verify-email?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Email verified successfully! You can now log in.');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to verify email. Link may be expired or invalid.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Failed to verify email. Please try again or contact support.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-600 rounded-xl mb-4">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Email Verification</h1>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <div className="text-center">
            {status === 'verifying' && (
              <>
                <Loader className="h-16 w-16 text-orange-600 mx-auto mb-4 animate-spin" />
                <p className="text-lg text-slate-700">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Success!</h2>
                <p className="text-slate-700 mb-4">{message}</p>
                <p className="text-sm text-slate-500">Redirecting to login...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Verification Failed</h2>
                <p className="text-slate-700 mb-6">{message}</p>
                <div className="space-y-3">
                  <Link
                    to="/signup"
                    className="block w-full bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition font-medium"
                  >
                    Create New Account
                  </Link>
                  <Link
                    to="/login"
                    className="block w-full border-2 border-slate-300 text-slate-700 px-4 py-3 rounded-lg hover:bg-slate-50 transition font-medium"
                  >
                    Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-600">
            Need help?{' '}
            <a href="mailto:support@strava.com" className="text-orange-600 hover:text-orange-700 font-medium">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;

