export class AppError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class AttemptsExhaustedError extends AppError {
  constructor() {
    super(403, "attempts_exhausted", "You've used all of your attempts for this quiz.");
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super(404, "not_found", `${what} not found.`);
  }
}

export class AttemptFinishedError extends AppError {
  constructor() {
    super(409, "attempt_finished", "This attempt has already finished.");
  }
}

export class WrongQuestionError extends AppError {
  constructor() {
    super(409, "wrong_question", "That is not the current question for this attempt.");
  }
}

export class AlreadyAnsweredError extends AppError {
  constructor() {
    super(409, "already_answered", "This question has already been answered.");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden.") {
    super(403, "forbidden", message);
  }
}
