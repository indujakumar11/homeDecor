import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Images, ImagePlus, LogOut, X } from 'lucide-react';
import { logout } from '../../services/authService';
import styles from './Sidebar.module.scss';

const NAV_ITEMS = [
  { to: '/admin/gallery', label: 'Gallery', icon: Images },
  { to: '/admin/gallery/add', label: 'Add Decor', icon: ImagePlus },
];

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <>
      <div className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`} onClick={onClose} />
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.brandRow}>
          <div className={styles.brandMark}>
            <span className={styles.brandTitle}>BLACK SHADES</span>
            <span className={styles.brandSub}>ADMIN PORTAL</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <span className={styles.sectionLabel}>Admin Portal</span>

        <nav className={styles.nav} aria-label="Admin navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </aside>
    </>
  );
};

export default Sidebar;
