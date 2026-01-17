// Types for the Pokemon Battle API

export interface CreateBattleRequest {
  seed?: number;
}

export interface ChoiceRequest {
  choice: string;
}

// Responses from Rust battle_runner

export interface RustCreateResponse {
  ok: boolean;
  battle_id: string;
  turn: number;
  log: string[];
  request: BattleRequest | null;
  ended: boolean;
  winner: string | null;
}

export interface RustChoiceResponse {
  ok: boolean;
  turn: number;
  log: string[];
  request: BattleRequest | null;
  ended: boolean;
  winner: string | null;
  error?: string;
}

export interface RustStateResponse {
  ok: boolean;
  turn: number;
  started: boolean;
  ended: boolean;
  winner: string | null;
  p1_pokemon: PokemonSummary[];
  p2_pokemon: PokemonSummary[];
}

export interface RustErrorResponse {
  ok: false;
  error: string;
}

export type RustResponse =
  | RustCreateResponse
  | RustChoiceResponse
  | RustStateResponse
  | RustErrorResponse;

// Pokemon Showdown protocol types

export interface BattleRequest {
  teamPreview?: boolean;
  forceSwitch?: boolean[];
  active?: ActivePokemon[];
  side?: SideInfo;
  wait?: boolean;
  noCancel?: boolean;
}

export interface ActivePokemon {
  moves: MoveSlot[];
  canDynamax?: boolean;
  canTerastallize?: string;
  trapped?: boolean;
  maybeTrapped?: boolean;
  canMegaEvo?: boolean;
}

export interface MoveSlot {
  move: string;
  id: string;
  pp: number;
  maxpp: number;
  target: string;
  disabled?: boolean;
}

export interface SideInfo {
  name: string;
  id: string;
  pokemon: SidePokemon[];
}

export interface SidePokemon {
  ident: string;
  details: string;
  condition: string;
  active: boolean;
  stats: {
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  };
  moves: string[];
  baseAbility: string;
  item: string;
  pokeball: string;
  ability?: string;
}

export interface PokemonSummary {
  name: string;
  species: string;
  hp: number;
  max_hp: number;
  fainted: boolean;
  active: boolean;
}

// API response types

export interface BattleResponse {
  battleId: string;
  turn: number;
  log: string[];
  request: BattleRequest | null;
  ended: boolean;
  winner: string | null;
}

export interface BattleStateResponse {
  battleId: string;
  turn: number;
  started: boolean;
  ended: boolean;
  winner: string | null;
  player: {
    pokemon: PokemonSummary[];
  };
  opponent: {
    pokemon: PokemonSummary[];
  };
}

export interface ErrorResponse {
  error: string;
}
