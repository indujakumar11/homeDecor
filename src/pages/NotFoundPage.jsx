import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Home } from 'lucide-react';
import styles from './NotFoundPage.module.scss';

// Catch-all for unknown public routes (see PublicSite in App.jsx). With the
// HashRouter this works on any host/base path — no server-side 404 needed.
const NotFoundPage = () => {
  return (
    <main className="subpage-layout">
      <section className={`section-padding ${styles.notFound}`}>
        <div className={`container ${styles.content}`}>
          <div className="eyebrow">ERROR 404</div>

          <h1 className={styles.heading}>
            Page <span className="gold-text">Not Found</span>
          </h1>

          <p className={styles.text}>
            The page you're looking for doesn't exist or may have moved. Head back home, or explore our recent projects.
          </p>

          <div className={styles.actions}>
            <Link to="/" className="btn btn-primary-gold">
              <Home size={16} aria-hidden="true" />
              <span>Back to Home</span>
            </Link>
            <Link to="/projects" className="btn btn-outline-gold">
              <span>View Our Projects</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default NotFoundPage;
