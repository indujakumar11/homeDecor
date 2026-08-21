import React from 'react';
import Hero from '../components/Hero/Hero';
import TrustStrip from '../components/TrustStrip/TrustStrip';
import Showcase from '../components/Showcase/Showcase';
import WhyChooseUs from '../components/WhyChooseUs/WhyChooseUs';
import CTA from '../components/CTA/CTA';

const Home = ({ onOpenConsultation }) => {
  return (
    <main id="main-content">
      <Hero onOpenConsultation={onOpenConsultation} />
      <TrustStrip />
      <Showcase onOpenConsultation={onOpenConsultation} />
      <WhyChooseUs onOpenConsultation={onOpenConsultation} />
      <CTA onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default Home;
