import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { renderIcon, getAvailableIconNames } from '../../utils/iconMapping';

const IconSelect = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const iconNames = getAvailableIconNames();

  const handleSelect = (iconName) => {
    onChange(iconName);
    setIsOpen(false);
  };

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  const toggleDropdown = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => updateDropdownPosition();
      window.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      {/* Selected value display */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-colors text-white flex items-center justify-between"
      >
        <div className="flex items-center justify-center">
          {renderIcon(value, { size: 24 })}
        </div>
        <ChevronDown size={16} className="text-gray-400" />
      </button>

      {/* Dropdown - rendered as portal */}
      {isOpen && createPortal(
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 50 }}
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div 
            className="absolute bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 51
            }}
          >
            <div className="grid grid-cols-3 gap-1">
              {iconNames.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => handleSelect(iconName)}
                  className={`aspect-square px-2 py-2 hover:bg-gray-700 transition-colors flex items-center justify-center rounded ${
                    value === iconName ? 'bg-gray-700 text-blue-400' : 'text-white'
                  }`}
                >
                  {renderIcon(iconName, { size: 24 })}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default IconSelect;