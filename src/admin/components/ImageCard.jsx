import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import styles from './ImageCard.module.scss';

const ImageCard = ({ image, onEdit, onDelete }) => {
  const categoryName = image.categoryName;

  return (
    <div className={styles.card}>
      <div className={styles.thumbWrap}>
        <img src={image.imageUrl} alt={image.title} className={styles.thumb} loading="lazy" decoding="async" />
        <span className={styles.categoryBadge}>{categoryName}</span>
      </div>
      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{image.title}</h3>
        <div className={styles.cardActions}>
          <button type="button" className={styles.editBtn} onClick={() => onEdit(image)}>
            <Pencil size={14} />
            <span>Edit</span>
          </button>
          <button type="button" className={styles.deleteBtn} onClick={() => onDelete(image)}>
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
