import { DurableObject } from "cloudflare:workers";

// Worker
export default {
  async fetch(request, env, ctx) {
    if (request.url.endsWith("/websocket")) {
      // Expect to receive a WebSocket Upgrade request.
      // If there is one, accept the request and return a WebSocket Response.
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
      }

      // This example will refer to the same Durable Object instance,
      // since the name "foo" is hardcoded.
      let id = env.WEBSOCKET_SERVER.idFromName("foo");
      let stub = env.WEBSOCKET_SERVER.get(id);

      return stub.fetch(request);
    }

    return new Response(null, {
      status: 400,
      statusText: 'Bad Request',
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
};

// Durable Object
export class WebSocketServer extends DurableObject {
  currentlyConnectedWebSockets;

  constructor(ctx, env) {
    // This is reset whenever the constructor runs because
    // regular WebSockets do not survive Durable Object resets.
    //
    // WebSockets accepted via the Hibernation API can survive
    // a certain type of eviction, but we will not cover that here.
    super(ctx, env);
    this.currentlyConnectedWebSockets = 0;
  }

  async fetch(request) {
    // Creates two ends of a WebSocket connection.
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Calling `accept()` tells the runtime that this WebSocket is to begin terminating
    // request within the Durable Object. It has the effect of "accepting" the connection,
    // and allowing the WebSocket to send and receive messages.
    server.accept();
    this.currentlyConnectedWebSockets += 1;

    // Upon receiving a message from the client, the server replies with the same message,
    // and the total number of connections with the "[Durable Object]: " prefix
    server.addEventListener('message', (event) => {
	  console.log(event);
      server.send(`[Durable Object] currentlyConnectedWebSockets: ${this.currentlyConnectedWebSockets}`);
    });

    // If the client closes the connection, the runtime will close the connection too.
    server.addEventListener('close', (cls) => {
      this.currentlyConnectedWebSockets -= 1;
      server.close(cls.code, "Durable Object is closing WebSocket");
    });

	server.addEventListener("error", (event) => {
	  console.log(`Error in error handler: ${event}`);
	});

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }
}
