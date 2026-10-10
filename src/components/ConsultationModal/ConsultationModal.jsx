import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Calendar, CheckCircle2, Phone, Mail, Clock, AlertCircle } from 'lucide-react';
import { getLenis } from '../../lib/smoothScroll';
import { lockScroll, unlockScroll } from '../../lib/scrollLock';
import { openWhatsApp } from '../../config/contact';
import { servicesData } from '../../data/servicesData';
import styles from './ConsultationModal.module.scss';

// Derived from servicesData (not a separate copy) so every service shown on
// the Services page — including Government Projects — is selectable here.
const SERVICES_LIST = servicesData.map((s) => s.title);
const isValidService = (value) => SERVICES_LIST.includes(value);

// <input type="date"> gives "YYYY-MM-DD"; built from parts (not new Date(str))
// so it isn't shifted a day by UTC parsing.
const formatDate = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

// The WhatsApp message for a consultation request. Optional fields are only
// included when the visitor filled them in. `project` is the project the
// enquiry was started from, if any — kept on its own line, never used as the
// service.
const buildConsultationMessage = (data, project) => {
  const lines = [
    'Hello Black Shades Home Decors, I would like to book a design consultation.',
    '',
    `Name: ${data.name.trim()}`,
    `Phone: ${data.phone.trim()}`,
    `Email: ${data.email.trim()}`,
    `Service: ${data.service}`,
  ];
  if (project) lines.push(`Project: ${project}`);
  if (data.preferredDate) lines.push(`Preferred Date: ${formatDate(data.preferredDate)}`);
  if (data.location.trim()) lines.push(`Location: ${data.location.trim()}`);
  if (data.notes.trim()) lines.push(`Notes: ${data.notes.trim()}`);
  return lines.join('\n');
};

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

// Keyboard-reachable controls inside `root`, in DOM order (skips disabled,
// tabindex="-1", inert and hidden elements).
const getFocusable = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0
  );

// Makes everything outside `el` inert by marking the siblings of `el` and of
// each of its ancestors up to <body> — never an ancestor of the dialog itself.
// Returns a function that restores exactly the elements it changed (anything
// already inert is left alone).
const inertOutside = (el) => {
  const changed = [];
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    for (const sibling of node.parentElement?.children ?? []) {
      if (sibling !== node && !sibling.inert) {
        sibling.inert = true;
        changed.push(sibling);
      }
    }
  }
  return () => changed.forEach((sibling) => { sibling.inert = false; });
};

// Whether focus can sensibly go back to `el` (it may have been removed, or be
// inside a now-closed off-screen drawer).
const canRestoreFocus = (el) => {
  if (!el || !el.isConnected || el === document.body || el.disabled || el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
};

const emptyForm = (service) => ({
  name: '',
  phone: '',
  email: '',
  service: isValidService(service) ? service : SERVICES_LIST[0],
  preferredDate: '',
  location: '',
  notes: ''
});

const ConsultationModal = ({ isOpen, onClose, defaultService = '', project = '' }) => {
  const [formData, setFormData] = useState(() => emptyForm(defaultService));

  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);
  // The form is cleared on submit, so the success message keeps its own copy.
  const [submittedName, setSubmittedName] = useState('');
  // Only release the shared scroll lock if this modal is the one holding
  // it — otherwise its mount-time run (closed by default) would clobber a
  // lock some other holder (e.g. the Preloader) still needs.
  const holdsLockRef = useRef(false);
  // Error message ids (unique per instance) and the field to focus once a
  // failed submit's errors have rendered — so assistive tech reads the
  // field's label, invalid state and error together.
  const errorIdPrefix = useId();
  const errorId = (field) => `${errorIdPrefix}-${field}-error`;
  const focusAfterErrorsRef = useRef(null);

  useEffect(() => {
    if (!focusAfterErrorsRef.current) return;
    document.getElementById(focusAfterErrorsRef.current)?.focus();
    focusAfterErrorsRef.current = null;
  }, [errors]);

  // aria-invalid + a link to the visible error text while there is one.
  // Explicit "false" otherwise: with `required`, browsers would report an
  // empty <select> or half-typed email as invalid before any submit.
  const errorProps = (field) => (errors[field]
    ? { 'aria-invalid': true, 'aria-describedby': errorId(field) }
    : { 'aria-invalid': false });
  // The post-submit auto-close. Cancelled whenever the modal closes, so a
  // timer from an earlier booking can't close the modal after it's been
  // reopened (dropping whatever the visitor is typing).
  const autoCloseTimerRef = useRef(null);
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const titleId = useId();
  // Latest onClose for the keydown listener, without re-running the focus
  // effect (and re-focusing the heading) whenever the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Dialog keyboard behaviour while open: background made inert, focus moved
  // to the heading, Tab/Shift+Tab kept inside, Escape closes. On close (or
  // unmount) the background and focus are restored to the opener.
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const restoreInert = inertOutside(dialog);
    headingRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(dialog);
      if (focusable.length === 0) {
        e.preventDefault();
        headingRef.current?.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = dialog.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      restoreInert();
      if (canRestoreFocus(opener)) opener.focus({ preventScroll: true });
    };
  }, [isOpen]);

  // Apply the opening context each time the modal opens. Only a real service
  // title is ever put into the form — anything else would leave the <select>
  // showing one option while state (and the WhatsApp message) held another.
  // Opened from a project with no unambiguous service → no preselection, so
  // the visitor must choose one.
  useEffect(() => {
    if (!isOpen) return;
    if (isValidService(defaultService)) {
      setFormData((prev) => ({ ...prev, service: defaultService }));
    } else if (project) {
      setFormData((prev) => ({ ...prev, service: '' }));
    }
  }, [isOpen, defaultService, project]);

  useEffect(() => {
    const lenis = getLenis();
    if (isOpen) {
      lockScroll();
      holdsLockRef.current = true;
      lenis?.stop();
    } else {
      clearTimeout(autoCloseTimerRef.current);
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
    if (!isValidService(formData.service)) newErrors.service = 'Please select a service';
    // Validated fields in on-screen order → element ids.
    const firstInvalid = ['name', 'phone', 'email', 'service'].find((field) => newErrors[field]);
    focusAfterErrorsRef.current = firstInvalid ? `c-${firstInvalid}` : null;
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

    if (!openWhatsApp(buildConsultationMessage(formData, project))) {
      setErrors({ submit: 'Booking via WhatsApp is unavailable right now. Please call us directly.' });
      return;
    }

    // This modal stays mounted between opens, so clear the form now —
    // otherwise the next booking would start pre-filled with these details.
    setSubmittedName(formData.name.trim());
    setFormData(emptyForm(defaultService));
    setIsSuccess(true);
    autoCloseTimerRef.current = setTimeout(() => {
      onClose();
    }, 4000);
  };

  return (
    <div
      ref={dialogRef}
      className={styles.modalOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className={styles.modalContent} data-lenis-prevent onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close consultation modal">
          <X size={22} />
        </button>

        <div className={styles.modalHeader}>
          <div className="eyebrow no-decor">SCHEDULE AN APPOINTMENT</div>
          <h2 id={titleId} ref={headingRef} tabIndex={-1} className={styles.modalTitle}>
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
                  required
                  {...errorProps('name')}
                />
                {errors.name && (
                  <span id={errorId('name')} className={styles.errorMsg}>
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
                  required
                  {...errorProps('phone')}
                />
                {errors.phone && (
                  <span id={errorId('phone')} className={styles.errorMsg}>
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
                  required
                  {...errorProps('email')}
                />
                {errors.email && (
                  <span id={errorId('email')} className={styles.errorMsg}>
                    <AlertCircle size={12} /> {errors.email}
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="c-service">Service of Interest *</label>
                <select
                  id="c-service"
                  name="service"
                  value={formData.service}
                  onChange={handleChange}
                  className={`${styles.select} ${errors.service ? styles.inputError : ''}`}
                  required
                  // Chrome doesn't expose native `required` on <select> to the accessibility tree.
                  aria-required="true"
                  {...errorProps('service')}
                >
                  <option value="" disabled>
                    Select a service
                  </option>
                  {SERVICES_LIST.map((svc) => (
                    <option key={svc} value={svc}>
                      {svc}
                    </option>
                  ))}
                </select>
                {errors.service && (
                  <span id={errorId('service')} className={styles.errorMsg}>
                    <AlertCircle size={12} /> {errors.service}
                  </span>
                )}
              </div>
            </div>

            {project && (
              <p className={styles.projectContext}>
                Enquiry about project: <strong>{project}</strong>
              </p>
            )}

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
              <span role="alert" className={styles.errorMsg}>
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
