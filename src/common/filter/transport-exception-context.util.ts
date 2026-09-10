type HandlerExecutionContext = {
  getClass: () => unknown;
  getHandler: () => unknown;
};

/** Возвращает стабильную метку Nest-обработчика для transport error-лога. */
export const getTransportErrorHandlerLabel = (
  host: HandlerExecutionContext,
) => {
  const getName = (target: unknown) =>
    typeof target === 'function' && target.name ? target.name : 'unknown';
  const className = getName(host.getClass());
  const handlerName = getName(host.getHandler());
  return `${className}.${handlerName}`;
};
