<template>
  <div class="app-wrapper">
    <header class="app-header">
      <div class="logo">
        <component :is="BarChart2Icon" class="logo-icon text-accent" />
        <h1 class="heading-gradient">GenAI-Viz</h1>
      </div>
      <p class="subtitle">Intelligent D3.js Visualization Generator</p>
    </header>

    <main class="main-grid">
      <!-- Ліва колонка: Налаштування та Логи -->
      <div class="sidebar">
        <FileUploader 
          :file="selectedFile" 
          @update:file="selectedFile = $event" 
        />
        
        <ConfigurationPanel 
          v-model:provider="provider"
          v-model:mode="mode"
          :can-generate="!!selectedFile"
          :is-generating="isGenerating"
          @generate="handleGenerate"
        />
        
        <GenerationLogs :result="generationResult" />
      </div>

      <!-- Права колонка: Графік -->
      <div class="content-area">
        <ChartRenderer 
          :code="generationResult?.code" 
          :data="fullData" 
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { BarChart2 } from 'lucide-vue-next';
import FileUploader from './components/FileUploader.vue';
import ConfigurationPanel from './components/ConfigurationPanel.vue';
import GenerationLogs from './components/GenerationLogs.vue';
import ChartRenderer from './components/ChartRenderer.vue';
import { api } from './services/api';
import * as d3 from 'd3';

const BarChart2Icon = BarChart2;

const selectedFile = ref(null);
const provider = ref('none');
const mode = ref('zero-shot');
const isGenerating = ref(false);
const generationResult = ref(null);
const fullData = ref(null);

const handleGenerate = async () => {
  if (!selectedFile.value) return;
  
  isGenerating.value = true;
  generationResult.value = null;
  fullData.value = null;
  
  try {
    const text = await selectedFile.value.text();
    fullData.value = d3.csvParse(text);

    const result = await api.generateChart(selectedFile.value, provider.value, mode.value);
    generationResult.value = result;
  } catch (err) {
    console.error("Generation failed:", err);
    // Для демо запишемо помилку в validationLog щоб інтерфейс показав її
    generationResult.value = {
      status: 'fallback',
      chartType: 'unknown',
      totalLatencyMs: 0,
      validationLog: [{
        iteration: 1,
        ok: false,
        errorType: 'API_ERROR',
        message: err.message
      }]
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
  gap: 2rem;
  height: 100%;
}

.app-header {
  text-align: center;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 0.5rem;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.logo-icon {
  width: 32px;
  height: 32px;
  color: var(--color-accent);
}

.app-header h1 {
  font-size: 2rem;
  margin: 0;
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
}

.main-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 1.5rem;
  flex: 1;
  min-height: calc(100vh - 180px);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.content-area {
  display: flex;
  flex-direction: column;
}

@media (max-width: 992px) {
  .main-grid {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}
</style>
