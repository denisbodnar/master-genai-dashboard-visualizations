<template>
  <div class="config-panel">
    <div class="form-group">
      <label class="field-label">LLM Provider</label>
      <select class="select-input" :value="provider" :disabled="isGenerating"
        @change="$emit('update:provider', $event.target.value)">
        <option value="openai">OpenAI — GPT-4o</option>
        <option value="ollama">Ollama — Local</option>
      </select>
    </div>

    <div class="form-group">
      <label class="field-label">Prompt Mode</label>
      <select class="select-input" :value="mode" :disabled="provider === 'none' || isGenerating"
        @change="$emit('update:mode', $event.target.value)">
        <option value="zero-shot">Zero-shot</option>
        <option value="few-shot">Few-shot (D3 Examples)</option>
        <option value="cot">Chain of Thought</option>
      </select>
    </div>

    <button class="generate-btn" :disabled="!canGenerate || isGenerating" @click="$emit('generate')">
      <component :is="isGenerating ? LoaderIcon : WandIcon" class="btn-icon" :class="{ spin: isGenerating }" />
      {{ isGenerating ? 'Generating & Refining…' : 'Generate Visualization' }}
    </button>
  </div>
</template>

<script setup>
import { Wand2, Loader2 } from 'lucide-vue-next';

defineProps({
  provider: String,
  mode: String,
  canGenerate: Boolean,
  isGenerating: Boolean,
});

defineEmits(['update:provider', 'update:mode', 'generate']);

const WandIcon = Wand2;
const LoaderIcon = Loader2;
</script>

<style scoped>
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.generate-btn {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--grad);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-family: inherit;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.01em;
}

.generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6a9fff, #9b7cff);
  box-shadow: 0 0 24px rgba(9, 105, 218, 0.3);
}

.generate-btn:disabled {
  background: var(--bg);
  color: var(--text3);
  border: 1px solid var(--border);
  cursor: not-allowed;
}

.btn-icon {
  width: 15px;
  height: 15px;
}

.spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
