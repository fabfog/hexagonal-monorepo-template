export interface RequestContext {
  /** Composition-local request metadata; map it to `HttpContext` or SDK-specific options in infrastructure.ts. */
  getCorrelationId?: () => string;
}
