import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useClientConfig } from "../config/ClientConfigContext";
import { quizApi, type RegisterPayload } from "../api/quizApi";
import { ApiError } from "../api/client";
import { useIdleTimer } from "../hooks/useIdleTimer";
import IntroScreen from "./play/IntroScreen";
import RegisterScreen from "./play/RegisterScreen";
import QuizScreen from "./play/QuizScreen";
import ResultScreen from "./play/ResultScreen";
import ExhaustedScreen from "./play/ExhaustedScreen";
import type { AttemptResult, QuestionForClient } from "../../../shared/types";

type Step = "loading" | "intro" | "register" | "quiz" | "result" | "exhausted" | "error";

export default function PlayFlow(): JSX.Element {
  const cfg = useClientConfig();
  const [searchParams] = useSearchParams();
  const kiosk = searchParams.get("kiosk") === "1";

  const [step, setStep] = useState<Step>("loading");
  const [knownFirstName, setKnownFirstName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registerSubmitting, setRegisterSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionForClient | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetToIntro = useCallback(() => {
    setAttemptId(null);
    setCurrentQuestion(null);
    setResult(null);
    setRegisterError(null);
    setStep("intro");
  }, []);

  // On load: resume an in-progress attempt, otherwise show the intro screen.
  useEffect(() => {
    (async () => {
      try {
        const me = await quizApi.me();
        if (me.authenticated) {
          setKnownFirstName(me.firstName);
          const current = await quizApi.currentAttempt();
          if (current.active) {
            setAttemptId(current.attemptId);
            setCurrentQuestion(current.question);
            setStep("quiz");
            return;
          }
        }
      } catch {
        // Fall through to the intro screen; a real outage surfaces when the player acts.
      }
      setStep("intro");
    })();
  }, []);

  async function startAndGoToQuiz(practice: boolean) {
    try {
      const start = await quizApi.startAttempt(practice);
      const question = await quizApi.getQuestion(start.attemptId);
      setAttemptId(start.attemptId);
      setCurrentQuestion(question);
      setResult(null);
      setStep("quiz");
    } catch (err) {
      if (err instanceof ApiError && err.code === "attempts_exhausted") {
        setStep("exhausted");
        return;
      }
      setErrorMessage(err instanceof ApiError ? err.message : "Connection lost. Please try again.");
      setStep("error");
    }
  }

  async function handlePlayClick() {
    if (knownFirstName) {
      setBusy(true);
      await startAndGoToQuiz(false);
      setBusy(false);
    } else {
      setStep("register");
    }
  }

  async function handleRegisterSubmit(payload: RegisterPayload) {
    setRegisterSubmitting(true);
    setRegisterError(null);
    try {
      await quizApi.register(payload);
      await startAndGoToQuiz(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setRegisterError(err.message);
      } else {
        setRegisterError("Something went wrong. Please try again.");
      }
    } finally {
      setRegisterSubmitting(false);
    }
  }

  function handleFinished(finalResult: AttemptResult) {
    setResult(finalResult);
    setCurrentQuestion(null);
    setAttemptId(null);
    setStep("result");
  }

  function handleFatalError(message: string) {
    setErrorMessage(message);
    setStep("error");
  }

  async function handleKioskIdleReset() {
    try {
      await quizApi.logout();
    } catch {
      // Best-effort; the next player's registration will still create a distinct record.
    }
    setKnownFirstName(null);
    resetToIntro();
  }

  useIdleTimer(cfg.quiz.resultIdleTimeoutMs, handleKioskIdleReset, kiosk && step === "result");

  switch (step) {
    case "loading":
      return <div className="full-page-loading" aria-busy="true" />;

    case "intro":
      return <IntroScreen onPlay={handlePlayClick} busy={busy} knownFirstName={knownFirstName} />;

    case "register":
      return (
        <RegisterScreen onSubmit={handleRegisterSubmit} submitting={registerSubmitting} serverError={registerError} />
      );

    case "quiz":
      if (!attemptId || !currentQuestion) {
        return <div className="full-page-loading" aria-busy="true" />;
      }
      return (
        <QuizScreen
          attemptId={attemptId}
          initialQuestion={currentQuestion}
          onFinished={handleFinished}
          onFatalError={handleFatalError}
        />
      );

    case "result":
      if (!result) return <div className="full-page-loading" aria-busy="true" />;
      return (
        <ResultScreen
          result={result}
          onPlayAgain={
            !result.isPractice && result.attemptsUsed < result.maxAttempts ? () => resetToIntro() : null
          }
          onPracticeMode={!result.isPractice ? () => startAndGoToQuiz(true) : null}
        />
      );

    case "exhausted":
      return <ExhaustedScreen onPracticeMode={() => startAndGoToQuiz(true)} />;

    case "error":
    default:
      return (
        <div className="screen">
          <h1 className="screen-title">Something went wrong</h1>
          <p className="screen-body">{errorMessage ?? "Please try again."}</p>
          <button className="btn btn-primary" onClick={() => resetToIntro()}>
            Back to start
          </button>
        </div>
      );
  }
}
