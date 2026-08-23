import React from 'react';
import AdminLayout from '../layouts/AdminLayout';
import ImageForm from './ImageForm';
import InlineAlert from './InlineAlert';
import styles from './ImageFormScreen.module.scss';

// Fullscreen, dark-themed shell shared by the Add Decor and Edit Image
// screens — same layout, same "add" vs "edit" ImageForm underneath.
const ImageFormScreen = ({ heading, subtitle, mode, initialData, onSubmit, onCancel, successMessage }) => {
  return (
    <AdminLayout fullBleed>
      <div className={styles.fullscreenWrap}>
        <div className={styles.formPanel}>
          <div className={styles.panelHeading}>
            <h2 className={styles.panelTitle}>{heading}</h2>
            <p className={styles.panelSubtitle}>{subtitle}</p>
          </div>
          <InlineAlert type="success" message={successMessage} className={styles.toast} />
          <ImageForm mode={mode} initialData={initialData} onSubmit={onSubmit} onCancel={onCancel} />
        </div>
      </div>
    </AdminLayout>
  );
};

export default ImageFormScreen;
