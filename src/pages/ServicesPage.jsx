import React from 'react';
import Services from '../components/Services/Services';

const ServicesPage = ({ onOpenConsultation }) => {
  return (
    <main id="main-content" tabIndex={-1} className="subpage-layout">
      <h1 className="visually-hidden">Our Services</h1>
      <Services onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ServicesPage;
