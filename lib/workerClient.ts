import { ParsedLogFile } from './types';
import { parseLogContent } from './logParser';

export interface ParseOptions {
  onProgress?: (percent: number, message: string) => void;
}

export function parseLogInBackground(
  fileContent: string,
  fileName: string,
  fileId: string,
  options?: ParseOptions
): Promise<ParsedLogFile> {
  return new Promise((resolve, reject) => {
    // For smaller files (< 2MB) or if Worker is not supported in environment:
    const isBrowser = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
    if (!isBrowser || fileContent.length < 2 * 1024 * 1024) {
      try {
        options?.onProgress?.(50, 'Parsing log entries...');
        const result = parseLogContent(fileContent, fileName, fileId);
        options?.onProgress?.(100, 'Complete');
        resolve(result);
      } catch (err) {
        reject(err);
      }
      return;
    }

    try {
      const worker = new Worker('/workers/logParserWorker.js');

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'PROGRESS') {
          options?.onProgress?.(data.progress, data.message);
        } else if (data.type === 'SUCCESS') {
          worker.terminate();
          resolve(data.result);
        } else if (data.type === 'ERROR') {
          worker.terminate();
          // Fallback to main thread parser
          try {
            const fallbackResult = parseLogContent(fileContent, fileName, fileId);
            resolve(fallbackResult);
          } catch (fallbackErr) {
            reject(new Error(data.error));
          }
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        // Fallback to main thread parser
        try {
          const fallbackResult = parseLogContent(fileContent, fileName, fileId);
          resolve(fallbackResult);
        } catch {
          reject(err);
        }
      };

      worker.postMessage({
        fileContent,
        fileName,
        fileId,
      });
    } catch {
      // Direct parse fallback
      try {
        const result = parseLogContent(fileContent, fileName, fileId);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }
  });
}
