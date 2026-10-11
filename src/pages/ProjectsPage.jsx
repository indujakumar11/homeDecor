import React from 'react';
import Gallery from '../components/Gallery/Gallery';

const ProjectsPage = ({ onOpenConsultation }) => {
  return (
    <main id="main-content" tabIndex={-1} className="subpage-layout">
      <h1 className="visually-hidden">Our Projects</h1>
      <Gallery onOpenConsultation={onOpenConsultation} />
    </main>
  );
};

export default ProjectsPage;
