import { useCallback, useEffect, useRef, useState } from "react";
import { useClientConfig } from "../../config/ClientConfigContext";
import { quizApi } from "../../api/quizApi";
import { ApiError } from "../../api/client";
import { useBlockBackNavigation } from "../../hooks/useBlockBackNavigation";
import { useQuestionTimer } from "../../hooks/useQuestionTimer";
import CountdownBar from "../../components/CountdownBar";
import type { AnswerOutcome, AttemptResult, QuestionForClient } from "../../../../shared/types";

type Phase = "answering" | "feedback" | "advancing";

export default function QuizScreen({
  attemptId,
  initialQuestion,
  onFinished,
  onFatalError,
}: {
  attemptId: string;
  initialQuestion: QuestionForClient;
  onFinished: (result: AttemptResult) => void;
  onFatalError: (message: string) => void;
}): JSX.Element {
  const cfg = useClientConfig();
  const [question, setQuestion] = useState(initialQuestion);
  const [phase, setPhase] = useState<Phase>("answering");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const submittingRef = useRef(false);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBlockBackNavigation(true);

  const submit = useCallback(
    async (chosenOption: number | null, clientElapsedMs: number) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSelectedIndex(chosenOption);
      try {
        const result = await quizApi.submitAnswer(attemptId, {
          position: question.position,
          questionId: question.questionId,
          chosenOption,
          clientElapsedMs: Math.round(clientElapsedMs),
        });
        setOutcome(result);
        setPhase("feedback");
        dwellTimerRef.current = setTimeout(() => advance(result), cfg.quiz.feedbackDwellMs);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Connection lost. Please try again.";
        onFatalError(message);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [attemptId, question, cfg.quiz.feedbackDwellMs]
  );

  const timer = useQuestionTimer(cfg.quiz.questionTimeLimitMs, question.remainingMs, question.questionId, () => {
    if (phase === "answering") {
      void submit(null, timer.limitMs);
    }
  });

  async function advance(result: AnswerOutcome) {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    setPhase("advancing");
    if (result.isLastQuestion && result.result) {
      onFinished(result.result);
      return;
    }
    try {
      const next = await quizApi.getQuestion(attemptId);
      setQuestion(next);
      setOutcome(null);
      setSelectedIndex(null);
      submittingRef.current = false;
      setPhase("answering");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Connection lost. Please try again.";
      onFatalError(message);
    }
  }

  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, []);

  function handleOptionClick(index: number) {
    if (phase !== "answering") return;
    void submit(index, timer.getElapsedMs());
  }

  function handleNextClick() {
    if (!outcome) return;
    advance(outcome);
  }

  const locked = phase !== "answering";

  return (
    <div className="screen">
      <div className="quiz-header-row">
        <span>
          Question {question.position + 1} of {question.totalQuestions}
        </span>
        <span className="quiz-score">Score: {question.scoreSoFar}</span>
      </div>

      <CountdownBar remainingMs={timer.remainingMs} limitMs={timer.limitMs} />

      <div className="question-category">{question.type === "scenario" ? "Scenario" : "Knowledge"}</div>
      <h2 className="question-prompt">{question.prompt}</h2>

      <div className="options-list" role="group" aria-label="Answer options">
        {question.options.map((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          let className = "option-btn";
          if (locked && outcome) {
            if (idx === outcome.correctOptionDisplayIndex) className += " correct";
            else if (idx === selectedIndex) className += " incorrect chosen-wrong";
          }
          return (
            <button
              key={idx}
              type="button"
              className={className}
              disabled={locked}
              onClick={() => handleOptionClick(idx)}
              aria-pressed={selectedIndex === idx}
            >
              <span className="option-letter">{letter}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {outcome && (
        <div className="feedback-panel" role="status">
          <div className={`feedback-headline ${outcome.correct ? "correct" : "incorrect"}`}>
            {outcome.correct ? (
              <>
                <span aria-hidden="true">✓</span> Correct
              </>
            ) : (
              <>
                <span aria-hidden="true">✕</span> Incorrect
              </>
            )}
          </div>
          <div className="feedback-points">+{outcome.pointsEarned} points</div>
          <p className="feedback-explanation">{outcome.explanation}</p>
          <button className="btn btn-secondary" onClick={handleNextClick}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
