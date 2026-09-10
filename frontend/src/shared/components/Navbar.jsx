import React from 'react';

export const Navbar = ({ onAddClick }) => {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-title">MERN Electronics Store CI/CD Working via K8s. Used Dependerbot, nginx, husky. </span>
        </div>
        <div className="nav-actions">
          {onAddClick && (
            <button className="btn btn-primary" onClick={onAddClick}>
              + Add Product
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
