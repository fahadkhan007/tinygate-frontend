import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_ROOT = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

function getErrorMessage(error, fallback) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [urls, setUrls] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const title = useMemo(
    () => (isAuthenticated ? 'TinyGate Console' : 'TinyGate Access'),
    [isAuthenticated],
  );

  const loadUrls = async () => {
    const payload = await apiRequest('/api/url/my-urls');
    setUrls(payload.data || []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadUrls();
        setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    bootstrap();
  }, []);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsBusy(true);

    try {
      const payload =
        authMode === 'register'
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };

      await apiRequest(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await loadUrls();
      setIsAuthenticated(true);
      setMessage(authMode === 'register' ? 'Account created and logged in.' : 'Login successful.');
      setPassword('');
    } catch (err) {
      setError(getErrorMessage(err, 'Authentication failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateShortUrl = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsBusy(true);

    try {
      const payload = await apiRequest('/api/url/shorten', {
        method: 'POST',
        body: JSON.stringify({ originalUrl: originalUrl.trim() }),
      });

      const newItem = payload.data;
      setUrls((prev) => {
        const filtered = prev.filter((item) => item._id !== newItem._id);
        return [newItem, ...filtered];
      });
      setOriginalUrl('');
      setMessage('Short URL generated.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to shorten URL'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = async () => {
    setError('');
    setMessage('');
    setIsBusy(true);

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setUrls([]);
      setPassword('');
      setMessage('Logged out.');
    } catch (err) {
      setError(getErrorMessage(err, 'Logout failed'));
    } finally {
      setIsBusy(false);
    }
  };

  const copyShortUrl = async (shortUrl) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setMessage('Copied short URL to clipboard.');
      setError('');
    } catch {
      setError('Clipboard access denied by browser.');
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="app-shell">
        <section className="panel">
          <h1>{title}</h1>
          <p className="muted">Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="eyebrow">URL SHORTENER</p>
            <h1>{title}</h1>
          </div>
          {isAuthenticated ? (
            <button type="button" className="button secondary" onClick={handleLogout} disabled={isBusy}>
              Logout
            </button>
          ) : null}
        </header>

        {!isAuthenticated ? (
          <form className="form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' ? (
              <label>
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Fahad"
                  required
                />
              </label>
            ) : null}

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
              />
            </label>

            <button className="button" type="submit" disabled={isBusy}>
              {isBusy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
            </button>

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
                setError('');
                setMessage('');
              }}
              disabled={isBusy}
            >
              {authMode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
            </button>
          </form>
        ) : (
          <>
            <form className="form form-inline" onSubmit={handleCreateShortUrl}>
              <label>
                Paste your long URL
                <input
                  type="url"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  required
                />
              </label>
              <button className="button" type="submit" disabled={isBusy}>
                {isBusy ? 'Shortening...' : 'Shorten'}
              </button>
            </form>

            <section className="list-wrap">
              <h2>My Recent Links</h2>
              {urls.length === 0 ? <p className="muted">No links yet.</p> : null}
              <ul className="url-list">
                {urls.map((item) => (
                  <li key={item._id}>
                    <div className="row-main">
                      <a href={item.shortUrl} target="_blank" rel="noreferrer">
                        {item.shortUrl}
                      </a>
                      <button type="button" className="mini" onClick={() => copyShortUrl(item.shortUrl)}>
                        Copy
                      </button>
                    </div>
                    <p title={item.originalUrl}>{item.originalUrl}</p>
                    <small>
                      Clicks: {item.clicks || 0} | Created: {formatDate(item.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        {error ? <p className="alert error">{error}</p> : null}
        {message ? <p className="alert success">{message}</p> : null}
      </section>
    </main>
  );
}

export default App;
