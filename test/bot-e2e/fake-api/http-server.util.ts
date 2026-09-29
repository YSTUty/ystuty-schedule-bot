import * as http from 'node:http';

export const readJsonBody = async <T>(
  request: http.IncomingMessage,
): Promise<T> => {
  const chunks: string[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk).toString('utf8'));
  }

  const body = chunks.join('');
  return (body ? JSON.parse(body) : {}) as T;
};

export const sendJson = (
  response: http.ServerResponse,
  body: unknown,
  statusCode = 200,
) => {
  // The fake API does not need persistent HTTP connections. Explicitly close
  // them so Node's client keep-alive pool cannot delay Jest shutdown.
  response.writeHead(statusCode, {
    connection: 'close',
    'content-type': 'application/json',
  });
  response.end(JSON.stringify(body));
};

export const listenHttpServer = async (server: http.Server) => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Fake HTTP server did not expose a TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
};

export const closeHttpServer = async (server: http.Server) => {
  // Keep-alive sockets from real polling clients otherwise keep Jest alive
  // after a failed scenario before the next long-poll request is made.
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};
