import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, CheckCircle2, Phone, Mail, Clock, AlertCircle } from 'lucide-react';
import { getLenis } from '../../lib/smoothScroll';
import { lockScroll, unlockScroll } from '../../lib/scrollLock';
import { openWhatsApp } from '../../config/contact';
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

// <input type="date"> gives "YYYY-MM-DD"; built from parts (not new Date(str))
// so it isn't shifted a day by UTC parsing.
const formatDate = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

// The WhatsApp message for a consultation request. Optional fields are only
// included when the visitor filled them in.
const buildConsultationMessage = (data) => {
  const lines = [
    'Hello Black Shades Home Decors, I would like to book a design consultation.',
    '',
    `Name: ${data.name.trim()}`,
    `Phone: ${data.phone.trim()}`,
    `Email: ${data.email.trim()}`,
    `Service: ${data.service}`,
  ];
  if (data.preferredDate) lines.push(`Preferred Date: ${formatDate(data.preferredDate)}`);
  if (data.location.trim()) lines.push(`Location: ${data.location.trim()}`);
  if (data.notes.trim()) lines.push(`Notes: ${data.notes.trim()}`);
  return lines.join('\n');
};

const emptyForm = (service) => ({
  name: '',
  phone: '',
  email: '',
  service: service || 'Custom Murals & Relief Walls',
  preferredDate: '',
  location: '',
  notes: ''
});

const ConsultationModal = ({ isOpen, onClose, defaultService = '' }) => {
  const [formData, setFormData] = useState(() => emptyForm(defaultService));

  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  // The form is cleared on submit, so the success message keeps its own copy.
  const [submittedName, setSubmittedName] = useState('');
  // Only release the shared scroll lock if this modal is the one holding
  // it — otherwise its mount-time run (closed by default) would clobber a
  // lock some other holder (e.g. the Preloader) still needs.
  const holdsLockRef = useRef(false);

  useEffect(() => {
    if (defaultService) {
      setFormData((prev) => ({ ...prev, service: defaultService }));
    }
  }, [defaultService]);

  useEffect(() => {
    const lenis = getLenis();
    if (isOpen) {
      lockScroll();
      holdsLockRef.current = true;
      lenis?.stop();
    } else {
      if (holdsLockRef.current) {
        unlockScroll();
        holdsLockRef.current = false;
      }
      lenis?.start();
      setIsSuccess(false);
      setErrors({});
    }
    return () => {
      if (holdsLockRef.current) {
        unlockScroll();
        holdsLockRef.current = false;
      }
      lenis?.start();
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

    if (!openWhatsApp(buildConsultationMessage(formData))) {
      setErrors({ submit: 'Booking via WhatsApp is unavailable right now. Please call us directly.' });
      return;
    }

    // This modal stays mounted between opens, so clear the form now —
    // otherwise the next booking would start pre-filled with these details.
    setSubmittedName(formData.name.trim());
    setFormData(emptyForm(defaultService));
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 4000);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modalContent} data-lenis-prevent onClick={(e) => e.stopPropagation()}>
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
            <h3 className={styles.successHeading}>Almost Done!</h3>
            <p className={styles.successText}>
              Thank you, <strong>{submittedName}</strong>. We've opened WhatsApp with your consultation details — tap <strong>Send</strong> there to complete your request.
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

            {errors.submit && (
              <span className={styles.errorMsg}>
                <AlertCircle size={12} /> {errors.submit}
              </span>
            )}

            <div className={styles.formFooter}>
              <button
                type="submit"
                className={`btn btn-primary-gold ${styles.submitButton}`}
              >
                <Calendar size={16} />
                <span>CONFIRM CONSULTATION</span>
              </button>

              <a href="tel:+919790838319" className={styles.footerNote} aria-label="Or call direct: +91 97908 38319">
                <Phone size={13} className={styles.noteIcon} />
                <span>Or call direct</span>
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ConsultationModal;
