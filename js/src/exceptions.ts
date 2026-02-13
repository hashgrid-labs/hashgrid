/** Custom exceptions for the Hashgrid client. */

export class HashgridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HashgridError";
    Object.setPrototypeOf(this, HashgridError.prototype);
  }
}

export class HashgridAPIError extends HashgridError {
  status_code?: number;
  response?: Response;

  constructor(message: string, status_code?: number, response?: Response) {
    super(message);
    this.name = "HashgridAPIError";
    this.status_code = status_code;
    this.response = response;
    Object.setPrototypeOf(this, HashgridAPIError.prototype);
  }
}

export class HashgridAuthenticationError extends HashgridAPIError {
  constructor(message: string, status_code?: number, response?: Response) {
    super(message, status_code, response);
    this.name = "HashgridAuthenticationError";
    Object.setPrototypeOf(this, HashgridAuthenticationError.prototype);
  }
}

export class HashgridNotFoundError extends HashgridAPIError {
  constructor(message: string, status_code?: number, response?: Response) {
    super(message, status_code, response);
    this.name = "HashgridNotFoundError";
    Object.setPrototypeOf(this, HashgridNotFoundError.prototype);
  }
}

export class HashgridValidationError extends HashgridAPIError {
  constructor(message: string, status_code?: number, response?: Response) {
    super(message, status_code, response);
    this.name = "HashgridValidationError";
    Object.setPrototypeOf(this, HashgridValidationError.prototype);
  }
}

