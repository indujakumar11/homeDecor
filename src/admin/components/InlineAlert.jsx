import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import styles from './InlineAlert.module.scss';

// type: 'success' | 'error'
const InlineAlert = ({ type = 'error', message, className = '' }) => {
  if (!message) return null;

  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className={`${styles.alert} ${styles[type]} ${className}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={16} className={styles.icon} />
      <span>{message}</span>
    </div>
  );
};

export default InlineAlert;
