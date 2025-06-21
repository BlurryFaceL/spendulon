import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// Available colors with their Tailwind classes
const AVAILABLE_COLORS = [
  { name: 'emerald', label: 'Green', bgClass: 'bg-emerald-500', textClass: 'text-emerald-500' },
  { name: 'blue', label: 'Blue', bgClass: 'bg-blue-500', textClass: 'text-blue-500' },
  { name: 'purple', label: 'Purple', bgClass: 'bg-purple-500', textClass: 'text-purple-500' },
  { name: 'rose', label: 'Rose', bgClass: 'bg-rose-500', textClass: 'text-rose-500' },
  { name: 'amber', label: 'Amber', bgClass: 'bg-amber-500', textClass: 'text-amber-500' },
  { name: 'cyan', label: 'Cyan', bgClass: 'bg-cyan-500', textClass: 'text-cyan-500' },
  { name: 'indigo', label: 'Indigo', bgClass: 'bg-indigo-500', textClass: 'text-indigo-500' },
  { name: 'yellow', label: 'Yellow', bgClass: 'bg-yellow-500', textClass: 'text-yellow-500' },
  { name: 'sky', label: 'Sky', bgClass: 'bg-sky-500', textClass: 'text-sky-500' },
  { name: 'orange', label: 'Orange', bgClass: 'bg-orange-500', textClass: 'text-orange-500' },
  { name: 'violet', label: 'Violet', bgClass: 'bg-violet-500', textClass: 'text-violet-500' },
  { name: 'fuchsia', label: 'Fuchsia', bgClass: 'bg-fuchsia-500', textClass: 'text-fuchsia-500' },
  { name: 'slate', label: 'Gray', bgClass: 'bg-slate-500', textClass: 'text-slate-500' },
  { name: 'lime', label: 'Lime', bgClass: 'bg-lime-500', textClass: 'text-lime-500' },
  { name: 'pink', label: 'Pink', bgClass: 'bg-pink-500', textClass: 'text-pink-500' },
  { name: 'teal', label: 'Teal', bgClass: 'bg-teal-500', textClass: 'text-teal-500' }
];

// Get color info by name
const getColorInfo = (colorName) => {
  return AVAILABLE_COLORS.find(color => color.name === colorName) || AVAILABLE_COLORS[0];
};

const ColorSelect = ({ value, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const selectedColor = getColorInfo(value);

  const handleSelect = (colorName) => {
    onChange(colorName);
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
          <div className={`w-6 h-6 rounded-full ${selectedColor.bgClass}`}></div>
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
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleSelect(color.name)}
                  className={`aspect-square px-2 py-2 hover:bg-gray-700 transition-colors flex items-center justify-center rounded ${
                    value === color.name ? 'bg-gray-700 text-blue-400' : 'text-white'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full ${color.bgClass}`}></div>
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

export default ColorSelect;