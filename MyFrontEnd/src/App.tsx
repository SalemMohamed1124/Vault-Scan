import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TooltipProvider } from "@/components/ui/tooltip"; //
import { Toaster } from "@/components/ui/sonner";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import Landing from "./Pages/Landing";
import AppLayout from "./components/Customized/AppLayout";
import Overview from "./Pages/Dashboard/Overview";
import Domains from "./Pages/AttackSurface/Domains";
import IPs from "./Pages/AttackSurface/IPs";
import Ports from "./Pages/AttackSurface/Ports";
import Login from "./Pages/Authentication/Login";
import Register from "./Pages/Authentication/Register";
import Open from "./Pages/Vulnerabilities/Open";
import Fixed from "./Pages/Vulnerabilities/Fixed";
import Assets from "./Pages/ScanManagement/Assets";
import Schedule from "./Pages/ScanManagement/Schedule";
import Organization from "./Pages/Administration/Organization/Members";
import HistoryTabs from "./Pages/Administration/History/HistoryTabs";
import OrganizationTabs from "./Pages/Administration/Organization/OrganizationTabs";
import ScanHistory from "./Pages/Administration/History/Scans";
import Notifications from "./Pages/Administration/History/Notifications";
import ScanDetails from "./Pages/Administration/History/ScanDetails";
import PageNotFound from "./Pages/PageNotFound";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import { ConfirmContextProvider } from "./Contexts/ConfirmModalContext";
import { ViewModalContextProvider } from "./Contexts/ViewModalContext";
import { ThemeProvider } from "./Contexts/ThemeContext";
import Invitations from "./Pages/Administration/Organization/Invitations";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },

  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="overview" replace /> },
      { path: "overview", element: <Overview /> },
      { path: "domains", element: <Domains /> },
      { path: "ips", element: <IPs /> },
      { path: "ports", element: <Ports /> },
      { path: "open", element: <Open /> },
      { path: "fixed", element: <Fixed /> },
      { path: "assets", element: <Assets /> },
      { path: "schedule", element: <Schedule /> },

      {
        path: "history",
        element: <HistoryTabs />,
        children: [
          { index: true, element: <ScanHistory /> }, // /history
          { path: "notifications", element: <Notifications /> }, // /history/notifications
        ],
      },

      {
        path: "organization",
        element: <OrganizationTabs />,
        children: [
          { index: true, element: <Organization /> }, // /organization
          { path: "invitations", element: <Invitations /> }, // /organization/invitations
        ],
      },

      { path: "history/:id", element: <ScanDetails /> },
    ],
  },

  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "*", element: <PageNotFound /> },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <ConfirmContextProvider>
          <ViewModalContextProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
              <Toaster position="top-center" />
            </TooltipProvider>
          </ViewModalContextProvider>
        </ConfirmContextProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
