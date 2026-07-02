import { WebSocket } from 'ws';
import { metricsService } from '../services/metrics.service';
import { MetricsSample } from '../types';

export function handleMetricsConnection(ws: WebSocket): void {
  ws.send(JSON.stringify({ type: 'history', samples: metricsService.getHistory() }));

  const onSample = (sample: MetricsSample) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'sample', sample }));
    }
  };
  metricsService.on('sample', onSample);

  ws.on('close', () => {
    metricsService.off('sample', onSample);
  });
}
