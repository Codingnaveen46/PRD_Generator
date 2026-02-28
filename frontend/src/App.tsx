import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import UploadPRD from './pages/UploadPRD';
import PRDViewer from './pages/PRDViewer';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="upload" element={<UploadPRD />} />
          <Route path="prd/:id" element={<PRDViewer />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

