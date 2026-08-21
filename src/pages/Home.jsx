import React from 'react';
import Hero from '../components/Hero/Hero';
import TrustStrip from '../components/TrustStrip/TrustStrip';
import About from '../components/About/About';
import Services from '../components/Services/Services';
import Gallery from '../components/Gallery/Gallery';
import Showcase from '../components/Showcase/Showcase';
import WhyChooseUs from '../components/WhyChooseUs/WhyChooseUs';
import Process from '../components/Process/Process';
import CTA from '../components/CTA/CTA';
import Contact from '../components/Contact/Contact';

const Home = ({ onOpenConsultation }) => {
  return (
    <main id="main-content">
      <Hero onOpenConsultation={onOpenConsultation} />
      <TrustStrip />
      <About onOpenConsultation={onOpenConsultation} />
      <Services onOpenConsultation={onOpenConsultation} />
      <Gallery onOpenConsultation={onOpenConsultation} />
      <Showcase onOpenConsultation={onOpenConsultation} />
      <WhyChooseUs onOpenConsultation={onOpenConsultation} />
      <Process onOpenConsultation={onOpenConsultation} />
      <CTA onOpenConsultation={onOpenConsultation} />
      <Contact />
    </main>
  );
};

export default Home;
