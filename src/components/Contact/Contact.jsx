import React, { useState } from 'react';
import { Phone, Mail, MapPin, Send, CheckCircle2, AlertCircle, Clock, Shield } from 'lucide-react';
import styles from './Contact.module.scss';

const PROJECT_TYPES = [
  'Custom Murals & Relief Walls',
  'FRP & Fiberglass Sculptures',
  'Marble Stone Powder Sculptures',
  '3D Parametric & Bespoke Designs',
  'Interior Décor & Execution',
  'Signage & Pylon Boards',
  'Commercial & Corporate Interiors',
  'Warehouse & Supermarket Solutions',
  'Concept to Completion Turnkey Projects',
  'Other Bespoke Requirements'
];

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    projectType: 'Custom Murals & Relief Walls',
    message: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter your full name';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Please enter your contact phone number';
    } else if (!/^[0-9+-\s]{8,15}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Please enter a valid phone number (e.g. +91 97908 38319)';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Please provide details about your project or space';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Please describe your requirements in at least 10 characters';
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
    if (!validateForm()) return;

    setIsSubmitting(true);
    // Simulate frontend form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setFormData({
        name: '',
        phone: '',
        email: '',
        projectType: 'Custom Murals & Relief Walls',
        message: ''
      });
      // Auto-hide success after 7 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 7000);
    }, 600);
  };

  return (
    <section id="contact" className={`section-padding ${styles.contactSection}`}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="eyebrow">GET IN TOUCH</div>
          <h2 className="section-title">LET'S TALK ABOUT YOUR SPACE</h2>
          <div className="gold-divider" />
          <p className="section-subtitle">
            Whether envisioning a private residential haven or a landmark corporate facility, our team is ready to assist.
          </p>
        </div>

        <div className={styles.contactGrid}>
          {/* Left Column: Direct Contact Details & Info */}
          <div className={styles.contactInfoCol}>
            <div className={styles.infoCard}>
              <h3 className={styles.infoTitle}>Direct Contact Channels</h3>
              <p className={styles.infoDesc}>
                Reach out directly to discuss architectural blueprints, sculpture casting, or schedule an on-site spatial walkthrough in Chennai.
              </p>

              <div className={styles.contactCardsList}>
                {/* Phone */}
                <a href="tel:+919790838319" className={styles.contactItem}>
                  <div className={styles.contactIconCircle}>
                    <Phone size={20} />
                  </div>
                  <div className={styles.contactText}>
                    <span className={styles.contactLabel}>DIRECT PHONE / WHATSAPP</span>
                    <span className={styles.contactValue}>+91 97908 38319</span>
                  </div>
                </a>

                {/* Email */}
                <a href="mailto:blackshadeshomedecors@gmail.com" className={styles.contactItem}>
                  <div className={styles.contactIconCircle}>
                    <Mail size={20} />
                  </div>
                  <div className={styles.contactText}>
                    <span className={styles.contactLabel}>OFFICIAL EMAIL</span>
                    <span className={styles.contactValue}>blackshadeshomedecors@gmail.com</span>
                  </div>
                </a>

                {/* Location */}
                <div className={styles.contactItem}>
                  <div className={styles.contactIconCircle}>
                    <MapPin size={20} />
                  </div>
                  <div className={styles.contactText}>
                    <span className={styles.contactLabel}>HEADQUARTERS & SERVICE AREA</span>
                    <span className={styles.contactValue}>Chennai & Surrounding Areas, Tamil Nadu</span>
                  </div>
                </div>
              </div>

              {/* Consultation Highlights */}
              <div className={styles.trustHighlights}>
                <div className={styles.trustPill}>
                  <Clock size={16} className={styles.trustIcon} />
                  <span>Prompt Response Within 24 Hours</span>
                </div>
                <div className={styles.trustPill}>
                  <Shield size={16} className={styles.trustIcon} />
                  <span>On-Site Spatial Assessment Available</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Consultation Form */}
          <div className={styles.contactFormCol}>
            <div className={styles.formCard}>
              <h3 className={styles.formHeading}>Send a Project Enquiry</h3>

              {submitSuccess && (
                <div className={styles.successAlert} role="alert">
                  <CheckCircle2 size={22} className={styles.alertIcon} />
                  <div>
                    <strong>Thank you for contacting Black Shades Home Decors!</strong>
                    <p>Your enquiry has been received. Our senior design specialist will connect with you promptly at your provided contact number.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className={styles.form}>
                {/* Name */}
                <div className={styles.inputGroup}>
                  <label htmlFor="name" className={styles.inputLabel}>
                    Full Name <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Rajesh Kumar"
                    className={`${styles.inputField} ${errors.name ? styles.inputError : ''}`}
                  />
                  {errors.name && (
                    <span className={styles.errorMessage}>
                      <AlertCircle size={13} /> {errors.name}
                    </span>
                  )}
                </div>

                {/* Phone & Email Row */}
                <div className={styles.formRow}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="phone" className={styles.inputLabel}>
                      Phone Number <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className={`${styles.inputField} ${errors.phone ? styles.inputError : ''}`}
                    />
                    {errors.phone && (
                      <span className={styles.errorMessage}>
                        <AlertCircle size={13} /> {errors.phone}
                      </span>
                    )}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="email" className={styles.inputLabel}>
                      Email Address <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="yourname@gmail.com"
                      className={`${styles.inputField} ${errors.email ? styles.inputError : ''}`}
                    />
                    {errors.email && (
                      <span className={styles.errorMessage}>
                        <AlertCircle size={13} /> {errors.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Project Type */}
                <div className={styles.inputGroup}>
                  <label htmlFor="projectType" className={styles.inputLabel}>
                    Service / Project Interest
                  </label>
                  <div className={styles.selectWrapper}>
                    <select
                      id="projectType"
                      name="projectType"
                      value={formData.projectType}
                      onChange={handleChange}
                      className={styles.selectField}
                    >
                      {PROJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Message */}
                <div className={styles.inputGroup}>
                  <label htmlFor="message" className={styles.inputLabel}>
                    Project Details & Scope <span className={styles.required}>*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows="4"
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Describe your space dimensions, preferred style (murals, FRP statues, turnkey interior), or site location..."
                    className={`${styles.textareaField} ${errors.message ? styles.inputError : ''}`}
                  ></textarea>
                  {errors.message && (
                    <span className={styles.errorMessage}>
                      <AlertCircle size={13} /> {errors.message}
                    </span>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`btn btn-primary-gold ${styles.submitBtn}`}
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'PROCESSING...' : 'SEND ENQUIRY'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
