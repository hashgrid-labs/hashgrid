/** Custom exceptions for the Hashgrid client. */

export class HashgridError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HashgridError";
    Object.setPrototypeOf(this, HashgridError.prototype);
  }
}

export class HashgridAPIError extends HashgridError {
  statusCode?: number;
  response?: Response;

  constructor(message: string, statusCode?: number, response?: Response) {
    super(message);
    this.name = "HashgridAPIError";
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, HashgridAPIError.prototype);
  }
}

export class HashgridAuthenticationError extends HashgridAPIError {
  constructor(message: string, statusCode?: number, response?: Response) {
    super(message, statusCode, response);
    this.name = "HashgridAuthenticationError";
    Object.setPrototypeOf(this, HashgridAuthenticationError.prototype);
  }
}

export class HashgridNotFoundError extends HashgridAPIError {
  constructor(message: string, statusCode?: number, response?: Response) {
    super(message, statusCode, response);
    this.name = "HashgridNotFoundError";
    Object.setPrototypeOf(this, HashgridNotFoundError.prototype);
  }
}

export class HashgridValidationError extends HashgridAPIError {
  constructor(message: string, statusCode?: number, response?: Response) {
    super(message, statusCode, response);
    this.name = "HashgridValidationError";
    Object.setPrototypeOf(this, HashgridValidationError.prototype);
  }
}
