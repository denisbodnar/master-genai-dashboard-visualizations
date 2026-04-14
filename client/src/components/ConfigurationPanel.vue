<template>
  <div class="glass-panel config-panel">
    <div class="config-grid">
      <div class="form-group">
        <label for="provider">LLM Provider</label>
        <select id="provider" :value="provider" @input="$emit('update:provider', $event.target.value)" class="select-input">
          <option value="none">Rule-based (No LLM)</option>
          <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
          <option value="ollama">Ollama (Local Models)</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="mode">Prompt Mode</label>
        <select id="mode" :value="mode" @input="$emit('update:mode', $event.target.value)" class="select-input" :disabled="provider === 'none'">
          <option value="zero-shot">Zero-shot (Direct Generation)</option>
          <option value="few-shot">Few-shot (With D3 Examples)</option>
          <option value="cot">CoT (Chain of Thought Reasoning)</option>
        </select>
      </div>
      
      <div class="actions">
        <button 
          class="btn btn-primary generate-btn" 
          @click="$emit('generate')"
          :disabled="isGenerating || !canGenerate"
        >
          <span v-if="!isGenerating">
            <component :is="Wand2Icon" class="btn-icon" />
            Generate D3 Visualization
          </span>
          <span v-else class="loading-state">
            <component :is="LoaderIcon" class="btn-icon spin" />
            Generating & Refining...
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { Wand2, Loader2 } from 'lucide-vue-next';

defineProps({
  provider: String,
  mode: String,
  canGenerate: Boolean,
  isGenerating: Boolean
});

defineEmits(['update:provider', 'update:mode', 'generate']);

const Wand2Icon = Wand2;
const LoaderIcon = Loader2;
</script>

<style scoped>
.config-panel {
  padding: 1.5rem;
}

.config-grid {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-width: 200px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.actions {
  flex: 1;
  min-width: 250px;
}

.generate-btn {
  width: 100%;
  height: 48px;
  font-size: 1rem;
}

.btn-icon {
  width: 18px;
  height: 18px;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
