import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProcessPage from './pages/ProcessPage';
import ContactPage from './pages/ContactPage';
import Footer from './components/Footer/Footer';
import WhatsAppButton from './components/WhatsAppButton/WhatsAppButton';
import ConsultationModal from './components/ConsultationModal/ConsultationModal';
import ScrollToTop from './components/common/ScrollToTop';
import SmoothScrollProvider from './components/SmoothScrollProvider';
import PageTransition from './components/PageTransition/PageTransition';
import AdminApp from './admin/AdminApp';

// The public marketing site: Navbar/Footer/WhatsApp/Lenis/GSAP page
// transitions all live here, exactly as before. Unrelated to /admin.
function PublicSite() {
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);
  const [selectedService, setSelectedService] = useState('');

  const handleOpenConsultation = (service = '') => {
    setSelectedService(typeof service === 'string' ? service : '');
    setIsConsultationOpen(true);
  };

  const handleCloseConsultation = () => {
    setIsConsultationOpen(false);
  };

  return (
    <>
      <SmoothScrollProvider />
      <div className="app-root">
        {/* Sticky Header Navigation */}
        <Navbar onOpenConsultation={handleOpenConsultation} />

        {/* Main Content View with Routes */}
        <PageTransition>
          <Routes>
            <Route path="/" element={<Home onOpenConsultation={handleOpenConsultation} />} />
            <Route path="/about" element={<AboutPage onOpenConsultation={handleOpenConsultation} />} />
            <Route path="/services" element={<ServicesPage onOpenConsultation={handleOpenConsultation} />} />
            <Route path="/projects" element={<ProjectsPage onOpenConsultation={handleOpenConsultation} />} />
            <Route path="/process" element={<ProcessPage onOpenConsultation={handleOpenConsultation} />} />
            <Route path="/contact" element={<ContactPage />} />
          </Routes>
        </PageTransition>

        {/* Dark Luxury Footer */}
        <Footer onOpenConsultation={handleOpenConsultation} />

        {/* Floating WhatsApp CTA */}
        <WhatsAppButton />

        {/* Booking / Consultation Modal */}
        <ConsultationModal
          isOpen={isConsultationOpen}
          onClose={handleCloseConsultation}
          defaultService={selectedService}
        />
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Admin portal: its own layout, no public-site chrome or animation. */}
        <Route path="/admin/*" element={<AdminApp />} />
        {/* Everything else is the existing public site, unchanged. */}
        <Route path="/*" element={<PublicSite />} />
      </Routes>
    </Router>
  );
}

export default App;
