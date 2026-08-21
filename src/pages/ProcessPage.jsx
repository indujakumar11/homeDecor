import React from 'react';
import Process from '../components/Process/Process';

const ProcessPage = ({ onOpenConsultation }) => {
  return (
    <main className="subpage-layout">
      <Process onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ProcessPage;
