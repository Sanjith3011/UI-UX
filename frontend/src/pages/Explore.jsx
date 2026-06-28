import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, User } from 'lucide-react';
import { searchProfiles } from '../api';
import './Explore.css';

const Explore = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchProfiles(query.trim());
      setResults(data);
    } catch (err) {
      console.error('Search failed', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="explore-page animate-fade-in">
      <div className="explore-hero glass-panel">
        <h1 className="gradient-text">Explore Portfolios</h1>
        <p>Search for designers and view their public projects and UI/UX scores.</p>
        <form onSubmit={handleSearch} className="explore-search-form">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="glass-input"
            placeholder="Search by username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="glass-button" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {searched && (
        <div className="explore-results">
          {results.length === 0 ? (
            <p className="explore-empty">No public profiles found for &ldquo;{query}&rdquo;.</p>
          ) : (
            results.map((profile) => (
              <Link key={profile.username} to={`/portfolio/${profile.username}`} className="profile-card glass-panel">
                <User size={32} className="profile-card-icon" />
                <div>
                  <h3>@{profile.username}</h3>
                  <p>{profile.bio || 'No bio yet.'}</p>
                  <span className="profile-meta">{profile.public_project_count} public project(s)</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Explore;
