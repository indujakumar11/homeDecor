import React, { useState } from 'react';
import { servicesData } from '../../data/servicesData';
import { ArrowRight, Sparkles, Check, X, Calendar } from 'lucide-react';
import styles from './Services.module.scss';

const Services = ({ onOpenConsultation }) => {
  const [selectedService, setSelectedService] = useState(null);

  const handleOpenDetail = (service) => {
    setSelectedService(service);
  };

  const handleCloseModal = () => {
    setSelectedService(null);
  };

  return (
    <section id="services" className={`section-padding ${styles.servicesSection}`}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="eyebrow">SERVICES & EXPERTISE</div>
          <h2 className="section-title">WHAT WE DO</h2>
          <div className="gold-divider" />
          <p className="section-subtitle">
            Creative craftsmanship. Architectural thinking. Complete solutions.
          </p>
        </div>

        {/* 9 Architectural Service Cards Grid */}
        <div className={styles.servicesGrid}>
          {servicesData.map((service) => (
            <article 
              key={service.id} 
              className={styles.serviceCard}
              onClick={() => handleOpenDetail(service)}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${service.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpenDetail(service);
                }
              }}
            >
              {/* Card Image Container */}
              <div className={styles.cardImageWrapper}>
                <img 
                  src={service.image} 
                  alt={service.title} 
                  className={styles.cardImage}
                  loading="lazy"
                />
                <div className={styles.imageOverlayGradient} />
                
                {/* Category Number Tag */}
                <span className={styles.numberBadge}>{service.number}</span>
              </div>

              {/* Card Content */}
              <div className={styles.cardBody}>
                <div className={styles.cardHeaderRow}>
                  <h3 className={styles.cardTitle}>{service.title}</h3>
                </div>
                
                <p className={styles.cardDescription}>{service.description}</p>

                {/* Card Footer Action */}
                <div className={styles.cardFooter}>
                  <span className={styles.viewDetailsText}>VIEW DETAILS</span>
                  <div className={styles.arrowCircle}>
                    <ArrowRight size={15} className={styles.arrowIcon} />
                  </div>
                </div>
              </div>

              {/* Gold Border Glow Accent */}
              <div className={styles.borderHighlight} />
            </article>
          ))}
        </div>
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div className={styles.modalBackdrop} onClick={handleCloseModal} role="dialog" aria-modal="true">
          <div 
            className={styles.modalContainer} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.modalCloseBtn} 
              onClick={handleCloseModal}
              aria-label="Close details"
            >
              <X size={22} />
            </button>

            <div className={styles.modalGrid}>
              <div className={styles.modalImageCol}>
                <img 
                  src={selectedService.image} 
                  alt={selectedService.title} 
                  className={styles.modalImg}
                />
                <div className={styles.modalImgOverlay} />
                <span className={styles.modalNumber}>{selectedService.number}</span>
              </div>

              <div className={styles.modalContentCol}>
                <span className="eyebrow no-decor">{selectedService.subtitle}</span>
                <h3 className={styles.modalTitle}>{selectedService.title}</h3>
                
                <p className={styles.modalDetailsText}>{selectedService.details}</p>

                <div className={styles.featuresBox}>
                  <h4 className={styles.featuresHeading}>KEY CAPABILITIES</h4>
                  <ul className={styles.featuresList}>
                    {selectedService.features.map((feat, idx) => (
                      <li key={idx} className={styles.featureItem}>
                        <Check size={14} className={styles.checkIcon} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className="btn btn-primary-gold"
                    onClick={() => {
                      handleCloseModal();
                      onOpenConsultation(selectedService.title);
                    }}
                  >
                    <Calendar size={16} />
                    <span>Inquire About This Service</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-gold"
                    onClick={handleCloseModal}
                  >
                    <span>Close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Services;
