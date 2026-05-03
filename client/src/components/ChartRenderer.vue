<template>
  <div class="glass-panel chart-panel">
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-title">Visualization</span>
        <span v-if="hasResult && !renderError" class="live-badge">Live</span>
      </div>
      <button v-if="hasResult" class="code-toggle" :class="{ active: showCode }" @click="showCode = !showCode">
        <component :is="CodeIcon" class="toggle-icon" />
        {{ showCode ? 'Hide Code' : 'View Code' }}
      </button>
    </div>

    <div class="chart-body">
      <!-- Empty state -->
      <div v-if="!data || !code" class="empty-state">
        <svg width="80" height="60" viewBox="0 0 80 60" fill="none">
          <rect x="5" y="30" width="14" height="25" rx="3" fill="rgba(91,106,240,0.15)" />
          <rect x="23" y="15" width="14" height="40" rx="3" fill="rgba(91,106,240,0.1)" />
          <rect x="41" y="22" width="14" height="33" rx="3" fill="rgba(139,92,246,0.1)" />
          <rect x="59" y="8" width="14" height="47" rx="3" fill="rgba(139,92,246,0.15)" />
          <line x1="2" y1="58" x2="78" y2="58" stroke="#e4e7ec" stroke-width="1.5" />
        </svg>
        <p class="empty-text">Upload a CSV dataset and configure the pipeline to generate a visualization.</p>
      </div>

      <!-- D3 chart -->
      <div ref="d3Container" class="d3-wrapper" v-show="!showCode && data && code && !renderError" />

      <!-- Error -->
      <div v-if="renderError" class="error-state">
        <component :is="AlertTriangleIcon" class="error-icon" />
        <h4>Failed to Render Chart</h4>
        <p class="error-msg">{{ renderError }}</p>
      </div>

      <!-- Code view -->
      <div v-if="showCode && code" class="code-view">
        <pre class="code-block"><code>{{ code }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import * as d3 from 'd3';
import { Code, AlertTriangle } from 'lucide-vue-next';

const props = defineProps({
  code:      { type: String,  default: null },
  data:      { type: Array,   default: null },
  hasResult: { type: Boolean, default: false },
});

const d3Container = ref(null);
const showCode    = ref(false);
const renderError = ref(null);

const CodeIcon          = Code;
const AlertTriangleIcon = AlertTriangle;

watch([() => props.code, () => props.data], async () => {
  if (props.code && props.data) {
    showCode.value = false;
    await nextTick();
    renderChart();
  }
});

const renderChart = () => {
  if (!d3Container.value) return;

  d3Container.value.innerHTML = '';
  renderError.value = null;

  try {
    const containerId = `d3-chart-${Math.random().toString(36).substr(2, 9)}`;
    d3Container.value.id = containerId;
    const selector = `#${containerId}`;

    const functionBody = `
      ${props.code}
      if (typeof renderChart !== 'function') {
        throw new Error(
          "The required function 'renderChart(data, containerSelector)'"
          + " was not found in generated code."
        );
      }
      return renderChart;
    `;

    const chartFactory = new Function('d3', functionBody);
    const renderFn = chartFactory(d3);
    renderFn(props.data, selector);
  } catch (err) {
    console.error('D3 Render Error:', err);
    renderError.value = err.message;
  }
};
</script>

<style scoped>
.chart-panel {
  display: flex;
  flex-direction: column;
  min-height: 420px;
  flex: 1;
}

.panel-header {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text1);
}

.live-badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--success);
  background: rgba(26, 127, 55, 0.1);
  border: 1px solid rgba(26, 127, 55, 0.2);
  padding: 2px 8px;
  border-radius: 20px;
}

.code-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: transparent;
  color: var(--text2);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-weight: 500;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.code-toggle.active,
.code-toggle:hover {
  background: rgba(9, 105, 218, 0.08);
  color: var(--accent);
  border-color: rgba(9, 105, 218, 0.3);
}

.toggle-icon {
  width: 12px;
  height: 12px;
}

.chart-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 2rem;
}

.empty-text {
  font-size: 0.82rem;
  color: var(--text3);
  text-align: center;
  max-width: 220px;
  line-height: 1.6;
}

.d3-wrapper {
  flex: 1;
  width: 100%;
  padding: 1.5rem;
  min-height: 360px;
}

:deep(svg) {
  width: 100%;
  height: 100%;
  max-height: 100%;
  font-family: inherit;
}

:deep(svg text) {
  fill: var(--text1) !important;
}

:deep(svg line), :deep(svg path.domain) {
  stroke: var(--border) !important;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  flex: 1;
  color: var(--error);
  text-align: center;
}

.error-icon {
  width: 40px;
  height: 40px;
}

.error-msg {
  font-family: var(--font-mono);
  background: var(--error-subtle);
  border: 1px solid var(--error-border);
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  font-size: 0.8rem;
  word-break: break-all;
  max-width: 480px;
}

.code-view {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}

.code-block {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--text1);
  line-height: 1.7;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  white-space: pre;
  overflow: auto;
}
</style>
