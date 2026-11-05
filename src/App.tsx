import { Navigate, Route, Routes } from "react-router-dom";
import { useGameStore } from "./store/gameStore";
import { Layout } from "./ui/components/layout/Layout";
import Start from "./ui/pages/Start";
import Home from "./ui/pages/Home";
import PlayerSearch from "./ui/pages/players/PlayerSearch";
import Shortlist from "./ui/pages/players/Shortlist";
import PlayerPage from "./ui/pages/players/PlayerPage";
import AddPlayer from "./ui/pages/godmode/AddPlayer";
import Windows from "./ui/pages/competitions/Windows";
import Rankings from "./ui/pages/competitions/Rankings";
import NationPage from "./ui/pages/competitions/NationPage";
import NationsLeaguePage from "./ui/pages/competitions/NationsLeaguePage";
import GoldCupPage from "./ui/pages/competitions/GoldCupPage";
import GoldCupPlayoffPage from "./ui/pages/competitions/GoldCupPlayoffPage";
import U20WorldCupPage from "./ui/pages/competitions/U20WorldCupPage";
import ConfederationsCupPage from "./ui/pages/competitions/ConfederationsCupPage";
import CopaAmericaPage from "./ui/pages/competitions/CopaAmericaPage";
import AfconPage from "./ui/pages/competitions/AfconPage";
import AfconQualifiersPage from "./ui/pages/competitions/AfconQualifiersPage";
import AfcCupPage from "./ui/pages/competitions/AfcCupPage";
import AfcCupQualifiersPage from "./ui/pages/competitions/AfcCupQualifiersPage";
import OfcCupPage from "./ui/pages/competitions/OfcCupPage";
import OfcCupQualifiersPage from "./ui/pages/competitions/OfcCupQualifiersPage";
import EuroPage from "./ui/pages/competitions/EuroPage";
import EuroQualifiersPage from "./ui/pages/competitions/EuroQualifiersPage";
import WorldCupQualifiersPage, { WorldCupPage } from "./ui/pages/competitions/worldcup/WorldCupQualifiersPage";

const WORLD_CUP_QUALIFYING_CONFEDERATIONS = ["UEFA", "CONCACAF", "CONMEBOL", "OFC", "AFC", "CAF"] as const;

export default function App() {
  useGameStore(state => state.tick);
  const game = useGameStore(state => state.game);

  if (!game) return <Start />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Players */}
        <Route path="/player-search" element={<PlayerSearch />} />
        <Route path="/shortlist" element={<Shortlist />} />
        <Route path="/player/:id" element={<PlayerPage />} />

        {/* God Mode */}
        <Route path="/god/add-player" element={<AddPlayer />} />

        {/* International competitions */}
        <Route path="/international" element={<Windows />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/nation/:code" element={<NationPage />} />
        <Route path="/nations-league/:confederation" element={<NationsLeaguePage />} />
        <Route path="/world-cup" element={<WorldCupPage />} />
        {WORLD_CUP_QUALIFYING_CONFEDERATIONS.map(confederation => (
          <Route
            key={confederation}
            path={`/world-cup-qualifiers/${confederation}`}
            element={<WorldCupQualifiersPage confederation={confederation} />}
          />
        ))}
        <Route path="/world-cup-intercontinental-playoff" element={<WorldCupQualifiersPage confederation="ICPO" />} />
        <Route path="/euro" element={<EuroPage />} />
        <Route path="/euro-qualifiers" element={<EuroQualifiersPage />} />
        <Route path="/copa-america" element={<CopaAmericaPage />} />
        <Route path="/confederations-cup" element={<ConfederationsCupPage />} />
        <Route path="/u20-world-cup" element={<U20WorldCupPage />} />
        <Route path="/afcon" element={<AfconPage />} />
        <Route path="/afcon-qualifiers" element={<AfconQualifiersPage />} />
        <Route path="/afc-cup" element={<AfcCupPage />} />
        <Route path="/afc-cup-qualifiers" element={<AfcCupQualifiersPage />} />
        <Route path="/gold-cup" element={<GoldCupPage />} />
        <Route path="/gold-cup-playoff" element={<GoldCupPlayoffPage />} />
        <Route path="/ofc-cup" element={<OfcCupPage />} />
        <Route path="/ofc-cup-qualifiers" element={<OfcCupQualifiersPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
