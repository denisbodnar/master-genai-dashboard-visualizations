<template>
  <div class="app-wrapper">
    <!-- Sticky header -->
    <header class="app-header">
      <span class="logo-wordmark heading-gradient">GenAI-Viz</span>
      <div class="status-pill" :class="`status-${appStatus}`">
        <span class="status-dot" :class="{ pulse: isGenerating }" />
        {{ statusLabel }}
      </div>
    </header>

    <main class="main-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="glass-panel card-section fade-up fade-up-1">
          <div class="section-label">Dataset</div>
          <FileUploader :file="selectedFile" @update:file="handleFileChange" />
        </div>

        <div class="glass-panel card-section fade-up fade-up-2">
          <div class="section-label">Chart Type</div>
          <ChartTypeSelector
            :recommended-type="recommendedType"
            v-model="userChartType"
            :disabled="isGenerating"
          />
        </div>

        <div class="glass-panel card-section fade-up fade-up-3">
          <div class="section-label">Configuration</div>
          <ConfigurationPanel
            v-model:provider="provider"
            v-model:mode="mode"
            :can-generate="!!selectedFile"
            :is-generating="isGenerating"
            @generate="handleGenerate"
          />
        </div>
      </aside>

      <!-- Right column -->
      <div class="right-column">
        <ChartRenderer
          class="fade-up fade-up-3"
          :code="generationResult?.code"
          :data="fullData"
          :has-result="!!generationResult"
        />
        <GenerationLogs
          class="fade-up fade-up-4"
          :result="generationResult"
          :is-generating="isGenerating"
        />
        <PromptInspector
          class="fade-up fade-up-4"
          :result="generationResult"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import FileUploader from './components/FileUploader.vue';
import ConfigurationPanel from './components/ConfigurationPanel.vue';
import ChartTypeSelector from './components/ChartTypeSelector.vue';
import GenerationLogs from './components/GenerationLogs.vue';
import PromptInspector from './components/PromptInspector.vue';
import ChartRenderer from './components/ChartRenderer.vue';
import { api } from './services/api';
import * as d3 from 'd3';

const selectedFile    = ref(null);
const provider        = ref('none');
const mode            = ref('zero-shot');
const isGenerating    = ref(false);
const generationResult = ref(null);
const fullData        = ref(null);
const recommendedType = ref(null);   // from /api/select-chart
const userChartType   = ref(null);   // override selected by user (null = auto)

const appStatus = computed(() => {
  if (isGenerating.value) return 'generating';
  if (generationResult.value) return generationResult.value.status === 'fallback' ? 'fallback' : 'success';
  if (selectedFile.value) return 'loaded';
  return 'idle';
});

const statusLabel = computed(() => ({
  idle:       'Ready',
  loaded:     'CSV Loaded',
  generating: 'Generating…',
  success:    'Success',
  fallback:   'Fallback',
})[appStatus.value] || 'Ready');

const handleFileChange = async (file) => {
  selectedFile.value    = file;
  recommendedType.value = null;
  userChartType.value   = null;
  generationResult.value = null;

  if (file) {
    try {
      const result = await api.selectChart(file);
      recommendedType.value = result.recommendation?.chartType ?? null;
    } catch {
      // Non-critical: selector failure should not block generation
    }
  }
};

const handleGenerate = async () => {
  if (!selectedFile.value) return;

  isGenerating.value = true;
  generationResult.value = null;
  fullData.value = null;

  try {
    const text = await selectedFile.value.text();
    fullData.value = d3.csvParse(text);

    const result = await api.generateChart(
      selectedFile.value,
      provider.value,
      mode.value,
      userChartType.value,   // null → server auto-selects
    );
    generationResult.value = result;
  } catch (err) {
    console.error('Generation failed:', err);
    generationResult.value = {
      status: 'fallback',
      chartType: 'unknown',
      totalLatencyMs: 0,
      validationLog: [{ iteration: 1, ok: false, errorType: 'API_ERROR', message: err.message }],
    };
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo-wordmark {
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 20px;
  color: var(--text3);
}

.status-pill.status-loaded    { color: var(--accent); }
.status-pill.status-generating { color: var(--warning); }
.status-pill.status-success   { color: var(--success); }
.status-pill.status-fallback  { color: var(--warning); }

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-dot.pulse {
  animation: pulse 1.2s ease infinite;
}

.main-layout {
  flex: 1;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 300px;
  flex-shrink: 0;
}

.card-section {
  padding: 1.25rem;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.875rem;
}

.right-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

@media (max-width: 900px) {
  .main-layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
  }
}
</style>
