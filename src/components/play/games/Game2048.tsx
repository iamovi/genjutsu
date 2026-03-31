import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const SIZE = 4;

const createGrid = (): number[] => {
  const grid = Array(SIZE * SIZE).fill(0);
  addRandom(grid);
  addRandom(grid);
  return grid;
};

const addRandom = (grid: number[]): boolean => {
  const empty = grid.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0);
  if (empty.length === 0) return false;
  grid[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
  return true;
};

const slide = (row: number[]): number[] => {
  const filtered = row.filter(v => v !== 0);
  const result: number[] = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      result.push(filtered[i] * 2);
      i++;
    } else {
      result.push(filtered[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return result;
};

const moveGrid = (grid: number[], dir: 'up' | 'down' | 'left' | 'right'): { grid: number[]; moved: boolean; score: number } => {
  const g = [...grid];
  let moved = false;
  let score = 0;

  const getRow = (i: number, d: string): number[] => {
    if (d === 'left' || d === 'right') return Array.from({ length: SIZE }, (_, c) => g[i * SIZE + c]);
    return Array.from({ length: SIZE }, (_, r) => g[r * SIZE + i]);
  };
  const setRow = (i: number, d: string, row: number[]) => {
    for (let j = 0; j < SIZE; j++) {
      if (d === 'left' || d === 'right') g[i * SIZE + j] = row[j];
      else g[j * SIZE + i] = row[j];
    }
  };

    const count = dir === 'left' || dir === 'right' ? SIZE : SIZE;
    for (let i = 0; i < count; i++) {
      const row = getRow(i, dir);
      if (dir === 'right' || dir === 'down') row.reverse();
    const oldRow = [...row];
    const slid = slide(row);
    if (dir === 'right' || dir === 'down') slid.reverse();
    setRow(i, dir, slid);
    const orig = dir === 'right' || dir === 'down' ? [...oldRow].reverse() : oldRow;
    const final = dir === 'right' || dir === 'down' ? [...slid].reverse() : slid;
    if (orig.some((v, j) => v !== final[j])) moved = true;
    score += slid.reduce((a, b) => a + b, 0) - oldRow.reduce((a, b) => a + b, 0);
  }

  return { grid: g, moved, score: Math.max(0, score) };
};

const isGameOver = (grid: number[]): boolean => {
  if (grid.includes(0)) return false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r * SIZE + c];
      if (c + 1 < SIZE && grid[r * SIZE + c + 1] === v) return false;
      if (r + 1 < SIZE && grid[(r + 1) * SIZE + c] === v) return false;
    }
  }
  return true;
};

const getTileColor = (v: number): string => {
  if (v === 0) return 'bg-secondary';
  if (v <= 4) return 'bg-foreground/10 text-foreground';
  if (v <= 16) return 'bg-foreground/20 text-foreground';
  if (v <= 64) return 'bg-foreground/30 text-foreground';
  if (v <= 256) return 'bg-foreground/50 text-foreground';
  if (v <= 1024) return 'bg-foreground/70 text-background';
  return 'bg-foreground text-background';
};

const Game2048 = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [myGrid, setMyGrid] = useState(() => createGrid());
  const [myScore, setMyScore] = useState(0);
  const [peerScore, setPeerScore] = useState(0);
  const [myDone, setMyDone] = useState(false);
  const [peerDone, setPeerDone] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.type === 'score') {
      setPeerScore(peerState.score);
    } else if (peerState.type === 'done') {
      setPeerDone(true);
      setPeerScore(peerState.score);
    }
  }, [peerState]);

  useEffect(() => {
    if (myDone && peerDone) {
      setWinner(myScore > peerScore ? myName : myScore < peerScore ? peerName : 'draw');
    }
  }, [myDone, peerDone, myScore, peerScore, myName, peerName]);

  const handleMove = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (myDone) return;
    setMyGrid(prev => {
      const result = moveGrid(prev, dir);
      if (!result.moved) return prev;
      addRandom(result.grid);
      const newScore = myScore + result.score;
      setMyScore(newScore);
      onSendState({ type: 'score', score: newScore });
      if (isGameOver(result.grid)) {
        setMyDone(true);
        onSendState({ type: 'done', score: newScore });
      }
      return result.grid;
    });
  }, [myDone, myScore, onSendState]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
      };
      if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleMove]);

  // Touch support
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) handleMove(dx > 0 ? 'right' : 'left');
    else handleMove(dy > 0 ? 'down' : 'up');
    setTouchStart(null);
  };

  const resetGame = () => {
    setMyGrid(createGrid());
    setMyScore(0); setPeerScore(0);
    setMyDone(false); setPeerDone(false);
    setWinner(null);
    onSendState({ type: 'reset' });
  };

  useEffect(() => {
    if (peerState?.type === 'reset') {
      setMyGrid(createGrid());
      setMyScore(0); setPeerScore(0);
      setMyDone(false); setPeerDone(false);
      setWinner(null);
    }
  }, [peerState]);

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-sm justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">2048 Battle</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <div className="flex items-center gap-8 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">{myName}</p>
          <p className="text-2xl font-bold font-mono">{myScore}</p>
          {myDone && <p className="text-[10px] text-muted-foreground">Done</p>}
        </div>
        <span className="text-muted-foreground text-xl">vs</span>
        <div className="text-center">
          <p className="text-muted-foreground">{peerName}</p>
          <p className="text-2xl font-bold font-mono">{peerScore}</p>
          {peerDone && <p className="text-[10px] text-muted-foreground">Done</p>}
        </div>
      </div>

      {winner && (
        <p className="text-sm font-medium">
          {winner === 'draw' ? "It's a tie!" : winner === myName ? 'You win! 🎉' : `${peerName} wins!`}
        </p>
      )}

      <div
        className="grid grid-cols-4 gap-2 p-3 bg-card rounded-xl border border-border"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {myGrid.map((v, i) => (
          <motion.div
            key={i}
            animate={{ scale: v ? 1 : 0.8 }}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-lg flex items-center justify-center font-bold text-lg font-mono ${getTileColor(v)}`}
          >
            {v > 0 ? v : ''}
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Use arrow keys or swipe to play</p>

      {winner && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default Game2048;
