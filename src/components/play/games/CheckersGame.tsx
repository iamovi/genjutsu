import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft, RotateCcw } from 'lucide-react';

type Piece = 0 | 1 | 2; // 0=empty, 1=host(dark), 2=peer(light)
type KingMap = boolean[];

const BOARD_SIZE = 8;

const initBoard = (): { pieces: Piece[]; kings: KingMap } => {
  const pieces: Piece[] = Array(64).fill(0);
  const kings: KingMap = Array(64).fill(false);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) pieces[r * 8 + c] = 2;
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) pieces[r * 8 + c] = 1;
    }
  }
  return { pieces, kings };
};

const getValidMoves = (index: number, pieces: Piece[], kings: KingMap, player: Piece): { to: number; captured?: number }[] => {
  const r = Math.floor(index / 8), c = index % 8;
  const moves: { to: number; captured?: number }[] = [];
  const dirs: number[][] = [];

  if (player === 1 || (kings && kings[index])) dirs.push([-1, -1], [-1, 1]);
  if (player === 2 || (kings && kings[index])) dirs.push([1, -1], [1, 1]);

  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
    const ni = nr * 8 + nc;
    if (pieces[ni] === 0) {
      moves.push({ to: ni });
    } else if (pieces[ni] !== player) {
      const jr = nr + dr, jc = nc + dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && pieces[jr * 8 + jc] === 0) {
        moves.push({ to: jr * 8 + jc, captured: ni });
      }
    }
  }
  return moves;
};

const hasCaptures = (pieces: Piece[], kings: KingMap, player: Piece): boolean => {
  for (let i = 0; i < 64; i++) {
    if (pieces[i] === player) {
      if (getValidMoves(i, pieces, kings, player).some(m => m.captured !== undefined)) return true;
    }
  }
  return false;
};

const CheckersGame = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const myPiece: Piece = isHost ? 1 : 2;
  const peerPiece: Piece = isHost ? 2 : 1;
  const [pieces, setPieces] = useState<Piece[]>(() => initBoard().pieces);
  const [kings, setKings] = useState<KingMap>(() => initBoard().kings);
  const [currentPlayer, setCurrentPlayer] = useState<Piece>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [validMoves, setValidMoves] = useState<{ to: number; captured?: number }[]>([]);
  const [scores, setScores] = useState({ 1: 0, 2: 0 });
  const [winner, setWinner] = useState<Piece | null>(null);

  useEffect(() => {
    if (peerState) {
      setPieces(peerState.pieces);
      setKings(peerState.kings);
      setCurrentPlayer(peerState.currentPlayer);
      if (peerState.scores) setScores(peerState.scores);
      if (peerState.winner !== undefined) setWinner(peerState.winner);
      setSelected(null);
      setValidMoves([]);
    }
  }, [peerState]);

  const isMyTurn = !winner && currentPlayer === myPiece;

  const checkWinner = useCallback((p: Piece[], k: KingMap, next: Piece): Piece | null => {
    const count1 = p.filter(x => x === 1).length;
    const count2 = p.filter(x => x === 2).length;
    if (count1 === 0) return 2;
    if (count2 === 0) return 1;
    // Check if next player has any moves
    let hasMoves = false;
    for (let i = 0; i < 64; i++) {
      if (p[i] === next && getValidMoves(i, p, k, next).length > 0) { hasMoves = true; break; }
    }
    if (!hasMoves) return next === 1 ? 2 : 1;
    return null;
  }, []);

  const handleClick = (index: number) => {
    if (!isMyTurn || winner) return;

    if (selected !== null) {
      const move = validMoves.find(m => m.to === index);
      if (move) {
        const newPieces = [...pieces];
        const newKings = [...kings];
        newPieces[index] = myPiece;
        newPieces[selected] = 0;
        newKings[index] = kings[selected];
        newKings[selected] = false;
        if (move.captured !== undefined) {
          newPieces[move.captured] = 0;
          newKings[move.captured] = false;
        }
        // King promotion
        if ((myPiece === 1 && Math.floor(index / 8) === 0) || (myPiece === 2 && Math.floor(index / 8) === 7)) {
          newKings[index] = true;
        }
        // Multi-jump
        if (move.captured !== undefined) {
          const furtherCaptures = getValidMoves(index, newPieces, newKings, myPiece).filter(m => m.captured !== undefined);
          if (furtherCaptures.length > 0) {
            setPieces(newPieces); setKings(newKings);
            setSelected(index); setValidMoves(furtherCaptures);
            return;
          }
        }
        const nextPlayer: Piece = myPiece === 1 ? 2 : 1;
        const w = checkWinner(newPieces, newKings, nextPlayer);
        const newScores = w ? { ...scores, [w]: scores[w] + 1 } : scores;

        setPieces(newPieces); setKings(newKings); setCurrentPlayer(nextPlayer);
        setSelected(null); setValidMoves([]);
        if (w) { setWinner(w); setScores(newScores); }

        onSendState({ pieces: newPieces, kings: newKings, currentPlayer: nextPlayer, scores: newScores, winner: w });
        return;
      }
    }

    if (pieces[index] === myPiece) {
      let moves = getValidMoves(index, pieces, kings, myPiece);
      const mustCapture = hasCaptures(pieces, kings, myPiece);
      if (mustCapture) moves = moves.filter(m => m.captured !== undefined);
      setSelected(index);
      setValidMoves(moves);
    } else {
      setSelected(null);
      setValidMoves([]);
    }
  };

  const resetGame = () => {
    const init = initBoard();
    setPieces(init.pieces); setKings(init.kings); setCurrentPlayer(1);
    setSelected(null); setValidMoves([]); setWinner(null);
    onSendState({ pieces: init.pieces, kings: init.kings, currentPlayer: 1, scores, winner: null });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-sm justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Checkers</h2>
        <Button variant="ghost" size="sm" onClick={resetGame}><RotateCcw className="h-4 w-4" /></Button>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <p className="text-muted-foreground">{myName}</p>
          <p className="text-2xl font-bold">{scores[myPiece]}</p>
        </div>
        <span className="text-muted-foreground text-xl">:</span>
        <div className="text-center">
          <p className="text-muted-foreground">{peerName}</p>
          <p className="text-2xl font-bold">{scores[peerPiece]}</p>
        </div>
      </div>

      <p className={`text-sm font-medium ${isMyTurn ? 'text-foreground' : 'text-muted-foreground'}`}>
        {winner === myPiece ? 'You win! 🎉' : winner ? `${peerName} wins!` : isMyTurn ? 'Your turn' : `${peerName}'s turn`}
      </p>

      <div className="grid grid-cols-8 gap-0 border border-border rounded-lg overflow-hidden">
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const isDark = (r + c) % 2 === 1;
          const isSelected = selected === i;
          const isValidTarget = validMoves.some(m => m.to === i);
          const piece = pieces[i];
          const isKing = kings[i];

          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center relative transition-colors ${
                isDark ? 'bg-secondary' : 'bg-card'
              } ${isSelected ? 'ring-2 ring-foreground ring-inset' : ''} ${isValidTarget ? 'bg-accent' : ''}`}
            >
              {piece !== 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 ${
                    piece === 1 ? 'bg-foreground border-foreground' : 'bg-muted-foreground border-muted-foreground'
                  } ${isKing ? 'ring-2 ring-background ring-offset-1' : ''}`}
                />
              )}
              {isValidTarget && piece === 0 && (
                <div className="w-2 h-2 rounded-full bg-foreground/30" />
              )}
            </button>
          );
        })}
      </div>

      {winner && <Button onClick={resetGame}>Play Again</Button>}
    </div>
  );
};

export default CheckersGame;
