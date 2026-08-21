import React, { useState } from 'react';
import { processSteps } from '../../data/processData';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import styles from './Process.module.scss';

const Process = ({ onOpenConsultation }) => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="process" className={`section-padding ${styles.processSection}`}>
      <div className="container">
        {/* Section Header */}
        <div className="section-header">
          <div className="eyebrow">OUR METHODOLOGY</div>
          <h2 className="section-title">FROM CONCEPT TO CREATION</h2>
          <div className="gold-divider" />
          <p className="section-subtitle">
            A disciplined six-stage architectural workflow ensuring precision at every step.
          </p>
        </div>

        {/* Interactive Desktop / Mobile Timeline */}
        <div className={styles.timelineWrapper}>
          {/* Glowing Gold Path Line */}
          <div className={styles.connectorLine} aria-hidden="true" />

          {/* 6 Step Cards */}
          <div className={styles.stepsGrid}>
            {processSteps.map((step, index) => {
              const isActive = activeStep === index;
              return (
                <div 
                  key={step.step} 
                  className={`${styles.stepCard} ${isActive ? styles.activeStep : ''}`}
                  onClick={() => setActiveStep(index)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Step ${step.step}: ${step.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveStep(index);
                    }
                  }}
                >
                  {/* Step Marker Node */}
                  <div className={styles.stepNode}>
                    <span className={styles.stepNumber}>{step.step}</span>
                  </div>

                  <div className={styles.stepContent}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepSubtitle}>{step.subtitle}</span>
                      <h3 className={styles.stepTitle}>{step.title}</h3>
                    </div>

                    <p className={styles.stepDesc}>{step.description}</p>
                  </div>

                  <div className={styles.stepBottomBorder} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Process CTA */}
        <div className={styles.processCtaRow}>
          <p className={styles.ctaPrompt}>
            Ready to initiate Step 01 for your residential or commercial space?
          </p>
          <button
            type="button"
            className="btn btn-primary-gold"
            onClick={onOpenConsultation}
          >
            <span>Book Your Initial Consultation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default Process;
