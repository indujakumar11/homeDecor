import React from 'react';
import Gallery from '../components/Gallery/Gallery';

const ProjectsPage = ({ onOpenConsultation }) => {
  return (
    <main className="subpage-layout">
      <Gallery onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ProjectsPage;
