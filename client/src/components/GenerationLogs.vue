<template>
  <div class="glass-panel logs-panel">
    <div class="panel-header">
      <span class="panel-title">Pipeline Logs</span>
      <div v-if="result" class="metrics">
        <span v-if="result.totalLatencyMs > 0" class="metric-pill">
          <component :is="TimerIcon" class="metric-icon" />
          {{ (result.totalLatencyMs / 1000).toFixed(2) }}s
        </span>
        <span v-if="result.totalTokens > 0" class="metric-pill">
          <component :is="CoinsIcon" class="metric-icon" />
          {{ result.totalTokens.toLocaleString() }} tokens
        </span>
      </div>
    </div>

    <div class="logs-body">
      <!-- Empty -->
      <div v-if="!result && !isGenerating" class="empty-state">
        Run the generator to see the Self-Refine loop.
      </div>

      <!-- Generating -->
      <div v-if="isGenerating" class="log-row log-row--accent">
        <div class="log-row-header">
          <component :is="LoaderIcon" class="row-icon spin" />
          <span class="row-label">Generating &amp; refining…</span>
        </div>
      </div>

      <!-- Schema step -->
      <div v-if="result" class="log-row log-row--success">
        <div class="log-row-header">
          <component :is="CheckIcon" class="row-icon text-success" />
          <span class="row-label">Schema Inferred</span>
        </div>
        <div class="row-detail">
          Type: <span class="detail-accent">{{ result.chartType }}</span>
          · {{ result.schema?.columns?.length ?? '—' }} columns
          · {{ result.status === 'fallback' ? 'rule-based' : 'LLM inference' }}
        </div>
      </div>

      <!-- Iteration logs -->
      <template v-if="result">
        <div
          v-for="log in (result.validationLog || [])"
          :key="log.iteration"
          class="log-row"
          :class="log.ok ? 'log-row--success' : 'log-row--error'"
        >
          <div class="log-row-header">
            <component :is="log.ok ? CheckIcon : XIcon" class="row-icon"
              :class="log.ok ? 'text-success' : 'text-error'" />
            <span class="row-label">Iteration {{ log.iteration }}</span>
            <span class="badge" :class="log.ok ? 'badge-success' : 'badge-error'">
              {{ log.ok ? 'Valid' : 'Refine' }}
            </span>
          </div>
          <div v-if="!log.ok" class="row-detail row-detail--error">
            <span v-if="log.errorType" class="error-type">{{ log.errorType }}</span>
            <div v-if="log.message" class="error-msg">
              {{ log.message.slice(0, 120) }}{{ log.message.length > 120 ? '…' : '' }}
            </div>
          </div>
          <div class="row-detail row-meta">
            {{ log.latencyMs ? Math.round(log.latencyMs) + 'ms' : 'N/A' }} · {{ log.tokens || 0 }} tokens
          </div>
        </div>
      </template>

      <!-- Final status -->
      <div v-if="result" class="log-row"
        :class="result.status === 'success' ? 'log-row--success log-row--final-success' : 'log-row--warning log-row--final-warning'">
        <div class="log-row-header">
          <component :is="result.status === 'success' ? StarIcon : WarnIcon" class="row-icon"
            :class="result.status === 'success' ? 'text-success' : 'text-warning'" />
          <span class="row-label">Final: {{ result.status.toUpperCase() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Timer, Coins, Check, X, Star, AlertTriangle, Loader2 } from 'lucide-vue-next';

defineProps({
  result:      { type: Object,  default: null },
  isGenerating: { type: Boolean, default: false },
});

const TimerIcon  = Timer;
const CoinsIcon  = Coins;
const CheckIcon  = Check;
const XIcon      = X;
const StarIcon   = Star;
const WarnIcon   = AlertTriangle;
const LoaderIcon = Loader2;
</script>

<style scoped>
.logs-panel {
  display: flex;
  flex-direction: column;
  max-height: 380px;
}

.panel-header {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text1);
}

.metrics {
  display: flex;
  gap: 6px;
}

.metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--text2);
  border: 1px solid var(--border);
  padding: 2px 8px;
  border-radius: 20px;
}

.metric-icon {
  width: 10px;
  height: 10px;
}

.logs-body {
  flex: 1;
  overflow-y: auto;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  font-size: 0.8rem;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}

.log-row {
  background: var(--bg);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
}

.log-row--success { border-left-color: var(--success); }
.log-row--error   { border-left-color: var(--error); background: var(--error-subtle); border-color: var(--error-border); }
.log-row--accent  { border-left-color: var(--accent); background: rgba(9, 105, 218, 0.05); border-color: rgba(9, 105, 218, 0.15); }
.log-row--warning { border-left-color: var(--warning); }
.log-row--final-success { background: var(--success-subtle); border-color: var(--success-border); }
.log-row--final-warning { background: var(--warning-subtle); border-color: var(--warning-border); }

.log-row-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.row-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.row-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text1);
}

.badge {
  font-size: 0.62rem;
  padding: 1px 7px;
  border-radius: 20px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.badge-success {
  background: var(--success-subtle);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.badge-error {
  background: var(--error-subtle);
  color: var(--error);
  border: 1px solid var(--error-border);
}

.row-detail {
  font-size: 0.73rem;
  color: var(--text3);
  padding-left: 18px;
  margin-top: 2px;
}

.row-detail--error { }

.error-type {
  color: var(--error);
  font-weight: 600;
}

.error-msg {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  background: rgba(207, 34, 46, 0.07);
  border: 1px solid rgba(207, 34, 46, 0.15);
  padding: 3px 8px;
  border-radius: 5px;
  margin-top: 4px;
  word-break: break-all;
  color: var(--error);
}

.row-meta {
  margin-top: 3px;
  font-size: 0.7rem;
}

.detail-accent { color: var(--accent); }
.text-success  { color: var(--success); }
.text-error    { color: var(--error); }
.text-warning  { color: var(--warning); }

.spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
