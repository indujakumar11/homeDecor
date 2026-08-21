import React from 'react';
import About from '../components/About/About';
import WhyChooseUs from '../components/WhyChooseUs/WhyChooseUs';

const AboutPage = ({ onOpenConsultation }) => {
  return (
    <main className="subpage-layout">
      <About onOpenConsultation={onOpenConsultation} />
      <WhyChooseUs onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default AboutPage;
