import React from 'react';
import Process from '../components/Process/Process';

const ProcessPage = ({ onOpenConsultation }) => {
  return (
    <main id="main-content" tabIndex={-1} className="subpage-layout">
      <h1 className="visually-hidden">Our Process</h1>
      <Process onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ProcessPage;
