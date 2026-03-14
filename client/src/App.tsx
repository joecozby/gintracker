import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Players from "./pages/Players";
import PlayerProfile from "./pages/PlayerProfile";
import Sessions from "./pages/Sessions";
import GameBoard from "./pages/GameBoard";
import Leaderboard from "./pages/Leaderboard";
import HeadToHead from "./pages/HeadToHead";
import Charts from "./pages/Charts";
import Rules from "./pages/Rules";
import AdminPage from "./pages/Admin";
import AIInsights from "./pages/AIInsights";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/players" component={Players} />
        <Route path="/players/:id" component={PlayerProfile} />
        <Route path="/sessions" component={Sessions} />
        <Route path="/sessions/:id" component={GameBoard} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/head-to-head" component={HeadToHead} />
        <Route path="/charts" component={Charts} />
        <Route path="/rules" component={Rules} />
        <Route path="/insights" component={AIInsights} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
