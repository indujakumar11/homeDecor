import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import styles from './AdminLayout.module.scss';

const AdminLayout = ({ children, fullBleed = false }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile-only trigger for the sidebar drawer — there is no top header bar to hold it. */}
      <button
        type="button"
        className={styles.mobileMenuBtn}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className={styles.main}>
        <div className={`${styles.content} ${fullBleed ? styles.contentFullBleed : ''}`}>{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;
