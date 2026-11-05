import { useGame } from "../../../store/gameStore";
import InternationalCupPage from "./InternationalCupPage";

export default function ConfederationsCupPage() {
  const editions = useGame().world.international.confedCup.editions;
  return <InternationalCupPage title="Confederations Cup" subtitle="" editions={editions} />;
}
