import { create } from "zustand";
import {
  createGame, finishSeason, initializeGoalDisplayMinutes as initializeGoalDisplayMinutesAction,
  simulateNextMatchday, simulateRestOfWindow, simulateWindows, toggleShortlist
} from "../engine/game";
import type { ActionResult, Game } from "../engine/game";
import {
  addPlayer, clearRiggedMatch, resetNationFormation, rigMatch, setGodMode, setNationFormation, setNationYouthRating,
  setPlayerRatings
} from "../engine/godMode";
import type { AddPlayerInput, SquadTeam } from "../engine/godMode";
import type { InternationalMatch } from "../engine/international/types";
import { gameFromSave, gameToSave, saveFileName, verifySave } from "../engine/save/saveFile";
import type { SaveFile } from "../engine/save/saveFile";

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
  link?: { to: string; label: string };
}

interface GameStore {
  game: Game | null;
  /** Bumped whenever a different game is started/loaded so every page remounts fresh. */
  gameId: number;
  /** Bumped after every mutation so subscribed components re-render. */
  tick: number;
  toasts: Toast[];

  startGame: () => void;
  notify: (kind: Toast["kind"], text: string) => void;
  /** Builds and verifies a save. Returns null (and raises an error toast) if it cannot be saved losslessly. */
  exportSave: () => { filename: string; json: string } | null;
  /** Replaces the current game with a parsed save file. Returns an error message, or null on success. */
  loadSave: (file: SaveFile) => string | null;
  dismissToast: (id: number) => void;

  /** Plays the next matchday of the open window. */
  playMatchday: () => void;
  /** Plays the rest of the open window. */
  playWindow: () => void;
  /** Plays several whole windows. */
  playWindows: (count: number) => void;
  /** Plays windows until the end of the current season. */
  finishSeason: () => void;
  /** Adds/removes a player from the shortlist (silent). */
  toggleShortlist: (playerId: string) => void;
  /** Stores random stoppage-time labels for a match's goals on first open. */
  initializeGoalDisplayMinutes: (matches: InternationalMatch[]) => void;

  /** God Mode. */
  setGodMode: (enabled: boolean) => void;
  godSetYouthRating: (code: string, rating: number) => ActionResult;
  godAddPlayer: (input: AddPlayerInput) => ActionResult;
  godSetFormation: (code: string, formation: string, team: SquadTeam) => ActionResult;
  godResetFormation: (code: string, team: SquadTeam) => ActionResult;
  godSetPlayerRatings: (playerId: string, overall: number, potential: number) => ActionResult;
  /** Forces the result of an unplayed match. */
  godRigMatch: (match: InternationalMatch, homeGoals: number, awayGoals: number) => ActionResult;
  godClearRig: (match: InternationalMatch) => ActionResult;
}

let toastId = 1;

export const useGameStore = create<GameStore>()((set, get) => {
  const pushToast = (kind: Toast["kind"], text: string, link?: Toast["link"]) => {
    const toast: Toast = { id: toastId++, kind, text, link };
    set(state => ({ toasts: [...state.toasts.slice(-3), toast] }));
  };

  /** Runs a mutation, refreshes subscribers and surfaces the result as a toast. */
  const act = (fn: (game: Game) => ActionResult, quiet = false): ActionResult => {
    const game = get().game;
    if (!game) return { ok: false, error: "No game in progress." };
    const result = fn(game);
    game.version++;
    if (result.ok && result.message && !quiet) pushToast("success", result.message, result.link);
    if (!result.ok && result.error) pushToast("error", result.error);
    set(state => ({ tick: state.tick + 1 }));
    return result;
  };

  return {
    game: null,
    gameId: 0,
    tick: 0,
    toasts: [],

    startGame: () => {
      const game = createGame();
      set(state => ({ game, gameId: state.gameId + 1, tick: 0, toasts: [] }));
    },
    notify: (kind, text) => pushToast(kind, text),
    exportSave: () => {
      const game = get().game;
      if (!game) return null;
      try {
        const file = gameToSave(game);
        // Prove the save is lossless before letting the user download it.
        const problem = verifySave(game, file);
        if (problem) {
          pushToast("error", `Save cancelled: the saved copy did not match the live game (${problem}). Nothing was written.`);
          return null;
        }
        return { filename: saveFileName(game), json: JSON.stringify(file) };
      } catch (error) {
        pushToast("error", `Save cancelled: ${(error as Error).message}`);
        return null;
      }
    },
    loadSave: file => {
      try {
        const game = gameFromSave(file);
        set(state => ({ game, gameId: state.gameId + 1, tick: state.tick + 1, toasts: [] }));
        pushToast("success", `Loaded season ${file.meta.season}${file.meta.window ? ` — ${file.meta.window}` : ""}.`);
        return null;
      } catch (error) {
        return (error as Error).message;
      }
    },
    dismissToast: id => set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) })),

    playMatchday: () => { act(simulateNextMatchday); },
    playWindow: () => { act(simulateRestOfWindow); },
    playWindows: count => { act(game => simulateWindows(game, count)); },
    finishSeason: () => { act(finishSeason); },
    toggleShortlist: playerId => { act(game => toggleShortlist(game, playerId), true); },
    initializeGoalDisplayMinutes: matches => {
      const needsInitialization = matches.some(match =>
        match.goals?.some(goal => goal.displayMinute === undefined && [45, 90, 105, 120].includes(goal.minute))
      );
      if (needsInitialization) act(game => initializeGoalDisplayMinutesAction(game, matches), true);
    },

    setGodMode: enabled => { act(game => setGodMode(game, enabled), true); },
    godSetYouthRating: (code, rating) => act(game => setNationYouthRating(game, code, rating), true),
    godAddPlayer: input => act(game => addPlayer(game, input)),
    godSetFormation: (code, formation, team) => act(game => setNationFormation(game, code, formation, team), true),
    godResetFormation: (code, team) => act(game => resetNationFormation(game, code, team), true),
    godSetPlayerRatings: (playerId, overall, potential) => act(game => setPlayerRatings(game, playerId, overall, potential)),
    godRigMatch: (match, homeGoals, awayGoals) => act(game => rigMatch(game, match, homeGoals, awayGoals), true),
    godClearRig: match => act(game => clearRiggedMatch(game, match), true)
  };
});

/** Returns the live game and subscribes the caller to every state change. */
export function useGame(): Game {
  useGameStore(state => state.tick);
  const game = useGameStore.getState().game;
  if (!game) throw new Error("No game in progress.");
  return game;
}
