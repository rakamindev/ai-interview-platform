# Engineering Task Breakdown & Context

## Task 1: API - Audio Thread Blocking

**What is going on:** 
Every time the server receives a piece of audio from the candidate, it stops, opens a database connection, saves it, and then goes back to listening. With multiple candidates talking simultaneously, the server runs out of database connections. The database chokes, the WebSocket lags, and the candidate's audio drops.

**Real-world sample:** 
A cashier at a fast-food restaurant takes an order, walks into the kitchen to cook the burger, and only returns to the counter when the burger is done. The queue stops moving.

**The Fix:**
Decouple receiving from saving. The WebSocket should take the audio chunk, drop it into an in-memory queue (like Redis), and immediately go back to listening. A background job (Sidekiq) reads from Redis and writes to the database asynchronously.

---

## Task 2: API - Silent Error Swallowing

**What is going on:**
The code has a `rescue RecordNotUnique` block that does nothing. If two processes try to save the exact same transcript at the exact same millisecond, the database rejects one to prevent duplicates. Instead of retrying or logging the error, the code ignores it. The transcript text vanishes.

**Real-world sample:**
A courier tries to drop a parcel into a full mailbox. It bounces out onto the street. The courier walks away without telling anyone.

**The Fix:**
Catch the error properly. Use an `upsert` (insert or update if it exists) so data is never lost, or push it to a dead-letter queue for automatic retries.

---

## Task 3: Security - Token Leakage

**What is going on:**
Authentication currently uses a query parameter (`?token=...`) to connect to the WebSocket. Standard web servers and load balancers log full URLs, meaning plain-text JWTs are permanently stored in server access logs, creating a massive security vulnerability.

**Real-world sample:**
Writing your ATM PIN on the outside of the envelope before mailing it to the bank. 

**The Fix:**
Remove the token from the query string. Pass the authentication token securely via HTTP upgrade headers or implement a short-lived, one-time ticket system generated via a secure REST endpoint before establishing the WebSocket connection.

---

## Task 4: Web - Network Drop Graceful Degradation

**What is going on:**
The browser streams audio chunks to the server via WebSocket. If the candidate's WiFi drops for 5 seconds, the connection breaks. The browser keeps recording, but because it has nowhere to send the data, those 5 seconds of audio are permanently lost.

**Real-world sample:**
Talking on a phone call while driving through a tunnel. The line drops, you keep talking, but the other person never hears what you said in the tunnel.

**The Fix:**
Cache the audio chunks locally in the browser (`IndexedDB`) before sending. Once the server confirms receipt, delete it locally. If the WebSocket drops, keep saving locally. When the connection restores, bulk-flush the cached chunks.

```typescript
type AudioChunk = {
  id: string;
  blob: Blob;
  timestamp: number;
  synced: boolean;
}

declare function openDatabase(): Promise<IDBDatabase>;

const saveChunkLocally = async (chunk: Blob): Promise<void> => {
  const db: IDBDatabase = await openDatabase();
  const newChunk: AudioChunk = {
    id: crypto.randomUUID(),
    blob: chunk,
    timestamp: Date.now(),
    synced: false
  };
  
  const transaction: IDBTransaction = db.transaction("audio_chunks", "readwrite");
  const store: IDBObjectStore = transaction.objectStore("audio_chunks");
  store.add(newChunk);
}
```

---

## Task 5: AI / Backend - Flash Bleed (State Lag)

**What is going on:**
The AI evaluates the candidate's answers based on a sliding context window. Because calling the Gemini API takes time, the AI evaluates the context asynchronously. If the candidate speaks again before the AI finishes thinking, the AI's response is based on outdated info. It ends up asking a question about a skill the candidate just explained.

**Real-world sample:**
You order a coffee, then a second later change it to tea. The waiter is already walking away processing your first order. He returns with coffee and asks to confirm your coffee order, completely missing the update.

**The Fix:**
Implement a state lock or a synchronous queue for the context window. Before sending the next prompt to Gemini, the backend must verify that no new audio turns were injected during the wait time. If there is new data, it must merge it before generating the AI's response.

---
 
## Task 6: Web / UI - Missing Edge Cases & Empty States

**What is going on:**
The frontend only handles the "happy path". If a candidate accidentally clicks "Deny" when the browser asks for microphone permissions, the app just sits there. It does not show an error or recovery steps.

**Real-world sample:**
An ATM swallows your card and the screen freezes on "Processing..." forever instead of showing a proper error message.

**The Fix:**
Catch the exceptions explicitly in React and render proper fallback components. Intercept errors like NotAllowedError and show a clear UI with a retry button.