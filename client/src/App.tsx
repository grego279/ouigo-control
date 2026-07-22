import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Router as WouterRouter, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DiagDictee from "./pages/DiagDictee";

// Sous GitHub Pages l'app est servie depuis un sous-dossier (ex: /ouigo-control/)
// plutôt qu'à la racine du domaine. On récupère ce préfixe automatiquement à
// partir du <base> défini par Vite au moment du build (voir vite.config.ts).
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <WouterRouter base={BASE_PATH}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/diag-dictee"} component={DiagDictee} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
