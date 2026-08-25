export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (m = 'Invalid request', d?: unknown) => new ApiError(400, m, d);
export const unauthorized = (m = 'Please sign in') => new ApiError(401, m);
export const forbidden = (m = 'You do not have access to this') => new ApiError(403, m);
export const notFound = (m = 'Not found') => new ApiError(404, m);
export const conflict = (m = 'Already exists') => new ApiError(409, m);
export const tooMany = (m = 'Too many requests, please try again shortly') => new ApiError(429, m);
