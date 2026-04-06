/**
 * TALENTRY — App.tsx  (UPDATED)
 *
 * Adds two new recruiter routes:
 *  /recruiter/interview/:sessionId          → RecruiterAIInterview (conductor)
 *  /recruiter/interview/:sessionId/results  → RecruiterInterviewResults
 *
 * All other routes unchanged.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { CareerFlowProvider } from "@/contexts/CareerFlowContext";
import { AccountTypeProvider } from "@/contexts/AccountTypeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RecruiterProtectedRoute from "@/components/RecruiterProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { RecruiterLayout } from "@/components/recruiter/RecruiterLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChooseAccountType from "./pages/ChooseAccountType";
import RecruiterOnboarding from "./pages/RecruiterOnboarding";
import Dashboard from "./pages/Dashboard";
import Analysis from "./pages/Analysis";
import Builder from "./pages/Builder";
import Marketing from "./pages/Marketing";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import ResumeEnhancement from "./pages/ResumeEnhancement";
import InterviewAvatar from "./pages/InterviewAvatar";
import InterviewHistory from "./pages/InterviewHistory";
import JobSearch from "./pages/JobSearch";
import NotFound from "./pages/NotFound";

// Recruiter pages
import RecruiterDashboard from "./pages/recruiter/RecruiterDashboard";
import RecruiterCandidates from "./pages/recruiter/RecruiterCandidates";
import RecruiterCandidateProfile from "./pages/recruiter/RecruiterCandidateProfile";
import RecruiterInterviews from "./pages/recruiter/RecruiterInterviews";
import RecruiterJobs from "./pages/recruiter/RecruiterJobs";
import RecruiterQuestions from "./pages/recruiter/RecruiterQuestions";
import RecruiterReports from "./pages/recruiter/RecruiterReports";
import RecruiterSettings from "./pages/recruiter/RecruiterSettings";
import RecruiterSearch from "./pages/recruiter/RecruiterSearch";

// ── NEW: Interview Journey pages ──────────────────────────────────────────────
import RecruiterAIInterview from "./pages/recruiter/RecruiterAIInterview";
import RecruiterInterviewResults from "./pages/recruiter/RecruiterInterviewResults";

const queryClient = new QueryClient();

const withProtectedLayout = (children: React.ReactNode) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const withRecruiterLayout = (children: React.ReactNode) => (
  <RecruiterProtectedRoute>
    <RecruiterLayout>{children}</RecruiterLayout>
  </RecruiterProtectedRoute>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <AccountTypeProvider>
                <CareerFlowProvider>
                  <Toaster />
                  <Sonner />

                  <Routes>
                    {/* Public */}
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route
                      path="/choose-account-type"
                      element={
                        <ProtectedRoute>
                          <ChooseAccountType />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/recruiter/onboarding"
                      element={
                        <ProtectedRoute>
                          <RecruiterOnboarding />
                        </ProtectedRoute>
                      }
                    />

                    {/* Job Seeker */}
                    <Route path="/dashboard" element={withProtectedLayout(<Dashboard />)} />
                    <Route path="/analysis" element={withProtectedLayout(<Analysis />)} />
                    <Route path="/builder" element={withProtectedLayout(<Builder />)} />
                    <Route path="/marketing" element={withProtectedLayout(<Marketing />)} />
                    <Route path="/profile" element={withProtectedLayout(<Profile />)} />
                    <Route path="/settings" element={withProtectedLayout(<Settings />)} />
                    <Route path="/enhance" element={withProtectedLayout(<ResumeEnhancement />)} />
                    <Route path="/admin" element={withProtectedLayout(<Admin />)} />
                    <Route path="/dashboard/interview-avatar" element={withProtectedLayout(<InterviewAvatar />)} />
                    <Route path="/dashboard/interview-history" element={withProtectedLayout(<InterviewAvatar />)} />
                    <Route path="/job-search" element={withProtectedLayout(<JobSearch />)} />

                    {/* Recruiter — core pages */}
                    <Route path="/recruiter/dashboard" element={withRecruiterLayout(<RecruiterDashboard />)} />
                    <Route path="/recruiter/candidates" element={withRecruiterLayout(<RecruiterCandidates />)} />
                    <Route
                      path="/recruiter/candidates/:id"
                      element={withRecruiterLayout(<RecruiterCandidateProfile />)}
                    />
                    <Route path="/recruiter/interviews" element={withRecruiterLayout(<RecruiterInterviews />)} />
                    <Route path="/recruiter/jobs" element={withRecruiterLayout(<RecruiterJobs />)} />
                    <Route path="/recruiter/search" element={withRecruiterLayout(<RecruiterSearch />)} />
                    <Route path="/recruiter/questions" element={withRecruiterLayout(<RecruiterQuestions />)} />
                    <Route path="/recruiter/reports" element={withRecruiterLayout(<RecruiterReports />)} />
                    <Route
                      path="/recruiter/settings"
                      element={
                        <ProtectedRoute>
                          <RecruiterSettings />
                        </ProtectedRoute>
                      }
                    />

                    {/* ── NEW: Interview Journey routes ───────────────────── */}
                    {/* Full-screen interview conductor (no sidebar) */}
                    <Route
                      path="/recruiter/interview/:sessionId"
                      element={
                        <RecruiterProtectedRoute>
                          <RecruiterAIInterview />
                        </RecruiterProtectedRoute>
                      }
                    />
                    {/* Results page (no sidebar) */}
                    <Route
                      path="/recruiter/interview/:sessionId/results"
                      element={
                        <RecruiterProtectedRoute>
                          <RecruiterInterviewResults />
                        </RecruiterProtectedRoute>
                      }
                    />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </CareerFlowProvider>
              </AccountTypeProvider>
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
