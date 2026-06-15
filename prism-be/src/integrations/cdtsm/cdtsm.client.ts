import axios from 'axios';
import { env } from '../../config/env.js';

/**
 * Cisco Deep Time Series Model (CDTSM) client.
 * Connects to the self-hosted CDTSM Inference Host for anomaly prediction.
 */

export interface CDTSMSeriesPayload {
  coarse_ctx: number[];
  fine_ctx: number[];
}

export interface CDTSMRequest {
  payload: CDTSMSeriesPayload[];
  model?: string;
  metadata?: { quantiles?: string[] };
}

export interface CDTSMPredictionItem {
  mean: (number | null)[];
  quantiles: Record<string, (number | null)[]>;
}

export interface CDTSMResponse {
  request_id: string;
  model: string;
  horizon: number;
  predictions: CDTSMPredictionItem[];
}

export class CDTSMClient {
  private baseUrl: string;
  private authToken: string;

  constructor() {
    this.baseUrl = env.CDTSM_BASE_URL || 'http://localhost:8080';
    this.authToken = env.CDTSM_AUTH_TOKEN || '';
  }

  private get headers() {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      h['Authorization'] = `Bearer ${this.authToken}`;
    }
    return h;
  }

  /**
   * Check if the CDTSM inference host is available and ready.
   */
  async isReady(): Promise<boolean> {
    const url = `${this.baseUrl}/ready`;
    console.log(`[CDTSMClient] isReady() checking: ${url}`);
    console.log(`[CDTSMClient] baseUrl=${this.baseUrl}, authToken=${this.authToken ? '***set***' : '***MISSING***'}`);
    try {
      const resp = await axios.get(url, {
        headers: this.headers,
        timeout: 5000,
      });
      console.log(`[CDTSMClient] /ready responded with status=${resp.status}`);
      return resp.status === 200;
    } catch (err: any) {
      console.error(`[CDTSMClient] /ready FAILED:`, err.code || err.message);
      if (err.response) {
        console.error(`[CDTSMClient] Response status=${err.response.status}, data=`, err.response.data);
      }
      return false;
    }
  }

  /**
   * Run inference on time series data.
   * 
   * @param series - Array of metric series, each containing coarse_ctx and fine_ctx
   * @param horizon - Number of future steps to predict (default: 10)
   * @returns Prediction results with mean forecasts and quantiles
   */
  async infer(series: CDTSMSeriesPayload[], horizon: number = 10): Promise<CDTSMResponse> {
    const body: CDTSMRequest = {
      payload: series,
      model: 'CDTSM',
      metadata: {
        quantiles: ['p10', 'p50', 'p90'],
      },
    };

    const response = await axios.post<CDTSMResponse>(
      `${this.baseUrl}/cdtsm/v1/ai/infer`,
      body,
      {
        headers: this.headers,
        params: { horizon },
        timeout: 60000,
      }
    );

    return response.data;
  }

  /**
   * Compute anomaly score from a single metric series.
   * Sends the series through CDTSM and compares predictions with actual trend.
   * Returns a normalized score 0-100 (higher = more anomalous).
   */
  async computeAnomalyScore(
    coarseCtx: number[],
    fineCtx: number[],
    horizon: number = 5
  ): Promise<{ score: number; predictedValues: number[]; failureWindowMinutes: number }> {
    const response = await this.infer(
      [{ coarse_ctx: coarseCtx, fine_ctx: fineCtx }],
      horizon
    );

    const prediction = response.predictions[0];
    if (!prediction || !prediction.mean.length) {
      return { score: 0, predictedValues: [], failureWindowMinutes: 0 };
    }

    const predictedValues = prediction.mean.filter((v): v is number => v !== null);

    // Compute anomaly score based on trend acceleration and p90 divergence
    const lastActual = fineCtx[fineCtx.length - 1];
    const maxPredicted = Math.max(...predictedValues);
    const p90Values = prediction.quantiles['p90']?.filter((v): v is number => v !== null) || [];
    const maxP90 = p90Values.length > 0 ? Math.max(...p90Values) : maxPredicted;

    // Score based on: how much the predicted trend diverges from stable baseline
    const trendAcceleration = (maxPredicted - lastActual) / (lastActual || 1);
    const p90Divergence = (maxP90 - maxPredicted) / (maxPredicted || 1);

    // Normalize to 0-100 scale
    let score = Math.min(100, Math.max(0,
      (trendAcceleration * 50) + (p90Divergence * 30) + 20
    ));

    // Estimate time to failure (when predicted values cross critical threshold)
    const intervalMinutes = 5; // Each step = 5 minutes
    let failureWindowMinutes = 0;
    for (let i = 0; i < predictedValues.length; i++) {
      if (predictedValues[i] > 95) { // 95% = critical threshold
        failureWindowMinutes = (i + 1) * intervalMinutes;
        break;
      }
    }
    if (failureWindowMinutes === 0 && maxPredicted > 85) {
      failureWindowMinutes = predictedValues.length * intervalMinutes;
    }

    return { score: Math.round(score), predictedValues, failureWindowMinutes };
  }
}

export const cdtsmClient = new CDTSMClient();
