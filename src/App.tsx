import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import JobsList from "@/pages/JobsList";
import JobDetail from "@/pages/JobDetail";
import QuickPreview from "@/pages/QuickPreview";
import Layout from "@/components/Layout";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/quick-preview" element={<QuickPreview />} />
        </Routes>
      </Layout>
    </Router>
  );
}
