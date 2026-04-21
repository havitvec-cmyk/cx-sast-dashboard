import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExtractProvider } from './context/ExtractContext';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Projects from './pages/Projects';
import Compliance from './pages/Compliance';
import Trends from './pages/Trends';
import RiskPortfolio from './pages/RiskPortfolio';
import Remediation from './pages/Remediation';

export default function App() {
  return (
    <ExtractProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"            element={<Overview />}      />
            <Route path="/projects"    element={<Projects />}      />
            <Route path="/risk"        element={<RiskPortfolio />} />
            <Route path="/remediation" element={<Remediation />}   />
            <Route path="/compliance"  element={<Compliance />}    />
            <Route path="/trends"      element={<Trends />}        />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ExtractProvider>
  );
}
