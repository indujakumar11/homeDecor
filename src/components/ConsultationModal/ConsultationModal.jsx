import React, { useState, useEffect } from 'react';
import { X, Calendar, CheckCircle2, Phone, Mail, Clock, AlertCircle } from 'lucide-react';
import styles from './ConsultationModal.module.scss';

const SERVICES_LIST = [
  'Custom Murals & Relief Walls',
  'FRP & Fiberglass Sculptures',
  'Marble Stone Powder Sculptures',
  '3D Parametric & Bespoke Designs',
  'Interior Décor & Execution',
  'Signage & Pylon Boards',
  'Commercial & Corporate Interiors',
  'Warehouse & Supermarket Solutions',
  'Concept to Completion Turnkey Projects'
];

const ConsultationModal = ({ isOpen, onClose, defaultService = '' }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service: defaultService || 'Custom Murals & Relief Walls',
    preferredDate: '',
    location: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (defaultService) {
      setFormData((prev) => ({ ...prev, service: defaultService }));
    }
  }, [defaultService]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsSuccess(false);
      setErrors({});
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (!/^[0-9+-\s]{8,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Enter a valid phone number';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Enter a valid email';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 4000);
    }, 600);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close consultation modal">
          <X size={22} />
        </button>

        <div className={styles.modalHeader}>
          <div className="eyebrow no-decor">SCHEDULE AN APPOINTMENT</div>
          <h2 className={styles.modalTitle}>
            Book a Design <span className="gold-text">Consultation</span>
          </h2>
          <p className={styles.modalSubtitle}>
            Meet our master sculptors and interior architects for an on-site or studio spatial review.
          </p>
        </div>

        {isSuccess ? (
          <div className={styles.successWrapper}>
            <CheckCircle2 size={54} className={styles.successIcon} />
            <h3 className={styles.successHeading}>Consultation Requested!</h3>
            <p className={styles.successText}>
              Thank you, <strong>{formData.name}</strong>. Our senior consultant will call you at <strong>{formData.phone}</strong> within 24 business hours to confirm your consultation schedule.
            </p>
            <button type="button" className="btn btn-primary-gold" onClick={onClose}>
              <span>Done</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className={styles.consultForm}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-name">Full Name *</label>
                <input
                  type="text"
                  id="c-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Senthil Nathan"
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                />
                {errors.name && (
                  <span className={styles.errorMsg}>
                    <AlertCircle size={12} /> {errors.name}
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-phone">Phone Number *</label>
                <input
                  type="tel"
                  id="c-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 97908 38319"
                  className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                />
                {errors.phone && (
                  <span className={styles.errorMsg}>
                    <AlertCircle size={12} /> {errors.phone}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-email">Email Address *</label>
                <input
                  type="email"
                  id="c-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@gmail.com"
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                />
                {errors.email && (
                  <span className={styles.errorMsg}>
                    <AlertCircle size={12} /> {errors.email}
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-service">Service of Interest</label>
                <select
                  id="c-service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className={styles.select}
                >
                  {SERVICES_LIST.map((svc) => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-date">Preferred Date</label>
                <input
                  type="date"
                  id="c-date"
                  name="preferredDate"
                  value={formData.preferredDate}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-loc">Site Location / Area</label>
                <input
                  type="text"
                  id="c-loc"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="e.g. OMR, ECR, Anna Nagar"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="c-notes">Additional Notes / Space Details</label>
              <textarea
                id="c-notes"
                name="notes"
                rows="3"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Mention wall dimensions, sculpture size preferences, or specific timeline..."
                className={styles.textarea}
              />
            </div>

            <div className={styles.formFooter}>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`btn btn-primary-gold ${styles.submitButton}`}
              >
                <Calendar size={16} />
                <span>{isSubmitting ? 'CONFIRMING...' : 'CONFIRM CONSULTATION'}</span>
              </button>

              <div className={styles.footerNote}>
                <Phone size={13} className={styles.noteIcon} />
                <span>Or call direct: <strong>+91 97908 38319</strong></span>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConsultationModal;
