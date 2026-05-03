import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GameProps } from '@/types/game';
import { ArrowLeft } from 'lucide-react';
import { triviaQuestions, TriviaQuestion } from '@/data/triviaQuestions';

const Q_COUNT = 10;
const Q_TIME = 15;

const TriviaBattle = ({ isHost, peerState, onSendState, onLeaveGame, myName, peerName }: GameProps) => {
  const [qs, setQs] = useState<TriviaQuestion[]>([]);
  const [qi, setQi] = useState(0);
  const [myAns, setMyAns] = useState<number | null>(null);
  const [peerAns, setPeerAns] = useState<number | null>(null);
  const [scores, setScores] = useState({ me: 0, peer: 0 });
  const [phase, setPhase] = useState<'ready' | 'question' | 'result' | 'final'>('ready');
  const [timer, setTimer] = useState(Q_TIME);
  const sendRef = useRef(onSendState);
  useEffect(() => { sendRef.current = onSendState; }, [onSendState]);

  useEffect(() => {
    if (phase !== 'question') return;
    const iv = setInterval(() => setTimer(t => {
      if (t <= 1) { setPhase('result'); return 0; }
      return t - 1;
    }), 1000);
    return () => clearInterval(iv);
  }, [phase, qi]);

  useEffect(() => {
    if (myAns !== null && peerAns !== null && phase === 'question') setPhase('result');
  }, [myAns, peerAns, phase]);

  useEffect(() => {
    if (!peerState) return;
    if (peerState.t === 'start') { setQs(peerState.qs); setQi(0); setPhase('question'); setTimer(Q_TIME); setMyAns(null); setPeerAns(null); setScores({ me: 0, peer: 0 }); }
    if (peerState.t === 'answer') setPeerAns(peerState.a);
    if (peerState.t === 'next') { setQi(peerState.qi); setPhase('question'); setTimer(Q_TIME); setMyAns(null); setPeerAns(null); }
  }, [peerState]);

  const startGame = () => {
    const shuffled = [...triviaQuestions].sort(() => Math.random() - 0.5).slice(0, Q_COUNT);
    setQs(shuffled); setQi(0); setPhase('question'); setTimer(Q_TIME); setMyAns(null); setPeerAns(null); setScores({ me: 0, peer: 0 });
    sendRef.current({ t: 'start', qs: shuffled });
  };

  const answer = (a: number) => {
    if (myAns !== null) return;
    setMyAns(a);
    if (qs && qi >= 0 && qi < qs.length && a === qs[qi].correct) setScores(s => ({ ...s, me: s.me + 1 }));
    sendRef.current({ t: 'answer', a });
  };

  const nextQ = () => {
    const nqi = qi + 1;
    if (!qs || nqi >= qs.length) { setPhase('final'); return; }
    setQi(nqi); setPhase('question'); setTimer(Q_TIME); setMyAns(null); setPeerAns(null);
    sendRef.current({ t: 'next', qi: nqi });
  };

  const q = qs && qi >= 0 && qi < qs.length ? qs[qi] : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 gap-4">
      <div className="flex items-center gap-4 w-full max-w-md justify-between">
        <Button variant="ghost" size="sm" onClick={onLeaveGame}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <h2 className="text-xl font-bold">Trivia Battle</h2>
        <div className="flex items-center gap-2 text-sm"><span>{scores.me}</span><span className="text-muted-foreground">:</span><span>{scores.peer}</span></div>
      </div>

      {phase === 'ready' && (
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{Q_COUNT} questions, {Q_TIME}s each</p>
          {isHost ? <Button onClick={startGame}>Start Trivia</Button> : <p className="text-muted-foreground">Waiting for host to start...</p>}
        </div>
      )}

      {phase === 'question' && q && (
        <motion.div key={qi} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{q.category}</span>
            <span>Q{qi + 1}/{qs.length}</span>
            <span>⏱ {timer}s</span>
          </div>
          <p className="text-lg font-medium">{q.question}</p>
          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => answer(i)} disabled={myAns !== null}
                className={`text-left px-4 py-3 rounded-lg border border-border transition-all ${myAns === i ? 'bg-foreground text-primary-foreground' : 'bg-card hover:bg-accent'} disabled:cursor-default`}>
                {opt}
              </button>
            ))}
          </div>
          {myAns !== null && peerAns === null && <p className="text-sm text-muted-foreground text-center">Waiting for {peerName}...</p>}
        </motion.div>
      )}

      {phase === 'result' && q && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-md space-y-4 text-center">
          <p className="text-lg font-medium">{q.question}</p>
          <p className="text-sm">Correct: <strong>{q.options[q.correct]}</strong></p>
          <div className="flex justify-center gap-8 text-sm">
            <div><p className="text-muted-foreground">{myName}</p><p className={myAns === q.correct ? 'text-foreground font-bold' : 'text-muted-foreground'}>{myAns !== null ? q.options[myAns] : 'No answer'} {myAns === q.correct ? '✓' : '✗'}</p></div>
            <div><p className="text-muted-foreground">{peerName}</p><p className={peerAns === q.correct ? 'text-foreground font-bold' : 'text-muted-foreground'}>{peerAns !== null ? q.options[peerAns] : 'No answer'} {peerAns === q.correct ? '✓' : '✗'}</p></div>
          </div>
          {isHost && <Button onClick={nextQ}>{qi + 1 >= qs.length ? 'See Results' : 'Next Question'}</Button>}
          {!isHost && <p className="text-xs text-muted-foreground">Host advances to next question</p>}
        </motion.div>
      )}

      {phase === 'final' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <p className="text-2xl font-bold">{scores.me > scores.peer ? '🏆 You win!' : scores.me < scores.peer ? `${peerName} wins!` : "It's a tie!"}</p>
          <div className="flex justify-center gap-8">
            <div><p className="text-muted-foreground">{myName}</p><p className="text-3xl font-bold">{scores.me}</p></div>
            <div><p className="text-muted-foreground">{peerName}</p><p className="text-3xl font-bold">{scores.peer}</p></div>
          </div>
          {isHost && <Button onClick={startGame}>Play Again</Button>}
        </motion.div>
      )}
    </div>
  );
};

export default TriviaBattle;
