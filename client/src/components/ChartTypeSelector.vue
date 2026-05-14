<script setup>
import { computed } from 'vue';
import { SUPPORTED_CHART_TYPES, CHART_TYPE_LABELS } from '../constants/chartTypes.js';

const props = defineProps({
  /** Recommended chart type from /api/select-chart, or null if not yet analyzed. */
  recommendedType: { type: String, default: null },
  /** v-model: user-selected override (null = let the server decide). */
  modelValue: { type: String, default: null },
  /** Disable the selector while generating. */
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const selected = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val === '' ? null : val),
});

const options = SUPPORTED_CHART_TYPES.map((t) => ({
  value: t,
  label: CHART_TYPE_LABELS[t],
  isRecommended: t === props.recommendedType,
}));
</script>

<template>
  <div class="chart-type-selector">
    <label class="field-label" for="chart-type-select">Chart Type</label>
    <div class="select-wrapper">
      <select
        id="chart-type-select"
        class="select-input"
        :value="selected"
        :disabled="disabled"
        @change="selected = $event.target.value"
      >
        <option value="">Auto (system recommends)</option>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}{{ opt.isRecommended ? ' ★' : '' }}
        </option>
      </select>
    </div>
    <p v-if="recommendedType && selected && selected !== recommendedType" class="override-hint">
      Overriding recommendation: <em>{{ CHART_TYPE_LABELS[recommendedType] }}</em>
    </p>
    <p v-else-if="recommendedType && !selected" class="recommended-hint">
      Recommended: <em>{{ CHART_TYPE_LABELS[recommendedType] }}</em>
    </p>
  </div>
</template>

<style scoped>
.chart-type-selector {
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

.select-wrapper {
  position: relative;
}

.override-hint {
  font-size: 0.75rem;
  color: #b45309;
  margin: 0;
}

.recommended-hint {
  font-size: 0.75rem;
  color: var(--text3);
  margin: 0;
}
</style>
