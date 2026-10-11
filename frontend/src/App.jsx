
import { useState, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import './App.css';
import Register from './Register';
import Login from './Login';

const API_URL = 'http://localhost:8080/api';

// Fix default map marker icons in Vite.
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER = [17.385, 78.4867];

function normalizeStatus(status) {
  const value = String(status || 'PENDING')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (value === 'REPORTED') return 'PENDING';
  if (value === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (value === 'RESOLVED') return 'RESOLVED';

  return 'PENDING';
}

function statusLabel(status) {
  const value = normalizeStatus(status);

  if (value === 'IN_PROGRESS') return 'In Progress';
  if (value === 'RESOLVED') return 'Resolved';

  return 'Pending';
}

// Recenter the map when GPS coordinates change.
function MapUpdater({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, 16);
    }
  }, [map, position]);

  return null;
}

// Allow citizens to select a location by clicking the map.
function MapClickHandler({ onPick }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

// Reusable interactive map.
function LocationMap({ latitude, longitude, onPick }) {
  const hasCoordinates =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined;

  const position = hasCoordinates
    ? [latitude, longitude]
    : null;

  return (
    <div style={{ marginTop: '12px', marginBottom: '18px' }}>
      <p>
        <strong>Select the issue location</strong>
      </p>

      <p>
        Click the map to place the marker, or use the GPS button
        to find your current location.
      </p>

      <MapContainer
        center={position || DEFAULT_CENTER}
        zoom={position ? 16 : 12}
        scrollWheelZoom={true}
        style={{
          height: '350px',
          width: '100%',
          borderRadius: '10px',
          zIndex: 1,
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater position={position} />
        <MapClickHandler onPick={onPick} />

        {position && <Marker position={position} />}
      </MapContainer>

      {position && (
        <p style={{ marginTop: '10px' }}>
          <strong>Selected coordinates:</strong>{' '}
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}

function App() {
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);

  const [issues, setIssues] = useState([]);
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [submitting, setSubmitting] = useState(false);
  const [updatingIssueId, setUpdatingIssueId] = useState(null);
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [gettingLocation, setGettingLocation] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'Pothole',
    location: '',
    description: '',
    latitude: null,
    longitude: null,
  });

  const loadIssues = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/issues`);

      if (!response.ok) {
        throw new Error('Unable to load issues');
      }

      const data = await response.json();

      setIssues(
        Array.isArray(data)
          ? [...data].reverse().map((issue) => ({
              ...issue,
              status: normalizeStatus(issue.status),
            }))
          : []
      );
    } catch (error) {
      console.error('Error loading issues:', error);
      setMessage(
        'Could not load issues. Check that Spring Boot is running.'
      );
    }
  }, []);

  const checkBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      setBackendStatus(response.ok ? 'Connected' : 'Unavailable');
    } catch {
      setBackendStatus('Disconnected');
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  function changePage(nextPage) {
    setMessage('');
    setPage(nextPage);
  }

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  }

  // Save coordinates selected on the map.
  function selectMapLocation(latitude, longitude) {
    setForm((previousForm) => ({
      ...previousForm,
      latitude,
      longitude,
    }));

    setMessage('Map location selected successfully.');
  }

  // Get the current device location using browser GPS.
  function getMyLocation() {
    if (!navigator.geolocation) {
      setMessage('GPS is not supported by this browser.');
      return;
    }

    setGettingLocation(true);
    setMessage('Requesting your location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setForm((previousForm) => ({
          ...previousForm,
          latitude,
          longitude,
        }));

        setGettingLocation(false);
        setMessage(
          `GPS location captured: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        );
      },
      (error) => {
        console.error('GPS error:', error);
        setGettingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          setMessage(
            'Location permission was denied. Allow location access in your browser and try again.'
          );
        } else if (error.code === error.TIMEOUT) {
          setMessage(
            'Getting your location took too long. Please try again.'
          );
        } else {
          setMessage(
            'Unable to get your location. Check your device location settings and try again.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }

  async function reportIssue(event) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to submit the issue.');
      }

      const savedIssue = await response.json();

      setIssues((previousIssues) => [
        {
          ...savedIssue,
          status: normalizeStatus(savedIssue.status),
        },
        ...previousIssues,
      ]);

      setForm({
        title: '',
        category: 'Pothole',
        location: '',
        description: '',
        latitude: null,
        longitude: null,
      });

      setMessage('Your civic issue has been reported successfully!');
    } catch (error) {
      console.error('Error reporting issue:', error);
      setMessage(
        'Could not submit the issue. Please check your backend and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function updateIssueStatus(issueId, status) {
    setMessage('');
    setUpdatingIssueId(issueId);

    try {
      const response = await fetch(
        `${API_URL}/issues/${issueId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update issue status.');
      }

      const updatedIssue = await response.json();

      setIssues((previousIssues) =>
        previousIssues.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                ...updatedIssue,
                status: normalizeStatus(updatedIssue.status || status),
              }
            : issue
        )
      );

      setMessage('Issue status updated successfully!');
    } catch (error) {
      console.error('Error updating issue status:', error);
      setMessage(
        'Could not update the status. Please check your backend and try again.'
      );
    } finally {
      setUpdatingIssueId(null);
    }
  }

  function handleLoginSuccess(loggedInUser, portal) {
    const role = String(loggedInUser?.role || '')
      .trim()
      .toUpperCase();

    if (portal === 'government') {
      if (role !== 'GOVERNMENT') {
        setMessage(
          'Access denied. Please use an authorized government account.'
        );
        return;
      }

      setUser({ ...loggedInUser, role: 'GOVERNMENT' });
      setPage('government');
      setMessage(
        `Welcome, ${loggedInUser.name || 'Government Officer'}!`
      );
      loadIssues();
      return;
    }

    if (role && role !== 'CITIZEN') {
      setMessage(
        'Please use a citizen account in the Citizen Portal.'
      );
      return;
    }

    setUser({ ...loggedInUser, role: 'CITIZEN' });
    setPage('citizen');
    setMessage(
      `Welcome, ${loggedInUser.name || 'Citizen'}! Login successful.`
    );
    loadIssues();
  }

  function logout() {
    setUser(null);
    setPage('home');
    setStatusFilter('ALL');
    setMessage('You have been logged out.');
  }

  const totalIssues = issues.length;

  const pendingIssues = issues.filter(
    (issue) => normalizeStatus(issue.status) === 'PENDING'
  ).length;

  const inProgressIssues = issues.filter(
    (issue) => normalizeStatus(issue.status) === 'IN_PROGRESS'
  ).length;

  const resolvedIssues = issues.filter(
    (issue) => normalizeStatus(issue.status) === 'RESOLVED'
  ).length;

  const filteredIssues = issues.filter(
    (issue) =>
      statusFilter === 'ALL' ||
      normalizeStatus(issue.status) === statusFilter
  );

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Smart Civic</h1>
          <p>Report civic problems. Build a better community.</p>
        </div>

        <div className="backend-status">
          Backend: <strong>{backendStatus}</strong>
        </div>
      </header>

      <nav className="navigation">
        <button
          type="button"
          onClick={() =>
            changePage(
              user?.role === 'GOVERNMENT'
                ? 'government'
                : user?.role === 'CITIZEN'
                  ? 'citizen'
                  : 'home'
            )
          }
        >
          {user ? 'Dashboard' : 'Home'}
        </button>

        {user && (
          <>
            <span>Signed in as {user.name || user.email}</span>

            <button type="button" onClick={logout}>
              Logout
            </button>
          </>
        )}
      </nav>

      <main className="container">
        {message && (
          <div className="message" role="status">
            {message}
            <button
              type="button"
              onClick={() => setMessage('')}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {page === 'home' ? (
          <section className="welcome">
            <h2>Welcome to Smart Civic</h2>
            <p>
              Report potholes, garbage, drainage problems, damaged
              streetlights, and other civic issues in your area.
            </p>

            <div className="portal-options">
              <button
                type="button"
                onClick={() => changePage('citizenAuth')}
              >
                Citizen Portal
              </button>

              <button
                type="button"
                onClick={() => changePage('governmentLogin')}
              >
                Government Portal
              </button>
            </div>
          </section>
        ) : page === 'citizenAuth' ? (
          <section className="panel">
            <h2>Citizen Portal</h2>
            <p>
              Register or log in to report and track civic problems.
            </p>

            <button
              type="button"
              onClick={() => changePage('login')}
            >
              Citizen Login
            </button>

            <button
              type="button"
              onClick={() => changePage('register')}
            >
              Register
            </button>

            <button
              type="button"
              onClick={() => changePage('home')}
            >
              Back to Home
            </button>
          </section>
        ) : page === 'login' ? (
          <Login
            portal="citizen"
            onLogin={(loggedInUser) =>
              handleLoginSuccess(loggedInUser, 'citizen')
            }
            onShowRegister={() => changePage('register')}
          />
        ) : page === 'register' ? (
          <Register
            onRegistered={() => {
              setMessage('Registration successful! Please log in.');
              setPage('login');
            }}
            onShowLogin={() => changePage('login')}
          />
        ) : page === 'governmentLogin' ? (
          <section className="panel">
            <h2>Government Portal</h2>
            <p>
              Authorized government officers can sign in using their
              Government ID and password.
            </p>

            <Login
              portal="government"
              onLogin={(loggedInUser) =>
                handleLoginSuccess(loggedInUser, 'government')
              }
            />

            <button
              type="button"
              onClick={() => changePage('home')}
            >
              Back to Home
            </button>
          </section>
        ) : page === 'citizen' && user?.role === 'CITIZEN' ? (
          <>
            <section className="welcome">
              <h2>Citizen Dashboard</h2>
              <p>
                Welcome, {user.name || 'Citizen'}! Report civic
                problems and track their status here.
              </p>
            </section>

            <section className="panel">
              <h2>Report a Civic Issue</h2>

              <form onSubmit={reportIssue}>
                <label htmlFor="title">Issue Title</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="Example: Road pothole near bus stop"
                  required
                />

                <label htmlFor="category">Issue Category</label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  required
                >
                  <option value="Pothole">Pothole / Road Damage</option>
                  <option value="Garbage">Garbage Collection</option>
                  <option value="Water">Water Supply</option>
                  <option value="Drainage">Drainage Problem</option>
                  <option value="Streetlight">Streetlight Problem</option>
                  <option value="Electricity">Electricity Problem</option>
                  <option value="Other">Other</option>
                </select>

                <label htmlFor="location">Location / Street Name</label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={handleFormChange}
                  placeholder="Enter the area or street"
                  required
                />

                <button
                  type="button"
                  onClick={getMyLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation
                    ? 'Getting Location...'
                    : 'Get My Location'}
                </button>

                <LocationMap
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onPick={selectMapLocation}
                />

                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Explain the civic problem..."
                  rows="4"
                  required
                />

                <button type="submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Issue'}
                </button>
              </form>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Reported Civic Issues</h2>
                <button type="button" onClick={loadIssues}>
                  Refresh
                </button>
              </div>

              {issues.length === 0 ? (
                <p>No civic issues have been reported yet.</p>
              ) : (
                <div className="issues-list">
                  {issues.map((issue) => (
                    <article className="issue" key={issue.id}>
                      <h3>{issue.title}</h3>
                      <p><strong>Category:</strong> {issue.category}</p>
                      <p><strong>Location:</strong> {issue.location}</p>
                      <p><strong>Description:</strong> {issue.description}</p>

                      {issue.latitude != null &&
                        issue.longitude != null && (
                          <p>
                            <strong>GPS:</strong>{' '}
                            {issue.latitude}, {issue.longitude}{' '}
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${issue.latitude}&mlon=${issue.longitude}#map=17/${issue.latitude}/${issue.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Map
                            </a>
                          </p>
                        )}

                      <p className="status">
                        <strong>Status:</strong> {statusLabel(issue.status)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : page === 'government' &&
          user?.role === 'GOVERNMENT' ? (
          <>
            <section className="welcome">
              <h2>Government Dashboard</h2>
              <p>
                Welcome, {user.name || 'Government Officer'}.
                Monitor complaints and update their progress.
              </p>

              <button type="button" onClick={loadIssues}>
                Refresh Dashboard
              </button>
            </section>

            <section className="dashboard-stats">
              <article className="stat-card">
                <h3>Total Issues</h3>
                <p>{totalIssues}</p>
              </article>

              <article className="stat-card">
                <h3>Pending</h3>
                <p>{pendingIssues}</p>
              </article>

              <article className="stat-card">
                <h3>In Progress</h3>
                <p>{inProgressIssues}</p>
              </article>

              <article className="stat-card">
                <h3>Resolved</h3>
                <p>{resolvedIssues}</p>
              </article>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Manage Civic Issues</h2>

                <label htmlFor="statusFilter">Filter by status</label>
                <select
                  id="statusFilter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                >
                  <option value="ALL">All Issues</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>

              {filteredIssues.length === 0 ? (
                <p>No issues match this filter.</p>
              ) : (
                <div className="issues-list">
                  {filteredIssues.map((issue) => (
                    <article className="issue" key={issue.id}>
                      <h3>{issue.title}</h3>
                      <p><strong>Issue ID:</strong> {issue.id}</p>
                      <p><strong>Category:</strong> {issue.category}</p>
                      <p><strong>Location:</strong> {issue.location}</p>
                      <p><strong>Description:</strong> {issue.description}</p>

                      {issue.latitude != null &&
                        issue.longitude != null && (
                          <p>
                            <strong>GPS:</strong>{' '}
                            {issue.latitude}, {issue.longitude}{' '}
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${issue.latitude}&mlon=${issue.longitude}#map=17/${issue.latitude}/${issue.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Map
                            </a>
                          </p>
                        )}

                      <p className="status">
                        <strong>Current Status:</strong>{' '}
                        {statusLabel(issue.status)}
                      </p>

                      <label htmlFor={`status-${issue.id}`}>
                        Update Status
                      </label>

                      <select
                        id={`status-${issue.id}`}
                        value={normalizeStatus(issue.status)}
                        disabled={updatingIssueId === issue.id}
                        onChange={(event) =>
                          updateIssueStatus(issue.id, event.target.value)
                        }
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>

                      {updatingIssueId === issue.id && (
                        <p>Updating status...</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="panel">
            <h2>Access denied</h2>
            <p>
              Please sign in through the correct portal to access
              your dashboard.
            </p>
            <button type="button" onClick={logout}>
              Return to Home
            </button>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>Smart Civic Issue Reporting System</p>
      </footer>
    </div>
  );
}

export default App;
