import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useGameStore } from "../../../store/gameStore";
import type { AddPlayerInput } from "../../../engine/godMode";
import { MAX_PLAYER_RATING, MIN_PLAYER_RATING, PLAYER_AGE_MAX, PLAYER_AGE_MIN } from "../../../engine/players/config";
import { POSITION_ORDER } from "../../../engine/players/positions";
import { nationInfo } from "../../../engine/nations/nations";
import type { Position } from "../../../engine/players/types";
import { NationTag, PageHeader, Panel } from "../../components/common";

interface AddPlayerForm {
  firstName: string;
  lastName: string;
  position: string;
  age: string;
  overall: string;
  potential: string;
  primaryNationality: string;
  secondaryNationality: string;
}

function emptyForm(): AddPlayerForm {
  return {
    firstName: "",
    lastName: "",
    position: "",
    age: "20",
    overall: "60",
    potential: "65",
    primaryNationality: "",
    secondaryNationality: ""
  };
}

const NATIONS = Object.entries(nationInfo)
  .map(([name, info]) => ({ code: info.threeLetterCode, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function AddPlayer() {
  const game = useGameStore(state => state.game);
  const addPlayer = useGameStore(state => state.godAddPlayer);
  const [form, setForm] = useState<AddPlayerForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  if (!game?.world.godMode) return <Navigate to="/" replace />;

  const update = (key: keyof AddPlayerForm, value: string) => {
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === "primaryNationality" && current.secondaryNationality === value
        ? { secondaryNationality: "" }
        : {})
    }));
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: AddPlayerInput = {
      firstName: form.firstName,
      lastName: form.lastName,
      position: form.position as Position,
      age: Number(form.age),
      overall: Number(form.overall),
      potential: Number(form.potential),
      primaryNationality: form.primaryNationality,
      secondaryNationality: form.secondaryNationality || null
    };
    const result = addPlayer(input);
    if (!result.ok) {
      setError(result.error ?? "Unable to add player.");
      return;
    }
    setError(null);
    setForm(emptyForm());
  };

  const secondaryNations = NATIONS.filter(nation => nation.code !== form.primaryNationality);

  return (
    <div>
      <PageHeader
        title="Add Player"
        subtitle="Create a player for any nation. They join its pool and can be picked for its squad."
      />
      <Panel title="Player details">
        <form onSubmit={submit} className="p-5 space-y-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm text-navy-200">
              First name <span className="text-navy-400">(optional)</span>
              <input className="input w-full mt-1" value={form.firstName} onChange={event => update("firstName", event.target.value)} />
            </label>
            <label className="block text-sm text-navy-200">
              Last name <span className="text-navy-400">(optional)</span>
              <input className="input w-full mt-1" value={form.lastName} onChange={event => update("lastName", event.target.value)} />
            </label>
            <label className="block text-sm text-navy-200">
              Position
              <select className="input w-full mt-1" value={form.position} onChange={event => update("position", event.target.value)} required>
                <option value="">Select position</option>
                {POSITION_ORDER.map(position => <option key={position} value={position}>{position}</option>)}
              </select>
            </label>
            <label className="block text-sm text-navy-200">
              Age
              <input className="input w-full mt-1" type="number" min={PLAYER_AGE_MIN} max={PLAYER_AGE_MAX} step="1" value={form.age} onChange={event => update("age", event.target.value)} required />
            </label>
            <label className="block text-sm text-navy-200">
              Overall
              <input className="input w-full mt-1" type="number" min={MIN_PLAYER_RATING} max={MAX_PLAYER_RATING} step="1" value={form.overall} onChange={event => update("overall", event.target.value)} required />
            </label>
            <label className="block text-sm text-navy-200">
              Potential
              <input className="input w-full mt-1" type="number" min={MIN_PLAYER_RATING} max={MAX_PLAYER_RATING} step="1" value={form.potential} onChange={event => update("potential", event.target.value)} required />
            </label>
            <label className="block text-sm text-navy-200">
              Nationality
              <div className="flex items-center gap-3 mt-1">
                <select aria-label="Primary nationality" className="input min-w-0 flex-1" value={form.primaryNationality} onChange={event => update("primaryNationality", event.target.value)} required>
                  <option value="">Select nationality</option>
                  {NATIONS.map(nation => <option key={nation.code} value={nation.code}>{nation.name}</option>)}
                </select>
                {form.primaryNationality && <NationTag code={form.primaryNationality} noLink label="code" />}
              </div>
            </label>
            <label className="block text-sm text-navy-200">
              Second nationality <span className="text-navy-400">(optional)</span>
              <select aria-label="Second nationality" className="input w-full mt-1" value={form.secondaryNationality} onChange={event => update("secondaryNationality", event.target.value)} disabled={!form.primaryNationality}>
                <option value="">None</option>
                {secondaryNations.map(nation => <option key={nation.code} value={nation.code}>{nation.name}</option>)}
              </select>
            </label>
          </div>

          {error && <p role="alert" className="text-sm text-accent-yellow border border-accent-yellow/40 rounded-md px-3 py-2">{error}</p>}
          <button type="submit" className="btn-primary">Add player</button>
        </form>
      </Panel>
    </div>
  );
}
