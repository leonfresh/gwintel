"use client";

import Link from "next/link";
import React, { useCallback, useMemo, useState } from "react";
import type { Hero, HeroTier } from "../../../types";
import { HERO_DATABASE } from "../../../constants";
import HeroAvatar from "../../../components/HeroAvatar";

type Owner = "player" | "ai";

type CardSides = {
  n: number;
  e: number;
  s: number;
  w: number;
};

type Card = {
  hero: Hero;
  sides: CardSides;
};

type BoardCell = {
  owner: Owner;
  card: Card;
} | null;

const tierBase: Record<HeroTier, number> = {
  SSS: 9,
  SS: 8,
  "S+": 7,
  S: 6,
  "A+": 5,
  A: 4,
  B: 3,
  C: 2,
  D: 1,
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function xfnv1a(str: string) {
  // Fast-ish deterministic hash for a seed.
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function heroToCard(hero: Hero): Card {
  const base = tierBase[hero.tier];
  const rand = mulberry32(xfnv1a(`tt::${hero.id}::${hero.tier}`));

  // Make stronger tiers trend higher, with small per-hero deterministic variance.
  const roll = () => {
    // Bias high tiers slightly upward.
    const spread = 2; // +/- range
    const offset = Math.floor(rand() * (spread * 2 + 1) - spread);
    const bias = base >= 8 ? 1 : base <= 3 ? -1 : 0;
    return clampInt(base + offset + bias, 1, 9);
  };

  // Keep cards from being too flat by ensuring at least one strong and one weak side.
  const sides: CardSides = { n: roll(), e: roll(), s: roll(), w: roll() };
  const values = [sides.n, sides.e, sides.s, sides.w];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) {
    sides.n = clampInt(sides.n + 1, 1, 9);
    sides.s = clampInt(sides.s - 1, 1, 9);
  }

  return { hero, sides };
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function idxToRC(idx: number) {
  return { r: Math.floor(idx / 3), c: idx % 3 };
}

function rcToIdx(r: number, c: number) {
  return r * 3 + c;
}

function neighbors(idx: number) {
  const { r, c } = idxToRC(idx);
  const out: Array<{ dir: "n" | "e" | "s" | "w"; idx: number }> = [];
  if (r > 0) out.push({ dir: "n", idx: rcToIdx(r - 1, c) });
  if (c < 2) out.push({ dir: "e", idx: rcToIdx(r, c + 1) });
  if (r < 2) out.push({ dir: "s", idx: rcToIdx(r + 1, c) });
  if (c > 0) out.push({ dir: "w", idx: rcToIdx(r, c - 1) });
  return out;
}

function opposite(dir: "n" | "e" | "s" | "w"): "n" | "e" | "s" | "w" {
  if (dir === "n") return "s";
  if (dir === "s") return "n";
  if (dir === "e") return "w";
  return "e";
}

function resolveFlips(
  board: BoardCell[],
  placedIdx: number
): { board: BoardCell[]; flips: number } {
  const placed = board[placedIdx];
  if (!placed) return { board, flips: 0 };

  const next = [...board];
  let flips = 0;

  for (const n of neighbors(placedIdx)) {
    const neighborCell = next[n.idx];
    if (!neighborCell) continue;
    if (neighborCell.owner === placed.owner) continue;

    const a = placed.card.sides[n.dir];
    const b = neighborCell.card.sides[opposite(n.dir)];
    if (a > b) {
      next[n.idx] = { ...neighborCell, owner: placed.owner };
      flips++;
    }
  }

  return { board: next, flips };
}

function score(board: BoardCell[]) {
  let player = 0;
  let ai = 0;
  for (const cell of board) {
    if (!cell) continue;
    if (cell.owner === "player") player++;
    else ai++;
  }
  return { player, ai };
}

function cardFrame(owner: Owner) {
  return owner === "player" ? "border-emerald-500/30" : "border-rose-500/30";
}

function ownerLabel(owner: Owner) {
  return owner === "player" ? "You" : "AI";
}

function SideNumber({
  value,
  className,
}: {
  value: number;
  className: string;
}) {
  return (
    <div
      className={`absolute ${className} w-6 h-6 rounded-md bg-slate-950/60 glass border border-white/10 text-xs font-black text-white flex items-center justify-center`}
    >
      {value}
    </div>
  );
}

function CardView({ card, owner }: { card: Card; owner: Owner }) {
  return (
    <div
      className={`relative w-full h-full rounded-2xl bg-slate-950/30 glass border ${cardFrame(
        owner
      )} overflow-hidden`}
    >
      <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-white/5 via-transparent to-transparent" />

      <div className="absolute inset-3 flex items-center gap-3">
        <HeroAvatar hero={card.hero} size="md" showTier />
        <div className="min-w-0">
          <div className="text-sm font-black text-white truncate">
            {card.hero.name}
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold">
            {ownerLabel(owner)}
          </div>
        </div>
      </div>

      <SideNumber
        value={card.sides.n}
        className="top-2 left-1/2 -translate-x-1/2"
      />
      <SideNumber
        value={card.sides.e}
        className="right-2 top-1/2 -translate-y-1/2"
      />
      <SideNumber
        value={card.sides.s}
        className="bottom-2 left-1/2 -translate-x-1/2"
      />
      <SideNumber
        value={card.sides.w}
        className="left-2 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}

function pickInitialHands(): { player: Card[]; ai: Card[] } {
  const pool = HERO_DATABASE.slice();
  shuffleInPlace(pool);
  const picked = pool.slice(0, 10).map(heroToCard);
  return {
    player: picked.slice(0, 5),
    ai: picked.slice(5, 10),
  };
}

function bestAiMove(board: BoardCell[], aiHand: Card[]) {
  const emptyIdxs = board
    .map((cell, idx) => ({ cell, idx }))
    .filter((x) => x.cell === null)
    .map((x) => x.idx);

  let best: { cardIndex: number; idx: number; score: number } | null = null;

  for (let cardIndex = 0; cardIndex < aiHand.length; cardIndex++) {
    const card = aiHand[cardIndex];

    for (const idx of emptyIdxs) {
      const draft = [...board];
      draft[idx] = { owner: "ai", card };
      const { board: after, flips } = resolveFlips(draft, idx);
      const s = score(after);

      // Risk heuristic: how many adjacent enemy cards can immediately flip us back.
      let risk = 0;
      for (const n of neighbors(idx)) {
        const neighborCell = after[n.idx];
        if (!neighborCell) continue;
        if (neighborCell.owner !== "player") continue;
        // If player's opposing side beats our side, we are vulnerable on that edge.
        const playerEdge = neighborCell.card.sides[opposite(n.dir)];
        const ourEdge = card.sides[n.dir];
        if (playerEdge > ourEdge) risk++;
      }

      const moveScore = flips * 10 + (s.ai - s.player) * 3 - risk * 2;

      if (!best || moveScore > best.score) {
        best = { cardIndex, idx, score: moveScore };
      }
    }
  }

  return best;
}

export default function TripleTriadClient() {
  const [{ player: initialPlayer, ai: initialAi }, setInitial] = useState(() =>
    pickInitialHands()
  );

  const [board, setBoard] = useState<BoardCell[]>(() => Array(9).fill(null));
  const [playerHand, setPlayerHand] = useState<Card[]>(() => initialPlayer);
  const [aiHand, setAiHand] = useState<Card[]>(() => initialAi);
  const [turn, setTurn] = useState<Owner>("player");
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string>(
    "Pick a card, then place it on the board."
  );

  const { player: playerScore, ai: aiScore } = useMemo(
    () => score(board),
    [board]
  );

  const gameOver = useMemo(() => {
    const filled = board.every((c) => c !== null);
    return filled || (playerHand.length === 0 && aiHand.length === 0);
  }, [board, playerHand.length, aiHand.length]);

  const winnerText = useMemo(() => {
    if (!gameOver) return null;
    if (playerScore > aiScore) return "You win!";
    if (aiScore > playerScore) return "AI wins!";
    return "It’s a draw!";
  }, [gameOver, playerScore, aiScore]);

  const reset = useCallback(() => {
    const next = pickInitialHands();
    setInitial(next);
    setBoard(Array(9).fill(null));
    setPlayerHand(next.player);
    setAiHand(next.ai);
    setTurn("player");
    setSelectedHeroId(null);
    setLastMove("New match! Pick a card, then place it on the board.");
  }, []);

  const placeFor = useCallback((owner: Owner, card: Card, idx: number) => {
    setBoard((prev) => {
      if (prev[idx] !== null) return prev;
      const draft = [...prev];
      draft[idx] = { owner, card };
      const resolved = resolveFlips(draft, idx);
      return resolved.board;
    });
  }, []);

  const onPlace = useCallback(
    (idx: number) => {
      if (gameOver) return;
      if (turn !== "player") return;
      if (board[idx] !== null) return;
      if (!selectedHeroId) {
        setLastMove("Select a card from your hand first.");
        return;
      }

      const cardIndex = playerHand.findIndex(
        (c) => c.hero.id === selectedHeroId
      );
      if (cardIndex < 0) {
        setLastMove("That card is no longer in your hand.");
        setSelectedHeroId(null);
        return;
      }

      const card = playerHand[cardIndex];
      setPlayerHand((prev) => prev.filter((c) => c.hero.id !== selectedHeroId));
      setSelectedHeroId(null);

      // Place player card + resolve.
      setBoard((prev) => {
        const draft = [...prev];
        draft[idx] = { owner: "player", card };
        const { board: resolved, flips } = resolveFlips(draft, idx);
        setLastMove(flips > 0 ? `You flipped ${flips}!` : "No flips.");
        return resolved;
      });

      setTurn("ai");
    },
    [gameOver, turn, board, selectedHeroId, playerHand]
  );

  // AI turn effect.
  React.useEffect(() => {
    if (gameOver) return;
    if (turn !== "ai") return;
    if (aiHand.length === 0) {
      setTurn("player");
      return;
    }

    const timer = window.setTimeout(() => {
      const move = bestAiMove(board, aiHand);
      if (!move) {
        setTurn("player");
        return;
      }

      const card = aiHand[move.cardIndex];
      setAiHand((prev) => prev.filter((_, i) => i !== move.cardIndex));

      setBoard((prev) => {
        const draft = [...prev];
        draft[move.idx] = { owner: "ai", card };
        const { board: resolved, flips } = resolveFlips(draft, move.idx);
        setLastMove(
          flips > 0 ? `AI flipped ${flips}.` : "AI played. No flips."
        );
        return resolved;
      });

      setTurn("player");
    }, 450);

    return () => window.clearTimeout(timer);
  }, [turn, aiHand, board, gameOver]);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400 font-black">
              Minigame
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              Triple Triad (Heroes Edition)
            </h1>
            <div className="text-sm text-slate-300 mt-2">
              Place a hero card to flip adjacent weaker sides. Tiers influence
              power.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
            >
              Back
            </Link>
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl bg-slate-950/30 glass border border-white/10 text-slate-200 hover:text-white hover:bg-slate-950/40 transition"
            >
              New Match
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Hand */}
          <div className="bg-slate-950/20 glass p-5 rounded-[1.5rem] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-emerald-300 uppercase tracking-wider">
                Your Hand
              </div>
              <div className="text-xs text-slate-400 font-bold">
                Turn: {turn === "player" ? "You" : "AI"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {playerHand.map((card) => {
                const selected = selectedHeroId === card.hero.id;
                return (
                  <button
                    key={card.hero.id}
                    onClick={() => {
                      if (turn !== "player" || gameOver) return;
                      setSelectedHeroId(card.hero.id);
                      setLastMove("Now pick a board tile.");
                    }}
                    className={`text-left h-28 rounded-2xl border transition overflow-hidden bg-slate-950/20 glass ${
                      selected
                        ? "border-emerald-400/60 ring-2 ring-emerald-400/20"
                        : "border-white/10 hover:border-white/20"
                    } ${
                      turn !== "player" || gameOver
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <CardView card={card} owner="player" />
                  </button>
                );
              })}
              {playerHand.length === 0 ? (
                <div className="text-sm text-slate-400">No cards left.</div>
              ) : null}
            </div>
          </div>

          {/* Board */}
          <div className="bg-slate-950/20 glass p-5 rounded-[1.5rem] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-blue-300 uppercase tracking-wider">
                Board
              </div>
              <div className="text-xs text-slate-400 font-bold">
                Score: You {playerScore} · AI {aiScore}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {board.map((cell, idx) => {
                const isEmpty = cell === null;
                return (
                  <button
                    key={idx}
                    onClick={() => onPlace(idx)}
                    className={`relative aspect-square rounded-2xl border overflow-hidden bg-slate-950/15 glass transition ${
                      isEmpty
                        ? "border-white/10 hover:border-white/20"
                        : "border-white/10"
                    } ${
                      isEmpty && turn === "player" && !gameOver
                        ? ""
                        : isEmpty
                        ? "opacity-80"
                        : ""
                    }`}
                    aria-label={
                      isEmpty
                        ? "Empty tile"
                        : `${ownerLabel(cell.owner)}: ${cell.card.hero.name}`
                    }
                    disabled={!isEmpty || turn !== "player" || gameOver}
                  >
                    {cell ? (
                      <CardView card={cell.card} owner={cell.owner} />
                    ) : null}
                    {isEmpty ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-black uppercase tracking-[0.35em]">
                        Place
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 bg-slate-950/20 glass border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200">
              {winnerText ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-white">{winnerText}</div>
                  <div className="text-xs text-slate-400 font-bold">
                    Final: You {playerScore} · AI {aiScore}
                  </div>
                </div>
              ) : (
                <div>{lastMove}</div>
              )}
            </div>
          </div>

          {/* AI Hand (hidden cards) */}
          <div className="bg-slate-950/20 glass p-5 rounded-[1.5rem] border border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm font-black text-rose-300 uppercase tracking-wider">
                AI Hand
              </div>
              <div className="text-xs text-slate-400 font-bold">
                {aiHand.length} cards
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              {aiHand.map((card) => (
                <div
                  key={card.hero.id}
                  className="h-28 rounded-2xl border border-white/10 bg-slate-950/20 glass overflow-hidden opacity-80"
                >
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="text-xs text-slate-500 font-black uppercase tracking-[0.35em]">
                      Hidden
                    </div>
                  </div>
                </div>
              ))}
              {aiHand.length === 0 ? (
                <div className="text-sm text-slate-400">No cards left.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-400">
          Rule summary: when you place a card, any adjacent opponent card flips
          if your touching side value is higher.
        </div>
      </div>
    </div>
  );
}
