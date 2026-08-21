import React, { useState } from 'react';
import Navbar from './components/Navbar/Navbar';
import Home from './pages/Home';
import Footer from './components/Footer/Footer';
import WhatsAppButton from './components/WhatsAppButton/WhatsAppButton';
import ConsultationModal from './components/ConsultationModal/ConsultationModal';

function App() {
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
    <div className="app-root">
      {/* Sticky Header Navigation */}
      <Navbar onOpenConsultation={handleOpenConsultation} />

      {/* Main Content View */}
      <Home onOpenConsultation={handleOpenConsultation} />

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
  );
}

export default App;
