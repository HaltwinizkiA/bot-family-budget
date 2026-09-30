export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export class InsufficientFundsError extends Error {
  constructor() {
    super("Недостаточно средств");
    this.name = "InsufficientFundsError";
  }
}

export class SaveFailedError extends Error {
  constructor() {
    super("Не удалось сохранить, попробуйте ещё раз");
    this.name = "SaveFailedError";
  }
}

export class AuthError extends Error {
  constructor() {
    super("Не авторизовано");
    this.name = "AuthError";
  }
}
