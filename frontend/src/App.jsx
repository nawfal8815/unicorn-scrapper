import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthGate from './components/AuthGate';
import NavBar from './components/NavBar';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import ExternalJobs from './pages/ExternalJobs';
import './App.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthGate>
          <NavBar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/external-jobs" element={<ExternalJobs />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </AuthProvider>
  );
}
