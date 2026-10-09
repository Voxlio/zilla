// Utility for communicating with the analysis web worker
import type { WorkerMessage, WorkerResponse } from "@/lib/analysis/types";

/**
 * Create a promise that resolves with the worker's response
 * @param message Message to send to the worker
 * @returns Promise that resolves with the worker's response
 */
export function runAnalysisInWorker(message: WorkerMessage): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    // Create the worker
    const worker = new Worker(new URL("../../workers/analysis.worker.ts", import.meta.url), {
      type: "module",
    });

    // Handle messages from the worker
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate(); // Clean up the worker
      if (event.data.type === "result") {
        resolve(event.data);
      } else {
        reject(new Error(event.data.error || "Unknown error"));
      }
    };

    // Handle errors
    worker.onerror = (error) => {
      worker.terminate();
      reject(error);
    };

    // Send the message
    worker.postMessage(message);
  });
}