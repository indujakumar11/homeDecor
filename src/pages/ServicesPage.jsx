import React from 'react';
import Services from '../components/Services/Services';

const ServicesPage = ({ onOpenConsultation }) => {
  return (
    <main className="subpage-layout">
      <Services onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ServicesPage;
