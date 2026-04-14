<template>
  <div class="glass-panel chart-container">
    <div class="panel-header">
      <h3 class="heading-gradient">Visualization</h3>
      <div class="actions" v-if="code">
        <button class="btn btn-small" @click="showCode = !showCode">
          <component :is="CodeIcon" class="icon" />
          {{ showCode ? 'Hide Code' : 'Show Code' }}
        </button>
      </div>
    </div>
    
    <div class="chart-content">
      <div v-if="!data || !code" class="empty-state">
        <component :is="BarChartIcon" class="empty-icon" />
        <p>Your visualization will appear here.</p>
      </div>
      
      <!-- Container for D3 -->
      <div 
        ref="d3Container" 
        class="d3-wrapper" 
        v-show="!showCode && data && code && !renderError"
      ></div>

      <!-- Error State -->
      <div v-if="renderError" class="error-state">
        <component :is="AlertTriangleIcon" class="error-icon" />
        <h4>Failed to Render Chart</h4>
        <p class="error-msg">{{ renderError }}</p>
      </div>
      
      <!-- Code View -->
      <div v-if="showCode" class="code-view">
        <pre><code>{{ code }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import * as d3 from 'd3';
import { Code, BarChart3, AlertTriangle } from 'lucide-vue-next';

const props = defineProps({
  code: { type: String, default: null },
  data: { type: Array, default: null } // The actual parsed CSV data or schema sample
});

const d3Container = ref(null);
const showCode = ref(false);
const renderError = ref(null);

const CodeIcon = Code;
const BarChartIcon = BarChart3;
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
  
  // Clear previous chart
  d3Container.value.innerHTML = '';
  renderError.value = null;
  
  try {
    // 1. Створюємо ізольоване середовище для D3-коду
    // Очікується що код містить оголошення function renderChart(data, containerSelector)
    // Ми використовуємо new Function, яка повертає саму renderChart, щоб ми могли її викликати
    
    // Щоб ізолювати, ми просто створюємо функцію:
    // (d3) => { <code_here>; return renderChart; }
    
    // Унікальний селектор для цього екземпляра
    const containerId = `d3-chart-${Math.random().toString(36).substr(2, 9)}`;
    d3Container.value.id = containerId;
    const selector = `#${containerId}`;
    
    // Обгортка для безпечного доступу лише до d3 (console доступна глобально)
    const functionBody = `
      ${props.code}
      
      if (typeof renderChart !== 'function') {
        throw new Error("The required function 'renderChart(data, containerSelector)' was not found in generated code.");
      }
      
      return renderChart;
    `;
    
    const chartFactory = new Function('d3', functionBody);
    const renderFn = chartFactory(d3);
    
    // 2. Виконуємо рендеринг з наявними даними
    renderFn(props.data, selector);
    
  } catch (err) {
    console.error('D3 Render Error:', err);
    renderError.value = err.message;
  }
};
</script>

<style scoped>
.chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 500px;
}

.panel-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.2);
}

.icon {
  width: 14px;
  height: 14px;
}

.chart-content {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.d3-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 400px;
  /* Дочірні svg отримають width:100% height:100% якщо вказано динамічно */
}

/* Глобальні стилі для SVG всередині враппера */
:deep(svg) {
  width: 100%;
  height: 100%;
  max-height: 100%;
  font-family: inherit;
}

:deep(svg text) {
  fill: var(--color-text-primary) !important;
}

:deep(svg line), :deep(svg path.domain) {
  stroke: var(--border-color) !important;
}

.empty-state {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-muted);
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.2;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem;
  height: 100%;
  color: var(--color-error);
  text-align: center;
}

.error-icon {
  width: 48px; height: 48px;
}

.error-msg {
  font-family: monospace;
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  word-break: break-all;
}

.code-view {
  flex: 1;
  background: #1e1e1e;
  overflow: auto;
  padding: 1.5rem;
}

.code-view pre {
  margin: 0;
}

.code-view code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.85rem;
  color: #d4d4d4;
}
</style>
