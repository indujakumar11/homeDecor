import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Home, Briefcase, Store, Hotel, Factory, ArrowRight, ShieldCheck, Award } from 'lucide-react';
import styles from './About.module.scss';

const SECTORS = [
  { name: 'Residential Spaces', icon: Home },
  { name: 'Commercial Interiors', icon: Building2 },
  { name: 'Corporate Offices', icon: Briefcase },
  { name: 'Retail Environments', icon: Store },
  { name: 'Hospitality & Dining', icon: Hotel },
  { name: 'Industrial Spaces', icon: Factory }
];

const About = ({ onOpenConsultation }) => {
  const navigate = useNavigate();

  return (
    <section id="about" className={`section-padding ${styles.aboutSection}`}>
      <div className="container">
        <div className={styles.aboutGrid}>
          {/* Left Column: Visual Image with Luxury Gold Framing */}
          <div className={styles.imageCol}>
            <div className={styles.imageFrameOuter}>
              <div className={styles.imageWrapper}>
                <img 
                  src="assets/services/murals.jpg" 
                  alt="Black Shades Master Craftsmen and Sculptural Artwork" 
                  className={styles.aboutImage}
                />
                <div className={styles.imageOverlay} />
              </div>
              
              {/* Floating Architectural Badge */}
              <div className={styles.floatingCard}>
                <div className={styles.cardHeader}>
                  <ShieldCheck className={styles.cardIcon} size={20} />
                  <span className={styles.cardEyebrow}>ARTISTRY & PRECISION</span>
                </div>
                <p className={styles.cardText}>
                  Bespoke Murals, Sculptures & Architectural Décor
                </p>
                <div className={styles.cardLocation}>
                  <span>Based in Chennai • Serving Tamil Nadu & Pan-India</span>
                </div>
              </div>

              {/* Decorative Corner Lines */}
              <div className={styles.cornerBorder} />
            </div>
          </div>

          {/* Right Column: Narrative & Sectors */}
          <div className={styles.contentCol}>
            <div className="eyebrow">ABOUT BLACK SHADES</div>
            
            <h2 className={styles.mainTitle}>
              We Don't Just Decorate Spaces. <span className="gold-text">We Create Experiences.</span>
            </h2>
            
            <p className={styles.leadParagraph}>
              Black Shades Home Decors specializes in transforming ordinary spaces into distinctive environments through custom décor, sculptural craftsmanship, architectural elements and complete interior solutions.
            </p>
            
            <p className={styles.bodyParagraph}>
              Rooted in Chennai, our collective blends classical sculpting traditions, modern composite materials (FRP, marble stone powder, WPC, acrylic), and computational 3D parametric design. From high-relief feature walls to corporate headquarters and luxury villas, every project is tailored with uncompromising attention to detail.
            </p>

            {/* Sectors Served Grid */}
            <div className={styles.sectorsWrapper}>
              <h3 className={styles.sectorsHeading}>SECTORS WE TRANSFORM</h3>
              <div className={styles.sectorsGrid}>
                {SECTORS.map((sector) => {
                  const Icon = sector.icon;
                  return (
                    <div key={sector.name} className={styles.sectorPill}>
                      <Icon size={14} className={styles.sectorIcon} />
                      <span>{sector.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.actionRow}>
              <button
                type="button"
                className="btn btn-primary-gold"
                onClick={() => navigate('/services')}
              >
                <span>Discover Our Services</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="btn btn-outline-gold"
                onClick={onOpenConsultation}
              >
                <span>Book a Consultation</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
