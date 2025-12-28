import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Check } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      {/* Left Side - Gradient & Content */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-12 flex-col justify-center items-start text-white overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-800 opacity-20 rounded-full blur-3xl"></div>
        <div className="absolute top-[20%] right-[10%] w-32 h-32 bg-pink-400 opacity-20 rounded-full blur-xl"></div>
        
        {/* Decorative Lines/Shapes */}
        <div className="absolute bottom-0 left-0 w-full h-1/2 overflow-hidden opacity-20 pointer-events-none">
             <div className="absolute bottom-[-50px] left-[10%] w-24 h-64 bg-orange-400 rounded-full transform rotate-45 mix-blend-overlay"></div>
             <div className="absolute bottom-[-20px] left-[25%] w-16 h-48 bg-purple-400 rounded-full transform rotate-45 mix-blend-overlay"></div>
             <div className="absolute bottom-[-80px] left-[40%] w-32 h-80 bg-pink-400 rounded-full transform rotate-45 mix-blend-overlay"></div>
             <div className="absolute bottom-[20px] left-[60%] w-20 h-56 bg-indigo-400 rounded-full transform rotate-45 mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold mb-6 leading-tight">Welcome to website</h1>
          <p className="text-lg text-purple-100 leading-relaxed">
            Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-700 tracking-wider">USER LOGIN</h2>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-500 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="w-full bg-blue-50 border-none rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                style={{ padding: '1.5rem 1.5rem 1.5rem 3rem' }}
                placeholder="Username / Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="password"
                className="w-full bg-blue-50 border-none rounded-full text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                style={{ padding: '1.5rem 1.5rem 1.5rem 3rem' }}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm px-2">
              <label className="flex items-center space-x-2 cursor-pointer text-gray-500 hover:text-gray-700">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                   {rememberMe && <Check className="w-3 h-3 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember</span>
              </label>
              <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">Forgot password?</a>
            </div>

            <button
              type="submit"
              className="w-48 mx-auto block bg-blue-600 text-white font-bold py-3.5 px-4 rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 uppercase tracking-wide text-sm"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
