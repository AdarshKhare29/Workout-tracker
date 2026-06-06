import { Dumbbell, LogIn, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { loginUser, signUpUser } from '../api';

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const auth = isSignup ? await signUpUser(form) : await loginUser(form);
      onAuthenticated(auth);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <span>
            <Dumbbell size={26} />
          </span>
          <div>
            <p className="eyebrow">Weekly Lift Tracker</p>
            <h1>{isSignup ? 'Create your profile' : 'Welcome back'}</h1>
          </div>
        </div>

        <div className="auth-tabs" aria-label="Authentication mode">
          <button className={!isSignup ? 'active' : ''} onClick={() => setMode('login')} type="button">
            <LogIn size={16} />
            Login
          </button>
          <button className={isSignup ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            <UserPlus size={16} />
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup ? (
            <label htmlFor="name">
              Name
              <input
                autoComplete="name"
                id="name"
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Your name"
                required
                value={form.name}
              />
            </label>
          ) : null}

          <label htmlFor="email">
            Email
            <input
              autoComplete="email"
              id="email"
              onChange={(event) => updateForm('email', event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label htmlFor="password">
            Password
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              id="password"
              minLength={6}
              onChange={(event) => updateForm('password', event.target.value)}
              placeholder="At least 6 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="text-button primary" disabled={isSubmitting} type="submit">
            {isSignup ? <UserPlus size={17} /> : <LogIn size={17} />}
            {isSubmitting ? 'Please wait' : isSignup ? 'Create account' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
}
