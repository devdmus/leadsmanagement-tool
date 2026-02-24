import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithUsername } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: string })?.from || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signInWithUsername(username, password);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Login Successful',
        description: 'Welcome back!',
      });
      navigate(from, { replace: true });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 overflow-hidden perspective-1000">
      <motion.div
        initial={{ opacity: 0, rotateY: -10, scale: 0.95 }}
        animate={{ opacity: 1, rotateY: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px]"
        style={{ perspective: 1000 }}
      >
        {/* Left Side - Branding & Decorative */}
        <div className="w-full md:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1F86E0] to-[#0A4F8B] p-12 text-white flex flex-col justify-center items-center text-center">
          {/* Abstract Shapes for 3D Feel */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"
          />

          <div className="relative z-10 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Welcome Back!</h1>
              <p className="text-lg text-blue-100 max-w-sm mx-auto">
                Streamline your workflow with our advanced Marketing Tracking Dashboard.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="inline-block px-8 py-3 border-2 border-white/30 rounded-full text-sm font-semibold tracking-wide uppercase backdrop-blur-sm"
            >
              Admin Access
            </motion.div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white relative">
          <div className="max-w-md mx-auto w-full space-y-8">
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-3xl font-bold text-[#2C313A]">Sign In</h2>
              <p className="text-muted-foreground">use your admin credentials to access</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <Label htmlFor="login-username" className="text-[#2C313A] font-medium">Username</Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 bg-gray-50 border-gray-200 focus-visible:ring-[#1F86E0] focus-visible:border-[#1F86E0] rounded-xl transition-all duration-300 hover:bg-white hover:shadow-sm"
                />
              </motion.div>

              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-[#2C313A] font-medium">Application Password</Label>
                  <a
                    href="https://wordpress.org/documentation/article/application-passwords/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#1F86E0] font-medium hover:underline"
                  >
                    What is this?
                  </a>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your WP Application Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-gray-50 border-gray-200 focus-visible:ring-[#1F86E0] focus-visible:border-[#1F86E0] rounded-xl transition-all duration-300 hover:bg-white hover:shadow-sm"
                />
                <p className="text-[11px] text-muted-foreground pt-1">
                  Use your WP Application Password for secure access.
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-bold bg-[#1F86E0] hover:bg-[#166db8] text-white rounded-xl shadow-lg hover:shadow-[#1F86E0]/30 transition-all duration-300 transform hover:-translate-y-0.5"
                  disabled={isLoading}
                >
                  {isLoading ? 'Authenticating...' : 'SIGN IN'}
                </Button>
              </motion.div>
            </form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center pt-4"
            >
              <p className="text-xs text-muted-foreground">
                First user to register becomes admin automatically.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
