/**
 * Main App component for Watch Together popup
 */
import React from "react";

export const App: React.FC = () => {
  return (
    <div className="p-5 font-sans">
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Watch Together</h1>
      <p className="text-gray-600 text-sm">
        Chrome extension for synchronized video watching
      </p>
    </div>
  );
};
