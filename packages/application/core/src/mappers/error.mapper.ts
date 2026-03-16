import { DomainError } from "@domain/core";
import type { ErrorDTO } from "../dtos/error.dto";

export const mapErrorToDTO = (error: unknown): ErrorDTO => {
  if (error instanceof DomainError) {
    return {
      code: error.code,
      message: error.message,
      severity: "error",
      metadata: error.metadata,
    };
  }

  if (error instanceof Error) {
    return {
      code: "UNEXPECTED_FAILURE",
      message: error.message,
      severity: "error",
      metadata: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  const unknownMessage = typeof error === "string" ? error : JSON.stringify(error);

  return {
    code: "UNKNOWN_ERROR",
    message: unknownMessage,
    severity: "error",
    metadata: undefined,
  };
};
