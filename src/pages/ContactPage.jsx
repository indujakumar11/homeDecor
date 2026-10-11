import React from 'react';
import Contact from '../components/Contact/Contact';

const ContactPage = () => {
  return (
    <main id="main-content" tabIndex={-1} className="subpage-layout">
      <h1 className="visually-hidden">Contact Us</h1>
      <Contact />
    </main>
  );
};

export default ContactPage;
