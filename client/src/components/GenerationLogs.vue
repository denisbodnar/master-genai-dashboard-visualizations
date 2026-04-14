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
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metrics {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.metric {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.icon {
  width: 16px;
  height: 16px;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  transition: all var(--transition-fast);
}

.log-item:hover {
  background: rgba(0, 0, 0, 0.25);
  border-color: rgba(255, 255, 255, 0.1);
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
  margin-bottom: 0.5rem;
}

.log-title {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}

.badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.badge-success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.badge-error {
  background: var(--color-error-bg);
  color: #f87171;
}

.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.highlight-text { color: var(--color-accent); }

.log-details {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-left: 1.5rem;
}

.error-msg {
  color: #f87171;
  font-family: monospace;
  margin-top: 0.25rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  border-radius: 4px;
  word-break: break-all;
}

.metrics-line {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.7;
}

.final-status {
  margin-top: 0.5rem;
  font-size: 1rem;
}

.status-success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid var(--color-success);
}

.status-fallback {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid var(--color-warning);
}
</style>
