<template>
  <div class="glass-panel logs-panel">
    <div class="panel-header">
      <h3 class="heading-gradient">Pipeline Logs</h3>
      <div v-if="result" class="metrics">
        <span class="metric" v-if="result.totalLatencyMs">
          <component :is="TimerIcon" class="icon" />
          {{ (result.totalLatencyMs / 1000).toFixed(2) }}s
        </span>
        <span class="metric" v-if="result.totalTokens">
          <component :is="CoinsIcon" class="icon" />
          {{ result.totalTokens }} tokens
        </span>
      </div>
    </div>
    
    <div class="logs-content" v-if="result">
      <div class="log-item default-item">
        <div class="log-header">
          <component :is="CheckCircleIcon" class="icon text-success" />
          <span class="log-title">Schema Inferred & Chart Selected</span>
        </div>
        <div class="log-details">
          Type: <strong class="highlight-text">{{ result.chartType }}</strong> 
          | Cols: {{ result.schema?.columns?.length || 0 }} 
          | Source: {{ result.status === 'fallback' ? 'rule-based (fallback)' : 'LLM / Rule-based' }}
        </div>
      </div>
      
      <div 
        v-for="log in (result.validationLog || [])" 
        :key="log.iteration" 
        class="log-item"
        :class="log.ok ? 'success-item' : 'error-item'"
      >
        <div class="log-header">
          <component :is="log.ok ? CheckCircleIcon : XCircleIcon" class="icon" :class="log.ok ? 'text-success' : 'text-error'" />
          <span class="log-title">
            Iteration {{ log.iteration }} 
            <span class="badge" :class="log.ok ? 'badge-success' : 'badge-error'">
              {{ log.ok ? 'Valid' : 'Refine' }}
            </span>
          </span>
        </div>
        
        <div class="log-details" v-if="!log.ok">
          Error: <strong>{{ log.errorType || 'Unknown' }}</strong>
          <p class="error-msg" v-if="log.message">{{ truncateMatch(log.message) }}</p>
        </div>
        <div class="log-details metrics-line">
          Latency: {{ log.latencyMs ? Math.round(log.latencyMs) + 'ms' : 'N/A' }} | 
          Tokens: {{ log.tokens || 0 }}
        </div>
      </div>
      
      <div class="log-item final-status" :class="`status-${result.status}`">
        <div class="log-header">
          <component :is="result.status === 'success' ? SparklesIcon : AlertTriangleIcon" class="icon" />
          <span class="log-title">Final Status: {{ result.status.toUpperCase() }}</span>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      Run the generator to see the inner workings of the Self-Refine loop.
    </div>
  </div>
</template>

<script setup>
import { CheckCircle, XCircle, Timer, Coins, Sparkles, AlertTriangle } from 'lucide-vue-next';

defineProps({
  result: {
    type: Object,
    default: null
  }
});

const CheckCircleIcon = CheckCircle;
const XCircleIcon = XCircle;
const TimerIcon = Timer;
const CoinsIcon = Coins;
const SparklesIcon = Sparkles;
const AlertTriangleIcon = AlertTriangle;

const truncateMatch = (text) => {
  if (!text) return '';
  if (text.length > 100) return text.substring(0, 100) + '...';
  return text;
};
</script>

<style scoped>
.logs-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;
}

.panel-header {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-surface);
  border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.metrics {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.metric {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-color);
  padding: 0.2rem 0.5rem;
  border-radius: 2em;
}

.icon {
  width: 14px;
  height: 14px;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-style: italic;
  padding: 2rem;
  text-align: center;
}

.log-item {
  background: var(--color-bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 0.65rem 0.875rem;
  transition: border-color var(--transition-fast);
}

.log-item:hover {
  border-color: #adb5bd;
}

.error-item {
  border-left: 3px solid var(--color-error);
}

.success-item, .default-item {
  border-left: 3px solid var(--color-success);
}

.log-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.log-title {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 2em;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.badge-success {
  background: rgba(26, 127, 55, 0.1);
  color: #1a7f37;
  border: 1px solid rgba(26, 127, 55, 0.3);
}

.badge-error {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid rgba(207, 34, 46, 0.3);
}

.text-success { color: var(--color-success); }
.text-error   { color: var(--color-error); }
.highlight-text { color: var(--color-accent); }

.log-details {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
  margin-left: 1.4rem;
}

.error-msg {
  color: var(--color-error);
  font-family: 'SFMono-Regular', Consolas, monospace;
  margin-top: 0.25rem;
  background: var(--color-error-bg);
  border: 1px solid rgba(207, 34, 46, 0.15);
  padding: 0.4rem 0.6rem;
  border-radius: var(--border-radius);
  word-break: break-all;
}

.metrics-line {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.final-status {
  margin-top: 0.25rem;
  font-size: 0.9rem;
}

.status-success {
  background: rgba(26, 127, 55, 0.06);
  border: 1px solid rgba(26, 127, 55, 0.3);
  border-left: 3px solid var(--color-success);
}

.status-fallback {
  background: rgba(154, 103, 0, 0.06);
  border: 1px solid rgba(154, 103, 0, 0.3);
  border-left: 3px solid var(--color-warning);
}
</style>
