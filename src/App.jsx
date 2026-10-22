import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; // Path sirrii ta'e!

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Route fooyya'aani fi components kee as keessa jiru */}
      </Router>
    </AuthProvider>
  );
}

export default App;